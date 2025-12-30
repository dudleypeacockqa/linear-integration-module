/**
 * Unified Linear Client
 * Combines OAuth, webhooks, and fault management into a single interface
 */

import { LinearClient as LinearSDK } from '@linear/sdk';
import { LinearAuthClient, type OAuthConfig, type TokenResponse } from './auth/oauth';
import { LinearWebhookHandler, type WebhookConfig } from './webhooks/handler';
import { FaultManager, type FaultConfig, type FaultReport } from './faults/manager';
import type { LinearConfig, LinearTeam, LinearUser, IssueCreateInput } from './types';

export interface LinearClientOptions {
  /** OAuth configuration */
  oauth?: OAuthConfig;
  /** API key (alternative to OAuth) */
  apiKey?: string;
  /** Access token from OAuth flow */
  accessToken?: string;
  /** Webhook configuration */
  webhook?: WebhookConfig;
  /** Fault management configuration (partial, requires teamId at minimum) */
  faults?: Omit<FaultConfig, 'accessToken'>;
}

export class LinearClient {
  private sdk?: LinearSDK;
  private authClient?: LinearAuthClient;
  private webhookHandler?: LinearWebhookHandler;
  private faultManager?: FaultManager;
  private options: LinearClientOptions;

  constructor(options: LinearClientOptions) {
    this.options = options;

    // Initialize OAuth client if config provided
    if (options.oauth) {
      this.authClient = new LinearAuthClient(options.oauth);
    }

    // Initialize SDK if credentials provided
    if (options.apiKey) {
      this.sdk = new LinearSDK({ apiKey: options.apiKey });
    } else if (options.accessToken) {
      this.sdk = new LinearSDK({ accessToken: options.accessToken });
    }

    // Initialize webhook handler if config provided
    if (options.webhook) {
      this.webhookHandler = new LinearWebhookHandler(options.webhook);
    }

    // Initialize fault manager if config provided and we have credentials
    if (options.faults && (options.apiKey || options.accessToken)) {
      this.faultManager = new FaultManager({
        ...options.faults,
        accessToken: (options.apiKey || options.accessToken)!,
      });
    }
  }

  /**
   * Get the OAuth client for authentication flows
   */
  get auth(): LinearAuthClient {
    if (!this.authClient) {
      throw new Error('OAuth not configured. Provide oauth config in constructor.');
    }
    return this.authClient;
  }

  /**
   * Get the webhook handler for event processing
   */
  get webhooks(): LinearWebhookHandler {
    if (!this.webhookHandler) {
      this.webhookHandler = new LinearWebhookHandler(this.options.webhook || {});
    }
    return this.webhookHandler;
  }

  /**
   * Get the fault manager for error reporting
   */
  get faults(): FaultManager {
    if (!this.faultManager) {
      throw new Error('Fault manager not configured. Provide faults config and credentials.');
    }
    return this.faultManager;
  }

  /**
   * Get the underlying Linear SDK client
   */
  get api(): LinearSDK {
    if (!this.sdk) {
      throw new Error('Linear SDK not initialized. Provide apiKey or accessToken.');
    }
    return this.sdk;
  }

  /**
   * Set access token (e.g., after OAuth flow completes)
   */
  setAccessToken(token: string): void {
    this.sdk = new LinearSDK({ accessToken: token });
    this.options.accessToken = token;

    // Reinitialize fault manager with new token
    if (this.options.faults) {
      this.faultManager = new FaultManager({
        ...this.options.faults,
        accessToken: token,
      });
    }
  }

  /**
   * Get current authenticated user
   */
  async getUser(): Promise<LinearUser> {
    const viewer = await this.api.viewer;
    return {
      id: viewer.id,
      name: viewer.name,
      email: viewer.email,
      displayName: viewer.displayName,
    };
  }

  /**
   * Get all teams with their states and labels
   */
  async getTeams(): Promise<LinearTeam[]> {
    const teams = await this.api.teams();
    const result: LinearTeam[] = [];

    for (const team of teams.nodes) {
      const states = await team.states();
      const labels = await team.labels();

      result.push({
        id: team.id,
        name: team.name,
        key: team.key,
        states: states.nodes.map((s) => ({
          id: s.id,
          name: s.name,
          type: s.type,
        })),
        labels: labels.nodes.map((l) => ({
          id: l.id,
          name: l.name,
          color: l.color,
        })),
      });
    }

    return result;
  }

  /**
   * Create an issue
   */
  async createIssue(input: IssueCreateInput): Promise<{ id: string; identifier: string; url: string }> {
    const issue = await this.api.createIssue(input);
    const created = await issue.issue;

    if (!created) {
      throw new Error('Issue creation failed');
    }

    return {
      id: created.id,
      identifier: created.identifier,
      url: created.url,
    };
  }

  /**
   * Report an error/fault
   */
  async reportFault(report: FaultReport): Promise<{ issueId: string; identifier: string; url: string; isDuplicate: boolean }> {
    return this.faults.report(report);
  }

  /**
   * Report an Error object
   */
  async reportError(
    error: Error,
    context?: Record<string, unknown>
  ): Promise<{ issueId: string; identifier: string; url: string; isDuplicate: boolean }> {
    return this.faults.reportError(error, context);
  }
}
