/**
 * Render Webhook Endpoint Example
 * 
 * Add this to your FloCommand/Sales Proposals Express app
 * to receive Linear webhook events.
 */

import express, { Router } from 'express';
import { LinearWebhookHandler } from '@flocommand/linear-integration';

const router = Router();

// Initialize webhook handler
const webhookHandler = new LinearWebhookHandler({
  signingSecret: process.env.LINEAR_WEBHOOK_SECRET,
});

// Register event handlers

// Handle issue updates (e.g., status changes)
webhookHandler.on('Issue.update', async (event) => {
  const issue = event.data as any;
  console.log(`[Linear Webhook] Issue updated: ${issue.identifier}`);
  
  // Example: Notify when a bug is fixed
  if (issue.state?.name === 'Done' && issue.labels?.some((l: any) => l.name === 'bug')) {
    console.log(`Bug ${issue.identifier} has been resolved!`);
    // Send notification, update dashboard, etc.
  }
});

// Handle new issues
webhookHandler.on('Issue.create', async (event) => {
  const issue = event.data as any;
  console.log(`[Linear Webhook] New issue: ${issue.identifier} - ${issue.title}`);
});

// Handle comments (e.g., for Slack notifications)
webhookHandler.on('Comment.create', async (event) => {
  const comment = event.data as any;
  console.log(`[Linear Webhook] New comment on issue`);
});

// Log all events for debugging
if (process.env.NODE_ENV !== 'production') {
  webhookHandler.onAny((event) => {
    console.log(`[Linear Webhook] ${event.type}.${event.action}:`, event.data);
  });
}

// Webhook endpoint
router.post('/webhooks/linear', express.json(), async (req, res) => {
  try {
    const signature = req.headers['linear-signature'] as string | undefined;
    await webhookHandler.process(req.body, signature);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('[Linear Webhook] Error:', error);
    
    if (error instanceof Error && error.message === 'Invalid webhook signature') {
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }
    
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Health check for the webhook endpoint
router.get('/webhooks/linear/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;

/*
Usage in your main Express app:

import linearWebhooks from './routes/linear-webhooks';

app.use(linearWebhooks);

Then configure the webhook in Linear:
1. Go to Linear Settings > API > Webhooks
2. Click "+ New webhook"
3. Set URL to: https://your-app.onrender.com/webhooks/linear
4. Select the events you want to receive
5. Copy the signing secret to LINEAR_WEBHOOK_SECRET env var
*/
