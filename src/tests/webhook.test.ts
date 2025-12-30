/**
 * Webhook Handler Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LinearWebhookHandler } from '../webhooks/handler';
import type { WebhookPayload } from '../types';

describe('LinearWebhookHandler', () => {
  let handler: LinearWebhookHandler;

  beforeEach(() => {
    handler = new LinearWebhookHandler({
      signingSecret: 'test-secret',
    });
  });

  describe('event registration', () => {
    it('should register and call handlers for specific events', async () => {
      const mockHandler = vi.fn();
      handler.on('Issue', mockHandler);

      const payload: WebhookPayload = {
        action: 'create',
        type: 'Issue',
        data: { id: 'issue-1', title: 'Test Issue' },
        createdAt: new Date().toISOString(),
        organizationId: 'org-1',
        webhookId: 'webhook-1',
        webhookTimestamp: Date.now(),
      };

      await handler.process(payload);

      expect(mockHandler).toHaveBeenCalledTimes(1);
      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'Issue',
          action: 'create',
        })
      );
    });

    it('should call wildcard handlers for all events', async () => {
      const mockHandler = vi.fn();
      handler.onAny(mockHandler);

      const payload: WebhookPayload = {
        action: 'update',
        type: 'Comment',
        data: { id: 'comment-1' },
        createdAt: new Date().toISOString(),
        organizationId: 'org-1',
        webhookId: 'webhook-1',
        webhookTimestamp: Date.now(),
      };

      await handler.process(payload);

      expect(mockHandler).toHaveBeenCalledTimes(1);
    });

    it('should support action-specific handlers', async () => {
      const createHandler = vi.fn();
      const updateHandler = vi.fn();

      handler.on('Issue.create', createHandler);
      handler.on('Issue.update', updateHandler);

      const createPayload: WebhookPayload = {
        action: 'create',
        type: 'Issue',
        data: { id: 'issue-1' },
        createdAt: new Date().toISOString(),
        organizationId: 'org-1',
        webhookId: 'webhook-1',
        webhookTimestamp: Date.now(),
      };

      await handler.process(createPayload);

      expect(createHandler).toHaveBeenCalledTimes(1);
      expect(updateHandler).not.toHaveBeenCalled();
    });
  });

  describe('handler removal', () => {
    it('should remove specific handlers', async () => {
      const mockHandler = vi.fn();
      handler.on('Issue', mockHandler);
      handler.off('Issue', mockHandler);

      const payload: WebhookPayload = {
        action: 'create',
        type: 'Issue',
        data: { id: 'issue-1' },
        createdAt: new Date().toISOString(),
        organizationId: 'org-1',
        webhookId: 'webhook-1',
        webhookTimestamp: Date.now(),
      };

      await handler.process(payload);

      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should remove all listeners for an event type', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      handler.on('Issue', handler1);
      handler.on('Issue', handler2);
      handler.removeAllListeners('Issue');

      const payload: WebhookPayload = {
        action: 'create',
        type: 'Issue',
        data: { id: 'issue-1' },
        createdAt: new Date().toISOString(),
        organizationId: 'org-1',
        webhookId: 'webhook-1',
        webhookTimestamp: Date.now(),
      };

      await handler.process(payload);

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
    });
  });

  describe('signature verification', () => {
    it('should skip verification when no secret configured', async () => {
      const noSecretHandler = new LinearWebhookHandler({});
      const mockHandler = vi.fn();
      noSecretHandler.on('Issue', mockHandler);

      const payload: WebhookPayload = {
        action: 'create',
        type: 'Issue',
        data: { id: 'issue-1' },
        createdAt: new Date().toISOString(),
        organizationId: 'org-1',
        webhookId: 'webhook-1',
        webhookTimestamp: Date.now(),
      };

      await noSecretHandler.process(payload, 'invalid-signature');

      expect(mockHandler).toHaveBeenCalled();
    });
  });
});
