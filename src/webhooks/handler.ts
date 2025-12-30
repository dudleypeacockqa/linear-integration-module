/**
 * Webhook Handler for Linear Events
 * Processes incoming webhooks and routes them to appropriate handlers
 */

import crypto from 'crypto';
import type { WebhookPayload, Logger } from '../types';

export interface WebhookConfig {
  /** Webhook signing secret for verification */
  signingSecret?: string;
  /** Logger instance */
  logger?: Logger;
}

export interface WebhookEvent {
  type: string;
  action: 'create' | 'update' | 'remove';
  data: Record<string, unknown>;
  timestamp: Date;
  organizationId: string;
}

type WebhookEventHandler = (event: WebhookEvent) => void | Promise<void>;

export class LinearWebhookHandler {
  private config: WebhookConfig;
  private handlers: Map<string, WebhookEventHandler[]> = new Map();
  private logger: Logger;

  constructor(config: WebhookConfig = {}) {
    this.config = config;
    this.logger = config.logger || {
      debug: console.debug,
      info: console.info,
      warn: console.warn,
      error: console.error,
    };
  }

  /**
   * Verify webhook signature
   */
  verifySignature(payload: string, signature: string): boolean {
    if (!this.config.signingSecret) {
      this.logger.warn('No signing secret configured, skipping signature verification');
      return true;
    }

    const expectedSignature = crypto
      .createHmac('sha256', this.config.signingSecret)
      .update(payload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Register a handler for a specific event type
   * Event types: Issue, Comment, Project, Cycle, Label, etc.
   * Actions: create, update, remove
   */
  on(eventType: string, handler: WebhookEventHandler): void {
    const handlers = this.handlers.get(eventType) || [];
    handlers.push(handler);
    this.handlers.set(eventType, handlers);
  }

  /**
   * Register handler for all events
   */
  onAny(handler: WebhookEventHandler): void {
    this.on('*', handler);
  }

  /**
   * Process incoming webhook payload
   */
  async process(payload: WebhookPayload, signature?: string): Promise<void> {
    // Verify signature if provided
    if (signature && !this.verifySignature(JSON.stringify(payload), signature)) {
      throw new Error('Invalid webhook signature');
    }

    const event: WebhookEvent = {
      type: payload.type,
      action: payload.action,
      data: payload.data,
      timestamp: new Date(payload.createdAt),
      organizationId: payload.organizationId,
    };

    this.logger.info(`Processing webhook: ${event.type}.${event.action}`);

    // Get handlers for this specific event type
    const specificHandlers = this.handlers.get(event.type) || [];
    const actionHandlers = this.handlers.get(`${event.type}.${event.action}`) || [];
    const wildcardHandlers = this.handlers.get('*') || [];

    const allHandlers = [...specificHandlers, ...actionHandlers, ...wildcardHandlers];

    // Execute all handlers
    await Promise.all(
      allHandlers.map(async (handler) => {
        try {
          await handler(event);
        } catch (error) {
          this.logger.error(`Webhook handler error: ${error}`);
        }
      })
    );
  }

  /**
   * Remove a handler
   */
  off(eventType: string, handler: WebhookEventHandler): void {
    const handlers = this.handlers.get(eventType) || [];
    const index = handlers.indexOf(handler);
    if (index > -1) {
      handlers.splice(index, 1);
      this.handlers.set(eventType, handlers);
    }
  }

  /**
   * Remove all handlers for an event type
   */
  removeAllListeners(eventType?: string): void {
    if (eventType) {
      this.handlers.delete(eventType);
    } else {
      this.handlers.clear();
    }
  }
}
