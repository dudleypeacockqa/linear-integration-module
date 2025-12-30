# API Reference

## OAuth Endpoints

### GET /api/auth/linear

Initiate OAuth flow. Redirects to Linear authorization page.

**Response**: 302 Redirect to Linear

---

### GET /api/auth/linear/callback

OAuth callback endpoint. Exchanges authorization code for tokens.

**Query Parameters**:
- `code` (string): Authorization code from Linear
- `state` (string): State parameter for CSRF protection
- `error` (string, optional): Error message if authorization failed

**Response**: HTML page with access token

---

### GET /api/auth/linear/status

Check OAuth configuration status.

**Response**:
```json
{
  "configured": true,
  "redirectUri": "https://your-backend.com/api/auth/linear/callback"
}
```

---

## Webhook Endpoints

### POST /api/webhooks/linear

Receive webhook events from Linear.

**Headers**:
- `linear-signature`: HMAC-SHA256 signature
- `Content-Type`: application/json

**Request Body**:
```json
{
  "action": "create",
  "type": "Issue",
  "data": { ... },
  "createdAt": "2025-01-01T00:00:00.000Z",
  "organizationId": "org_xxx",
  "webhookId": "webhook_xxx",
  "webhookTimestamp": 1704067200
}
```

**Response**:
```json
{ "success": true }
```

**Error Responses**:
- `401`: Invalid webhook signature
- `400`: Invalid payload
- `500`: Processing failed

---

### GET /api/webhooks/linear/health

Webhook health check.

**Response**:
```json
{
  "status": "ok",
  "configured": true,
  "timestamp": "2025-01-01T00:00:00.000000"
}
```

---

## Fault Reporting

### Python

```python
from linear_faults import report_error, report_fault, FaultReport

# Report an exception
await report_error(
    error=exception,
    user_id="user_123",
    url="/api/endpoint",
    action="POST /api/users",
    metadata={"extra": "info"}
)

# Report a custom fault
await report_fault(FaultReport(
    message="Something went wrong",
    stack="Traceback...",
    severity="error",  # critical, error, warning
    user_id="user_123",
    url="/api/endpoint",
    context={"action": "some_action"},
    metadata={"key": "value"}
))
```

### TypeScript

```typescript
import { reportError, reportFault } from './faults';

// Report an exception
await reportError(error, {
    userId: 'user_123',
    url: '/api/endpoint',
    action: 'POST /api/users',
    metadata: { extra: 'info' }
});

// Report a custom fault
await reportFault({
    message: 'Something went wrong',
    stack: 'Error stack...',
    severity: 'error',
    userId: 'user_123',
    url: '/api/endpoint',
    context: { action: 'some_action' },
    metadata: { key: 'value' }
});
```

---

## Linear GraphQL Queries

### Create Issue

```graphql
mutation CreateIssue($input: IssueCreateInput!) {
  issueCreate(input: $input) {
    success
    issue {
      id
      identifier
      url
    }
  }
}
```

**Variables**:
```json
{
  "input": {
    "teamId": "team-uuid",
    "title": "Issue title",
    "description": "Issue description",
    "priority": 2,
    "labelIds": ["label-uuid"]
  }
}
```

### Add Comment

```graphql
mutation CreateComment($input: CommentCreateInput!) {
  commentCreate(input: $input) {
    success
  }
}
```

**Variables**:
```json
{
  "input": {
    "issueId": "issue-uuid",
    "body": "Comment body"
  }
}
```

### Get Teams

```graphql
query {
  teams {
    nodes {
      id
      name
    }
  }
}
```

### Get Labels

```graphql
query {
  issueLabels {
    nodes {
      id
      name
    }
  }
}
```
