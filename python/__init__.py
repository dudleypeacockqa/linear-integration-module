"""
Linear Integration Module - Python

Provides OAuth, webhooks, and fault management for Linear integration.
"""

from .linear_oauth import router as oauth_router
from .linear_webhooks import router as webhooks_router, on_event, LinearWebhookPayload
from .linear_faults import (
    report_error,
    report_fault,
    FaultReport,
    FaultResult,
    is_configured,
    clear_fault_cache,
)

__all__ = [
    # OAuth
    "oauth_router",
    # Webhooks
    "webhooks_router",
    "on_event",
    "LinearWebhookPayload",
    # Faults
    "report_error",
    "report_fault",
    "FaultReport",
    "FaultResult",
    "is_configured",
    "clear_fault_cache",
]
