/**
 * Express middleware for handling Linear webhooks
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { LinearWebhookHandler } from './handler';
import type { WebhookPayload } from '../types';

export interface WebhookMiddlewareOptions {
  /** Path to mount the webhook endpoint */
  path?: string;
  /** Handler instance */
  handler: LinearWebhookHandler;
}

/**
 * Create Express middleware for Linear webhooks
 */
export function createWebhookMiddleware(
  options: WebhookMiddlewareOptions
): RequestHandler {
  const { handler } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const signature = req.headers['linear-signature'] as string | undefined;
      const payload = req.body as WebhookPayload;

      await handler.process(payload, signature);

      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Webhook processing error:', error);
      
      if (error instanceof Error && error.message === 'Invalid webhook signature') {
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }

      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

/**
 * Create a standalone webhook server
 */
export async function createWebhookServer(
  handler: LinearWebhookHandler,
  port: number = 3001
): Promise<void> {
  // Dynamic import for express to avoid bundling issues
  const express = await import('express');
  const app = express.default();

  app.use(express.json());

  app.post('/webhooks/linear', createWebhookMiddleware({ handler }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.listen(port, () => {
    console.log(`Linear webhook server listening on port ${port}`);
  });
}
