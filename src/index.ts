/**
 * Linear Integration Module
 * 
 * A reusable module for integrating Linear into any application.
 * Supports OAuth 2.0 authentication, webhook handling, and fault management.
 */

export { LinearAuthClient, type OAuthConfig, type TokenResponse } from './auth/oauth';
export { LinearWebhookHandler, type WebhookEvent, type WebhookConfig } from './webhooks/handler';
export { FaultManager, type FaultReport, type FaultConfig } from './faults/manager';
export { LinearClient } from './client';
export { createWebhookMiddleware } from './webhooks/middleware';
export * from './types';

// Re-export Linear SDK types for convenience
export { LinearClient as LinearSDKClient } from '@linear/sdk';
