# Linear Integration Module

A standardized, reusable module for integrating Linear into your applications. Supports OAuth authentication, webhooks, and automatic fault/error reporting with deduplication.

## Features

- **OAuth 2.0 with PKCE** - Secure authentication flow for Linear
- **Webhook Handler** - Process Linear events (Issue, Comment, Project, Cycle)
- **Fault Manager** - Automatic error reporting to Linear with deduplication
- **Multi-Language** - TypeScript/Node.js and Python/FastAPI implementations
- **Production Ready** - Used in FloCommand and other production applications

## Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/dudleypeacockqa/linear-integration-module.git

# TypeScript
cd linear-integration-module
npm install

# Python
cd linear-integration-module/python
pip install -r requirements.txt
```

### Environment Variables

```bash
# Required
LINEAR_API_KEY=lin_api_xxxxxxxx
LINEAR_DEFAULT_TEAM_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# OAuth
LINEAR_CLIENT_ID=xxxxxxxx
LINEAR_CLIENT_SECRET=xxxxxxxx
LINEAR_REDIRECT_URI=https://your-backend.com/api/auth/linear/callback

# Webhooks
LINEAR_WEBHOOK_SECRET=lin_wh_xxxxxxxx

# Optional
LINEAR_APP_NAME=YourAppName
LINEAR_BUG_LABEL_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

## Usage

### Python/FastAPI

```python
from fastapi import FastAPI
from python import oauth_router, webhooks_router, report_error, on_event

app = FastAPI()

# Register routes (before auth middleware)
app.include_router(oauth_router, prefix="/api")
app.include_router(webhooks_router, prefix="/api")

# Custom webhook handler
@on_event("Issue.create")
async def handle_issue_created(payload):
    print(f"Issue created: {payload.data}")

# Error reporting
try:
    do_something()
except Exception as e:
    await report_error(e, user_id="user_123", url="/api/endpoint")
```

### TypeScript/Express

```typescript
import express from 'express';
import { linearOAuthRouter, linearWebhooksRouter, reportError } from './src';

const app = express();

// Register routes (before auth middleware)
app.use('/api', linearOAuthRouter);
app.use('/api', linearWebhooksRouter);

// Error reporting
try {
    doSomething();
} catch (error) {
    await reportError(error, { userId: 'user_123', url: '/api/endpoint' });
}
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/linear` | GET | Initiate OAuth flow |
| `/api/auth/linear/callback` | GET | OAuth callback (PKCE) |
| `/api/auth/linear/status` | GET | Check OAuth configuration |
| `/api/webhooks/linear` | POST | Receive Linear webhook events |
| `/api/webhooks/linear/health` | GET | Webhook health check |

## Setup Guide

### 1. Create Linear OAuth Application

1. Go to [Linear Settings > API > OAuth Applications](https://linear.app/settings/api)
2. Create new application with redirect URL: `https://your-backend.com/api/auth/linear/callback`
3. Note the Client ID and Client Secret

### 2. Get Team ID

```bash
curl -X POST https://api.linear.app/graphql \
  -H "Authorization: YOUR_LINEAR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ teams { nodes { id name } } }"}'
```

### 3. Create Webhook

1. Go to [Linear Settings > API > Webhooks](https://linear.app/settings/api)
2. Create webhook with URL: `https://your-backend.com/api/webhooks/linear`
3. Select events: Issue, Comment, Project
4. Note the Signing Secret

### 4. Configure Environment

Set all `LINEAR_*` environment variables in your deployment platform.

## Fault Reporting

The fault manager automatically:
- Creates Linear issues for errors
- Deduplicates within 1-hour window
- Adds comments for duplicate occurrences
- Maps severity to Linear priority

### Priority Mapping

| Severity | Linear Priority |
|----------|-----------------|
| critical | 1 (Urgent) |
| error | 2 (High) |
| warning | 3 (Normal) |

### Error Format

```markdown
## Error Details
**Message:** Error message
**Severity:** error
**Environment:** production
**Timestamp:** 2025-01-01T00:00:00Z
**URL:** /api/endpoint
**User ID:** user_123

## Stack Trace
```
Traceback...
```

## Context
```json
{"action": "POST /api/endpoint"}
```
```

## Documentation

- [Setup Guide](docs/SETUP_GUIDE.md) - Complete setup instructions
- [Environment Template](docs/ENV_TEMPLATE.md) - Environment variables reference
- [API Reference](docs/API_REFERENCE.md) - Endpoint and function documentation

## Project Structure

```
linear-integration-module/
├── src/                    # TypeScript implementation
│   ├── auth/               # OAuth module
│   ├── webhooks/           # Webhook handler
│   ├── faults/             # Fault manager
│   ├── cli/                # CLI tools
│   └── tests/              # Tests
├── python/                 # Python/FastAPI implementation
│   ├── linear_oauth.py     # OAuth routes
│   ├── linear_webhooks.py  # Webhook routes
│   ├── linear_faults.py    # Fault manager
│   └── requirements.txt    # Dependencies
├── docs/                   # Documentation
│   ├── SETUP_GUIDE.md
│   ├── ENV_TEMPLATE.md
│   └── API_REFERENCE.md
└── examples/               # Example integrations
```

## Testing

```bash
# Check OAuth status
curl https://your-backend.com/api/auth/linear/status

# Check webhook health
curl https://your-backend.com/api/webhooks/linear/health

# Test Linear API
curl -X POST https://api.linear.app/graphql \
  -H "Authorization: YOUR_LINEAR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ viewer { id name } }"}'
```

## Used In

- **FloCommand** - Sales proposal management platform
- Works with Claude Code, Cursor, and other development tools

## License

MIT

## Contributing

1. Fork the repository
2. Create a feature branch
3. Submit a pull request

---

**Repository**: https://github.com/dudleypeacockqa/linear-integration-module
