/**
 * Fault/Error Management for Linear
 * Automatically creates and manages issues for application errors
 */

import { LinearClient as LinearSDK } from '@linear/sdk';
import type { IssueCreateInput, Logger } from '../types';
import crypto from 'crypto';

export interface FaultConfig {
  /** Linear API key or OAuth access token */
  accessToken: string;
  /** Default team ID for fault issues */
  teamId: string;
  /** Label IDs to apply to fault issues */
  labelIds?: string[];
  /** Priority for fault issues (1=Urgent, 2=High, 3=Normal, 4=Low) */
  defaultPriority?: 1 | 2 | 3 | 4;
  /** Application name for issue titles */
  appName?: string;
  /** Environment (development, staging, production) */
  environment?: string;
  /** Logger instance */
  logger?: Logger;
  /** Enable deduplication of similar errors */
  deduplicate?: boolean;
  /** Deduplication window in milliseconds */
  dedupeWindow?: number;
}

export interface FaultReport {
  /** Error message */
  message: string;
  /** Error stack trace */
  stack?: string;
  /** Additional context */
  context?: Record<string, unknown>;
  /** Error severity */
  severity?: 'critical' | 'error' | 'warning';
  /** User affected (if applicable) */
  userId?: string;
  /** Request URL (if applicable) */
  url?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

interface FaultRecord {
  hash: string;
  issueId: string;
  count: number;
  lastSeen: Date;
}

export class FaultManager {
  private client: LinearSDK;
  private config: FaultConfig;
  private logger: Logger;
  private faultCache: Map<string, FaultRecord> = new Map();

  constructor(config: FaultConfig) {
    this.config = {
      ...config,
      defaultPriority: config.defaultPriority || 2,
      appName: config.appName || 'Application',
      environment: config.environment || 'production',
      deduplicate: config.deduplicate ?? true,
      dedupeWindow: config.dedupeWindow || 3600000, // 1 hour
    };

    this.client = new LinearSDK({ accessToken: config.accessToken });
    this.logger = config.logger || {
      debug: console.debug,
      info: console.info,
      warn: console.warn,
      error: console.error,
    };
  }

  /**
   * Generate a hash for deduplication
   */
  private generateFaultHash(report: FaultReport): string {
    const content = `${report.message}:${report.stack?.split('\n')[0] || ''}`;
    return crypto.createHash('md5').update(content).digest('hex');
  }

  /**
   * Check if a similar fault was recently reported
   */
  private checkDuplicate(hash: string): FaultRecord | null {
    const record = this.faultCache.get(hash);
    if (!record) return null;

    const now = new Date();
    const elapsed = now.getTime() - record.lastSeen.getTime();

    if (elapsed > this.config.dedupeWindow!) {
      this.faultCache.delete(hash);
      return null;
    }

    return record;
  }

  /**
   * Format error report as markdown description
   */
  private formatDescription(report: FaultReport): string {
    const sections: string[] = [];

    sections.push(`## Error Details`);
    sections.push(`**Message:** ${report.message}`);
    sections.push(`**Severity:** ${report.severity || 'error'}`);
    sections.push(`**Environment:** ${this.config.environment}`);
    sections.push(`**Timestamp:** ${new Date().toISOString()}`);

    if (report.url) {
      sections.push(`**URL:** ${report.url}`);
    }

    if (report.userId) {
      sections.push(`**User ID:** ${report.userId}`);
    }

    if (report.stack) {
      sections.push(`\n## Stack Trace`);
      sections.push('```');
      sections.push(report.stack);
      sections.push('```');
    }

    if (report.context && Object.keys(report.context).length > 0) {
      sections.push(`\n## Context`);
      sections.push('```json');
      sections.push(JSON.stringify(report.context, null, 2));
      sections.push('```');
    }

    if (report.metadata && Object.keys(report.metadata).length > 0) {
      sections.push(`\n## Metadata`);
      sections.push('```json');
      sections.push(JSON.stringify(report.metadata, null, 2));
      sections.push('```');
    }

    return sections.join('\n');
  }

  /**
   * Get priority based on severity
   */
  private getPriority(severity?: string): 1 | 2 | 3 | 4 {
    switch (severity) {
      case 'critical':
        return 1;
      case 'error':
        return 2;
      case 'warning':
        return 3;
      default:
        return this.config.defaultPriority!;
    }
  }

  /**
   * Report a fault/error to Linear
   */
  async report(report: FaultReport): Promise<{ issueId: string; identifier: string; url: string; isDuplicate: boolean }> {
    const hash = this.generateFaultHash(report);

    // Check for duplicate if deduplication is enabled
    if (this.config.deduplicate) {
      const existing = this.checkDuplicate(hash);
      if (existing) {
        existing.count++;
        existing.lastSeen = new Date();
        this.faultCache.set(hash, existing);

        this.logger.info(`Duplicate fault detected, count: ${existing.count}`);

        // Add comment to existing issue
        try {
          await this.client.createComment({
            issueId: existing.issueId,
            body: `This error occurred again at ${new Date().toISOString()}. Total occurrences: ${existing.count}`,
          });
        } catch (e) {
          this.logger.warn(`Failed to add comment to existing issue: ${e}`);
        }

        return {
          issueId: existing.issueId,
          identifier: 'duplicate',
          url: `https://linear.app/issue/${existing.issueId}`,
          isDuplicate: true,
        };
      }
    }

    // Create new issue
    const title = `[${this.config.appName}] ${report.severity?.toUpperCase() || 'ERROR'}: ${report.message.slice(0, 100)}`;
    const description = this.formatDescription(report);

    const issueInput: IssueCreateInput = {
      title,
      description,
      teamId: this.config.teamId,
      priority: this.getPriority(report.severity),
      labelIds: this.config.labelIds,
    };

    try {
      const issue = await this.client.createIssue(issueInput);
      const createdIssue = await issue.issue;

      if (!createdIssue) {
        throw new Error('Issue creation returned no issue');
      }

      // Cache for deduplication
      this.faultCache.set(hash, {
        hash,
        issueId: createdIssue.id,
        count: 1,
        lastSeen: new Date(),
      });

      this.logger.info(`Created fault issue: ${createdIssue.identifier}`);

      return {
        issueId: createdIssue.id,
        identifier: createdIssue.identifier,
        url: createdIssue.url,
        isDuplicate: false,
      };
    } catch (error) {
      this.logger.error(`Failed to create fault issue: ${error}`);
      throw error;
    }
  }

  /**
   * Report an Error object directly
   */
  async reportError(
    error: Error,
    context?: Record<string, unknown>
  ): Promise<{ issueId: string; identifier: string; url: string; isDuplicate: boolean }> {
    return this.report({
      message: error.message,
      stack: error.stack,
      context,
      severity: 'error',
    });
  }

  /**
   * Create a global error handler
   */
  createGlobalHandler(): (error: Error) => void {
    return (error: Error) => {
      this.reportError(error).catch((e) => {
        this.logger.error(`Failed to report error to Linear: ${e}`);
      });
    };
  }

  /**
   * Express error middleware
   */
  expressErrorHandler() {
    return async (
      error: Error,
      req: { url?: string; method?: string; body?: unknown },
      res: { status: (code: number) => { json: (data: unknown) => void } },
      next: () => void
    ) => {
      try {
        await this.report({
          message: error.message,
          stack: error.stack,
          severity: 'error',
          url: req.url,
          context: {
            method: req.method,
            body: req.body,
          },
        });
      } catch (e) {
        this.logger.error(`Failed to report error to Linear: ${e}`);
      }

      res.status(500).json({ error: 'Internal server error' });
    };
  }

  /**
   * Clear the fault cache
   */
  clearCache(): void {
    this.faultCache.clear();
  }
}
