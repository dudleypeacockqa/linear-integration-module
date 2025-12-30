/**
 * Type definitions for Linear Integration Module
 */

export interface LinearConfig {
  /** OAuth client ID */
  clientId?: string;
  /** OAuth client secret */
  clientSecret?: string;
  /** OAuth redirect URI */
  redirectUri?: string;
  /** API key (alternative to OAuth) */
  apiKey?: string;
  /** Webhook signing secret */
  webhookSecret?: string;
  /** Default team ID for issue creation */
  defaultTeamId?: string;
}

export interface IssueCreateInput {
  title: string;
  description?: string;
  teamId?: string;
  priority?: 0 | 1 | 2 | 3 | 4; // 0=No priority, 1=Urgent, 2=High, 3=Normal, 4=Low
  labelIds?: string[];
  assigneeId?: string;
  projectId?: string;
  stateId?: string;
}

export interface WebhookPayload {
  action: 'create' | 'update' | 'remove';
  type: string;
  data: Record<string, unknown>;
  createdAt: string;
  organizationId: string;
  webhookId: string;
  webhookTimestamp: number;
}

export interface LinearTeam {
  id: string;
  name: string;
  key: string;
  states: LinearState[];
  labels: LinearLabel[];
}

export interface LinearState {
  id: string;
  name: string;
  type: string;
}

export interface LinearLabel {
  id: string;
  name: string;
  color: string;
}

export interface LinearUser {
  id: string;
  name: string;
  email: string;
  displayName: string;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug: (message: string, ...args: unknown[]) => void;
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
}
