"""
Linear Fault Manager (Python)

Automatically reports errors to Linear as issues with deduplication.

Usage:
    from linear_faults import report_error, report_fault, FaultReport
    
    # Simple error reporting
    try:
        do_something()
    except Exception as e:
        await report_error(e, user_id="user_123", url="/api/endpoint")
    
    # Custom fault reporting
    await report_fault(FaultReport(
        message="Something went wrong",
        severity="error",
        context={"action": "some_action"}
    ))
"""

import os
import json
import hashlib
import traceback
from datetime import datetime, timedelta
from typing import Optional
from dataclasses import dataclass, field

import httpx

# Configuration
LINEAR_CONFIG = {
    "api_key": os.getenv("LINEAR_API_KEY"),
    "team_id": os.getenv("LINEAR_DEFAULT_TEAM_ID"),
    "app_name": os.getenv("LINEAR_APP_NAME", "Application"),
    "environment": os.getenv("ENVIRONMENT", "production"),
    "api_url": "https://api.linear.app/graphql",
}

# Deduplication cache (use Redis in production)
fault_cache: dict[str, dict] = {}
DEDUPE_WINDOW = timedelta(hours=1)


@dataclass
class FaultReport:
    """Fault report data structure."""
    message: str
    stack: Optional[str] = None
    severity: str = "error"  # critical, error, warning
    user_id: Optional[str] = None
    url: Optional[str] = None
    context: dict = field(default_factory=dict)
    metadata: dict = field(default_factory=dict)


@dataclass
class FaultResult:
    """Result of reporting a fault."""
    issue_id: str
    identifier: str
    url: str
    is_duplicate: bool


def generate_fault_hash(report: FaultReport) -> str:
    """Generate hash for deduplication."""
    first_line = report.stack.split("\n")[0] if report.stack else ""
    content = f"{report.message}:{first_line}"
    return hashlib.md5(content.encode()).hexdigest()


def check_duplicate(hash_key: str) -> Optional[dict]:
    """Check for duplicate fault."""
    record = fault_cache.get(hash_key)
    if not record:
        return None

    if datetime.utcnow() - record["last_seen"] > DEDUPE_WINDOW:
        del fault_cache[hash_key]
        return None

    return record


def get_priority(severity: str) -> int:
    """Get Linear priority from severity."""
    return {"critical": 1, "error": 2, "warning": 3}.get(severity, 2)


def format_description(report: FaultReport) -> str:
    """Format error report as markdown."""
    sections = [
        "## Error Details",
        f"**Message:** {report.message}",
        f"**Severity:** {report.severity}",
        f"**Environment:** {LINEAR_CONFIG['environment']}",
        f"**Timestamp:** {datetime.utcnow().isoformat()}",
    ]

    if report.url:
        sections.append(f"**URL:** {report.url}")
    if report.user_id:
        sections.append(f"**User ID:** {report.user_id}")
    if report.stack:
        sections.extend(["\n## Stack Trace", "```", report.stack, "```"])
    if report.context:
        sections.extend(["\n## Context", "```json", json.dumps(report.context, indent=2), "```"])
    if report.metadata:
        sections.extend(["\n## Metadata", "```json", json.dumps(report.metadata, indent=2), "```"])

    return "\n".join(sections)


async def linear_graphql(query: str, variables: Optional[dict] = None) -> dict:
    """Execute Linear GraphQL query."""
    if not LINEAR_CONFIG["api_key"]:
        raise ValueError("LINEAR_API_KEY not configured")

    async with httpx.AsyncClient() as client:
        response = await client.post(
            LINEAR_CONFIG["api_url"],
            json={"query": query, "variables": variables or {}},
            headers={
                "Content-Type": "application/json",
                "Authorization": LINEAR_CONFIG["api_key"],
            },
        )

        if response.status_code != 200:
            raise ValueError(f"Linear API error: {response.text}")

        result = response.json()
        if "errors" in result:
            raise ValueError(f"GraphQL error: {json.dumps(result['errors'])}")

        return result.get("data", {})


async def create_issue(title: str, description: str, priority: int) -> dict:
    """Create issue in Linear."""
    if not LINEAR_CONFIG["team_id"]:
        raise ValueError("LINEAR_DEFAULT_TEAM_ID not configured")

    result = await linear_graphql(
        """
        mutation CreateIssue($input: IssueCreateInput!) {
            issueCreate(input: $input) {
                success
                issue { id identifier url }
            }
        }
        """,
        {
            "input": {
                "teamId": LINEAR_CONFIG["team_id"],
                "title": title,
                "description": description,
                "priority": priority,
            }
        },
    )

    issue_create = result.get("issueCreate", {})
    if not issue_create.get("success"):
        raise ValueError("Failed to create issue")

    return issue_create["issue"]


async def add_comment(issue_id: str, body: str) -> None:
    """Add comment to existing issue."""
    await linear_graphql(
        """
        mutation CreateComment($input: CommentCreateInput!) {
            commentCreate(input: $input) { success }
        }
        """,
        {"input": {"issueId": issue_id, "body": body}},
    )


async def report_fault(report: FaultReport) -> Optional[FaultResult]:
    """Report a fault to Linear."""
    if not LINEAR_CONFIG["api_key"] or not LINEAR_CONFIG["team_id"]:
        print("[Linear Faults] Not configured, skipping")
        return None

    hash_key = generate_fault_hash(report)
    existing = check_duplicate(hash_key)

    if existing:
        existing["count"] += 1
        existing["last_seen"] = datetime.utcnow()
        fault_cache[hash_key] = existing

        try:
            await add_comment(
                existing["issue_id"],
                f"Error occurred again at {datetime.utcnow().isoformat()}. Count: {existing['count']}"
            )
        except Exception as e:
            print(f"[Linear Faults] Comment failed: {e}")

        return FaultResult(
            issue_id=existing["issue_id"],
            identifier="duplicate",
            url=f"https://linear.app/issue/{existing['issue_id']}",
            is_duplicate=True,
        )

    title = f"[{LINEAR_CONFIG['app_name']}] {report.severity.upper()}: {report.message[:100]}"
    description = format_description(report)
    priority = get_priority(report.severity)

    try:
        issue = await create_issue(title, description, priority)
        fault_cache[hash_key] = {
            "issue_id": issue["id"],
            "count": 1,
            "last_seen": datetime.utcnow(),
        }
        print(f"[Linear Faults] Created: {issue['identifier']}")
        return FaultResult(
            issue_id=issue["id"],
            identifier=issue["identifier"],
            url=issue["url"],
            is_duplicate=False,
        )
    except Exception as e:
        print(f"[Linear Faults] Failed: {e}")
        return None


async def report_error(
    error: Exception,
    user_id: Optional[str] = None,
    url: Optional[str] = None,
    action: Optional[str] = None,
    metadata: Optional[dict] = None,
) -> Optional[FaultResult]:
    """Report an Exception to Linear."""
    return await report_fault(FaultReport(
        message=str(error),
        stack=traceback.format_exc(),
        severity="error",
        user_id=user_id,
        url=url,
        context={"action": action} if action else {},
        metadata=metadata or {},
    ))


def is_configured() -> bool:
    """Check if Linear fault reporting is configured."""
    return bool(LINEAR_CONFIG["api_key"] and LINEAR_CONFIG["team_id"])


def clear_fault_cache() -> None:
    """Clear cache (for testing)."""
    fault_cache.clear()
