# Linear Integration Module

A reusable module for integrating [Linear](https://linear.app) into any application. Supports OAuth 2.0 authentication, webhook handling, and fault/error management.

## Features

- **OAuth 2.0 Authentication** with PKCE support
- **Webhook Handler** for real-time event processing
- **Fault Management** for automatic error reporting to Linear
- **CLI Setup Tool** for easy configuration
- **TypeScript Support** with full type definitions
- **Express Middleware** for webhook endpoints

## Installation

```bash
npm install @flocommand/linear-integration
```

## Quick Start

### 1. Create a Linear OAuth Application

1. Go to [Linear Settings > API](https://linear.app/settings/api)
2. Click "New OAuth application"
3. Fill in your application details:
   - **Application name**: Your app name (e.g., "FloCommand", "Claude Code")
   - **Developer name**: Your name or company
   - **Callback URLs**: `http://localhost:3847/auth/callback` (for development)
4. Save the **Client ID** and **Client Secret**

### 2. Run the Setup CLI

```bash
npx @flocommand/linear-integration setup
```

This will guide you through the OAuth flow and save your tokens to `.env.linear`.

### 3. Use in Your Application

```typescript
import { LinearClient } from '@flocommand/linear-integration';

const client = new LinearClient({
  accessToken: process.env.LINEAR_ACCESS_TOKEN,
  faults: {
    teamId: 'YOUR_TEAM_ID',
    appName: 'MyApp',
    environment: 'production',
  },
});

// Report an error
try {
  await riskyOperation();
} catch (error) {
  await client.reportError(error, {
    userId: currentUser.id,
    action: 'riskyOperation',
  });
}
```

## API Reference

### LinearClient

The main client that combines OAuth, webhooks, and fault management.

```typescript
const client = new LinearClient({
  // Authentication (choose one)
  apiKey: 'lin_api_xxx',           // API key
  accessToken: 'oauth_token',       // OAuth access token
  
  // OAuth configuration (for auth flows)
  oauth: {
    clientId: 'xxx',
    clientSecret: 'xxx',
    redirectUri: 'http://localhost:3000/callback',
  },
  
  // Webhook configuration
  webhook: {
    signingSecret: 'webhook_secret',
  },
  
  // Fault management configuration
  faults: {
    teamId: 'team_xxx',
    appName: 'MyApp',
    environment: 'production',
    defaultPriority: 2,
    labelIds: ['label_xxx'],
    deduplicate: true,
    dedupeWindow: 3600000, // 1 hour
  },
});
```

### OAuth Authentication

```typescript
import { LinearAuthClient } from '@flocommand/linear-integration';

const auth = new LinearAuthClient({
  clientId: 'xxx',
  clientSecret: 'xxx',
  redirectUri: 'http://localhost:3000/callback',
  scopes: ['read', 'write', 'issues:create'],
});

// Generate PKCE challenge (recommended)
const pkce = auth.generatePKCE();
const state = auth.generateState();

// Get authorization URL
const authUrl = auth.getAuthorizationUrl({ state, pkce });

// Exchange code for token
const tokens = await auth.exchangeCode(code, pkce.codeVerifier);

// Refresh token
const newTokens = await auth.refreshToken(tokens.refresh_token);
```

### Webhook Handling

```typescript
import { LinearWebhookHandler, createWebhookMiddleware } from '@flocommand/linear-integration';
import express from 'express';

const webhookHandler = new LinearWebhookHandler({
  signingSecret: process.env.LINEAR_WEBHOOK_SECRET,
});

// Register event handlers
webhookHandler.on('Issue', (event) => {
  console.log(`Issue ${event.action}:`, event.data);
});

webhookHandler.on('Issue.create', (event) => {
  console.log('New issue created:', event.data);
});

webhookHandler.onAny((event) => {
  console.log(`Event: ${event.type}.${event.action}`);
});

// Express middleware
const app = express();
app.use(express.json());
app.post('/webhooks/linear', createWebhookMiddleware({ handler: webhookHandler }));
```

### Fault Management

```typescript
import { FaultManager } from '@flocommand/linear-integration';

const faults = new FaultManager({
  accessToken: process.env.LINEAR_ACCESS_TOKEN,
  teamId: 'team_xxx',
  appName: 'MyApp',
  environment: 'production',
  defaultPriority: 2, // High
  deduplicate: true,
});

// Report a fault
const result = await faults.report({
  message: 'Database connection failed',
  severity: 'critical',
  stack: error.stack,
  context: { database: 'primary', retry: 3 },
  url: '/api/users',
  userId: 'user_123',
});

console.log(`Created issue: ${result.identifier}`);

// Report an Error object
await faults.reportError(error, { context: 'additional info' });

// Global error handler
process.on('uncaughtException', faults.createGlobalHandler());

// Express error middleware
app.use(faults.expressErrorHandler());
```

## Environment Variables

```bash
# OAuth Configuration
LINEAR_CLIENT_ID=your_client_id
LINEAR_CLIENT_SECRET=your_client_secret
LINEAR_REDIRECT_URI=http://localhost:3000/callback

# API Key (alternative to OAuth)
LINEAR_API_KEY=lin_api_xxx

# Access Token (from OAuth flow)
LINEAR_ACCESS_TOKEN=xxx

# Webhook
LINEAR_WEBHOOK_SECRET=xxx

# Fault Management
LINEAR_DEFAULT_TEAM_ID=team_xxx
```

## Integration Examples

### Claude Code / Cursor Integration

Create a `.env` file with your Linear credentials and use the fault manager to report errors:

```typescript
// error-handler.ts
import { FaultManager } from '@flocommand/linear-integration';

export const linearFaults = new FaultManager({
  accessToken: process.env.LINEAR_ACCESS_TOKEN!,
  teamId: process.env.LINEAR_DEFAULT_TEAM_ID!,
  appName: 'Claude Code',
  environment: process.env.NODE_ENV || 'development',
});

// Use in your application
try {
  // ... code
} catch (error) {
  await linearFaults.reportError(error as Error);
}
```

### FloCommand Integration

```typescript
import { LinearClient } from '@flocommand/linear-integration';

const linear = new LinearClient({
  accessToken: process.env.LINEAR_ACCESS_TOKEN,
  faults: {
    teamId: process.env.LINEAR_DEFAULT_TEAM_ID!,
    appName: 'FloCommand',
    environment: process.env.NODE_ENV,
    labelIds: [process.env.LINEAR_BUG_LABEL_ID!],
  },
});

// Create issue
await linear.createIssue({
  title: 'New feature request',
  description: 'Description here',
  teamId: 'team_xxx',
  priority: 3,
});

// Report fault
await linear.reportFault({
  message: 'API rate limit exceeded',
  severity: 'warning',
  context: { endpoint: '/api/proposals', limit: 100 },
});
```

### Webhook Server for Error Notifications

```typescript
import { LinearWebhookHandler, createWebhookServer } from '@flocommand/linear-integration';

const handler = new LinearWebhookHandler({
  signingSecret: process.env.LINEAR_WEBHOOK_SECRET,
});

// Listen for issue status changes
handler.on('Issue.update', async (event) => {
  const issue = event.data as any;
  if (issue.state?.name === 'Done') {
    console.log(`Issue ${issue.identifier} completed!`);
    // Send notification, update dashboard, etc.
  }
});

// Start webhook server
await createWebhookServer(handler, 3001);
```

## MCP Server Configuration

To use with Claude Code's Linear MCP server, you'll need to authenticate first:

1. Run the setup CLI: `npx @flocommand/linear-integration setup`
2. Copy the access token from `.env.linear`
3. Configure your MCP server with the token

## Testing

```bash
npm test
npm run test:coverage
```

## License

MIT

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests to our repository.
