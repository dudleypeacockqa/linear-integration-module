# Environment Variables Template

Copy this to your `.env` file and fill in your values.

```bash
# =============================================================================
# LINEAR INTEGRATION CONFIGURATION
# =============================================================================

# -----------------------------------------------------------------------------
# Core API Configuration (Required)
# -----------------------------------------------------------------------------

# Your Linear API key (Personal API key or OAuth token)
# Get from: Linear Settings > API > Personal API keys
LINEAR_API_KEY=lin_api_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Your Linear team UUID
# Get by running: curl -X POST https://api.linear.app/graphql \
#   -H "Authorization: YOUR_API_KEY" -H "Content-Type: application/json" \
#   -d '{"query":"{ teams { nodes { id name } } }"}'
LINEAR_DEFAULT_TEAM_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# -----------------------------------------------------------------------------
# OAuth Configuration (Required for OAuth flow)
# -----------------------------------------------------------------------------

# OAuth Client ID from Linear OAuth application
# Get from: Linear Settings > API > OAuth Applications
LINEAR_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# OAuth Client Secret from Linear OAuth application
LINEAR_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# OAuth Redirect URI (must match Linear OAuth app settings exactly)
# Format: https://your-backend.com/api/auth/linear/callback
LINEAR_REDIRECT_URI=https://your-backend.com/api/auth/linear/callback

# -----------------------------------------------------------------------------
# Webhook Configuration (Required for webhooks)
# -----------------------------------------------------------------------------

# Webhook signing secret from Linear webhook settings
# Get from: Linear Settings > API > Webhooks
LINEAR_WEBHOOK_SECRET=lin_wh_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# -----------------------------------------------------------------------------
# Optional Configuration
# -----------------------------------------------------------------------------

# Application name (shown in Linear issue titles)
LINEAR_APP_NAME=YourAppName

# Bug label UUID for automatic labeling
# Get by running: curl -X POST https://api.linear.app/graphql \
#   -H "Authorization: YOUR_API_KEY" -H "Content-Type: application/json" \
#   -d '{"query":"{ issueLabels { nodes { id name } } }"}'
LINEAR_BUG_LABEL_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Environment name (shown in error reports)
ENVIRONMENT=production
```

## Quick Copy (Render .env bulk format)

```
LINEAR_API_KEY=
LINEAR_DEFAULT_TEAM_ID=
LINEAR_CLIENT_ID=
LINEAR_CLIENT_SECRET=
LINEAR_REDIRECT_URI=
LINEAR_WEBHOOK_SECRET=
LINEAR_APP_NAME=
LINEAR_BUG_LABEL_ID=
```
