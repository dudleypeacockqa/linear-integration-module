"""
Linear OAuth Module (FastAPI)

Handles OAuth 2.0 authentication with Linear using PKCE.
Can be used standalone or integrated into existing FastAPI applications.

Usage:
    from linear_oauth import router as linear_oauth_router
    app.include_router(linear_oauth_router, prefix="/api")
"""

import os
import hashlib
import secrets
import base64
from datetime import datetime, timedelta
from typing import Optional
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse

router = APIRouter(prefix="/auth/linear", tags=["linear-oauth"])

# PKCE store (use Redis in production)
pkce_store: dict[str, dict] = {}


def get_linear_config() -> dict:
    """Get Linear OAuth configuration from environment."""
    return {
        "client_id": os.getenv("LINEAR_CLIENT_ID"),
        "client_secret": os.getenv("LINEAR_CLIENT_SECRET"),
        "redirect_uri": os.getenv("LINEAR_REDIRECT_URI"),
        "token_url": "https://api.linear.app/oauth/token",
        "authorize_url": "https://linear.app/oauth/authorize",
        "scopes": ["read", "write", "issues:create", "comments:create"],
    }


def generate_pkce() -> tuple[str, str]:
    """Generate PKCE verifier and challenge."""
    verifier = secrets.token_urlsafe(32)
    challenge = hashlib.sha256(verifier.encode()).digest()
    challenge_b64 = base64.urlsafe_b64encode(challenge).decode().rstrip("=")
    return verifier, challenge_b64


def generate_state() -> str:
    """Generate state parameter."""
    return secrets.token_hex(16)


def cleanup_expired_pkce():
    """Remove expired PKCE entries."""
    now = datetime.utcnow()
    expired = [k for k, v in pkce_store.items() if v["expires_at"] < now]
    for key in expired:
        del pkce_store[key]


@router.get("")
async def initiate_oauth():
    """Initiate Linear OAuth flow. GET /auth/linear"""
    config = get_linear_config()

    if not config["client_id"]:
        raise HTTPException(status_code=500, detail="LINEAR_CLIENT_ID not configured")

    verifier, challenge = generate_pkce()
    state = generate_state()

    pkce_store[state] = {
        "verifier": verifier,
        "expires_at": datetime.utcnow() + timedelta(minutes=10),
    }
    cleanup_expired_pkce()

    params = {
        "client_id": config["client_id"],
        "redirect_uri": config["redirect_uri"],
        "response_type": "code",
        "scope": ",".join(config["scopes"]),
        "state": state,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
    }

    auth_url = f"{config['authorize_url']}?{urlencode(params)}"
    return RedirectResponse(url=auth_url)


@router.get("/callback")
async def oauth_callback(
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
):
    """OAuth callback. GET /auth/linear/callback"""
    if error:
        raise HTTPException(status_code=400, detail=f"Authorization failed: {error}")

    if not code or not state:
        raise HTTPException(status_code=400, detail="Missing code or state")

    pkce_data = pkce_store.get(state)
    if not pkce_data:
        raise HTTPException(status_code=400, detail="Invalid or expired state")

    if pkce_data["expires_at"] < datetime.utcnow():
        del pkce_store[state]
        raise HTTPException(status_code=400, detail="Session expired")

    verifier = pkce_data["verifier"]
    del pkce_store[state]

    config = get_linear_config()

    if not config["client_id"] or not config["client_secret"]:
        raise HTTPException(status_code=500, detail="OAuth not configured")

    async with httpx.AsyncClient() as client:
        response = await client.post(
            config["token_url"],
            data={
                "code": code,
                "redirect_uri": config["redirect_uri"],
                "client_id": config["client_id"],
                "client_secret": config["client_secret"],
                "grant_type": "authorization_code",
                "code_verifier": verifier,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )

        if response.status_code != 200:
            raise HTTPException(status_code=500, detail="Token exchange failed")

        tokens = response.json()

    # Return success page with token
    return HTMLResponse(content=f"""
    <!DOCTYPE html>
    <html>
    <head><title>Linear Auth Success</title></head>
    <body style="font-family: system-ui; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #1a1a2e; color: white;">
        <div style="text-align: center; max-width: 600px;">
            <h1 style="color: #5e6ad2;">Linear Authentication Successful!</h1>
            <p>Access Token:</p>
            <code style="background: rgba(255,255,255,0.1); padding: 1rem; display: block; word-break: break-all;">{tokens['access_token']}</code>
            <p style="margin-top: 1rem;">Add to your environment: LINEAR_ACCESS_TOKEN={tokens['access_token']}</p>
        </div>
    </body>
    </html>
    """)


@router.get("/status")
async def oauth_status():
    """Check OAuth configuration. GET /auth/linear/status"""
    config = get_linear_config()
    return JSONResponse({
        "configured": bool(config["client_id"] and config["client_secret"]),
        "redirectUri": config["redirect_uri"],
    })
