"""
Linear Webhooks Module (FastAPI)

Handles incoming webhooks from Linear for real-time event processing.

Usage:
    from linear_webhooks import router as linear_webhooks_router
    app.include_router(linear_webhooks_router, prefix="/api")
"""

import os
import hmac
import hashlib
from datetime import datetime
from typing import Optional, Callable, Awaitable

from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel

router = APIRouter(prefix="/webhooks/linear", tags=["linear-webhooks"])

LINEAR_WEBHOOK_SECRET = os.getenv("LINEAR_WEBHOOK_SECRET")

# Event handlers registry
_event_handlers: dict[str, list[Callable]] = {}


class LinearWebhookPayload(BaseModel):
    """Linear webhook payload structure."""
    action: str  # create, update, remove
    type: str    # Issue, Comment, Project, Cycle
    data: dict
    createdAt: str
    organizationId: str
    webhookId: str
    webhookTimestamp: int


def verify_signature(payload: bytes, signature: Optional[str]) -> bool:
    """Verify Linear webhook signature."""
    if not LINEAR_WEBHOOK_SECRET:
        return True  # Skip verification if not configured

    if not signature:
        return False

    expected = hmac.new(
        LINEAR_WEBHOOK_SECRET.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()

    return hmac.compare_digest(signature, expected)


def on_event(event_type: str):
    """Decorator to register event handlers.
    
    Usage:
        @on_event("Issue.create")
        async def handle_issue_created(payload):
            print(f"Issue created: {payload.data}")
    """
    def decorator(func: Callable[[LinearWebhookPayload], Awaitable[None]]):
        key = event_type
        if key not in _event_handlers:
            _event_handlers[key] = []
        _event_handlers[key].append(func)
        return func
    return decorator


async def dispatch_event(payload: LinearWebhookPayload):
    """Dispatch event to registered handlers."""
    event_key = f"{payload.type}.{payload.action}"
    
    # Call specific handlers
    for handler in _event_handlers.get(event_key, []):
        await handler(payload)
    
    # Call wildcard handlers
    for handler in _event_handlers.get(f"{payload.type}.*", []):
        await handler(payload)
    
    for handler in _event_handlers.get("*", []):
        await handler(payload)


@router.post("")
async def webhook_handler(request: Request):
    """Linear webhook endpoint. POST /webhooks/linear"""
    raw_body = await request.body()
    signature = request.headers.get("linear-signature")

    if not verify_signature(raw_body, signature):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    try:
        body = await request.json()
        payload = LinearWebhookPayload(**body)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid payload: {e}")

    print(f"[Linear Webhook] {payload.type}.{payload.action}")

    try:
        await dispatch_event(payload)
        return JSONResponse({"success": True})
    except Exception as e:
        print(f"[Linear Webhook] Error: {e}")
        raise HTTPException(status_code=500, detail="Processing failed")


@router.get("/health")
async def webhook_health():
    """Health check. GET /webhooks/linear/health"""
    return JSONResponse({
        "status": "ok",
        "configured": bool(LINEAR_WEBHOOK_SECRET),
        "timestamp": datetime.utcnow().isoformat(),
    })


# Default handlers (can be overridden)
@on_event("Issue.create")
async def default_issue_created(payload: LinearWebhookPayload):
    """Default handler for issue creation."""
    issue = payload.data
    print(f"[Linear] Issue created: {issue.get('identifier')} - {issue.get('title')}")


@on_event("Issue.update")
async def default_issue_updated(payload: LinearWebhookPayload):
    """Default handler for issue updates."""
    issue = payload.data
    state = issue.get("state", {})
    if state.get("type") == "completed":
        print(f"[Linear] Issue completed: {issue.get('identifier')}")
