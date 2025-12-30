# Linear Integration Setup Guide

This guide covers setting up Linear OAuth, webhooks, and fault management for your application.

## Prerequisites

1. Linear account with admin access to create OAuth applications
2. A deployed backend with HTTPS (required for OAuth callbacks)
3. Access to your Linear workspace settings

## Step 1: Create Linear OAuth Application

1. Go to [Linear Settings > API > OAuth Applications](https://linear.app/settings/api)
2. Click **"Create OAuth Application"**
3. Fill in:
   - **Application name**: Your app name (e.g., "MyApp Integration")
   - **Redirect URLs**: `https://your-backend.com/api/auth/linear/callback`
   - **Description**: Brief description
4. Save and note down:
   - **Client ID**
   - **Client Secret**

## Step 2: Get Your Team ID

Run this GraphQL query to get your team ID:

```bash
curl -X POST https://api.linear.app/graphql \
  -H "Authorization: YOUR_LINEAR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ teams { nodes { id name } } }"}'
```

## Step 3: Create Webhook

1. Go to [Linear Settings > API > Webhooks](https://linear.app/settings/api)
2. Click **"Create Webhook"**
3. Fill in:
   - **Label**: Your app name
   - **URL**: `https://your-backend.com/api/webhooks/linear`
   - **Events**: Select Issue, Comment, Project (as needed)
4. Save and note down the **Signing Secret**

## Step 4: Configure Environment Variables

```bash
# Required for all features
LINEAR_API_KEY=lin_api_xxxxxxxx
LINEAR_DEFAULT_TEAM_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Required for OAuth
LINEAR_CLIENT_ID=xxxxxxxx
LINEAR_CLIENT_SECRET=xxxxxxxx
LINEAR_REDIRECT_URI=https://your-backend.com/api/auth/linear/callback

# Required for webhooks
LINEAR_WEBHOOK_SECRET=lin_wh_xxxxxxxx

# Optional
LINEAR_APP_NAME=YourAppName
LINEAR_BUG_LABEL_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

## Step 5: Integration

### Python/FastAPI

```python
from fastapi import FastAPI
from python import oauth_router, webhooks_router

app = FastAPI()

# Register routes (before auth middleware)
app.include_router(oauth_router, prefix="/api")
app.include_router(webhooks_router, prefix="/api")
```

### TypeScript/Express

```typescript
import express from 'express';
import { linearOAuthRouter, linearWebhooksRouter } from './src';

const app = express();

// Register routes (before auth middleware)
app.use('/api', linearOAuthRouter);
app.use('/api', linearWebhooksRouter);
```

## Step 6: Error Reporting

### Python

```python
from python import report_error

try:
    do_something()
except Exception as e:
    await report_error(e, user_id="user_123", url="/api/endpoint")
```

### TypeScript

```typescript
import { reportError } from './src';

try {
    doSomething();
} catch (error) {
    await reportError(error, { userId: 'user_123', url: '/api/endpoint' });
}
```

## Testing

### Check OAuth Status

```bash
curl https://your-backend.com/api/auth/linear/status
```

### Check Webhook Health

```bash
curl https://your-backend.com/api/webhooks/linear/health
```

### Test Linear API Connection

```bash
curl -X POST https://api.linear.app/graphql \
  -H "Authorization: YOUR_LINEAR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ viewer { id name } }"}'
```

## Troubleshooting

### 405 Method Not Allowed on Webhook

Ensure the webhook URL ends with the POST endpoint path, not a trailing slash.

### Invalid Signature

Check that `LINEAR_WEBHOOK_SECRET` matches the signing secret from Linear.

### OAuth Redirect Error

Ensure `LINEAR_REDIRECT_URI` matches exactly what's configured in Linear OAuth app settings.
