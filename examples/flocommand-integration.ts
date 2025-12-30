/**
 * FloCommand Integration Example
 * 
 * This example shows how to integrate Linear fault management
 * into the FloCommand/Sales Proposals application on Render.
 */

import { LinearClient, FaultManager } from '@flocommand/linear-integration';

// Configuration from environment variables
const config = {
  // Use API key for server-to-server communication (simpler than OAuth)
  apiKey: process.env.LINEAR_API_KEY,
  
  // Your Linear team ID (find this in Linear URL: linear.app/team/TEAM_ID/...)
  teamId: process.env.LINEAR_DEFAULT_TEAM_ID,
  
  // Application identification
  appName: 'FloCommand',
  environment: process.env.NODE_ENV || 'production',
};

// Initialize the Linear client
export const linearClient = new LinearClient({
  apiKey: config.apiKey,
  faults: {
    teamId: config.teamId!,
    appName: config.appName,
    environment: config.environment,
    defaultPriority: 2, // High priority for production errors
    deduplicate: true,
    dedupeWindow: 3600000, // 1 hour deduplication window
  },
});

// Standalone fault manager (if you only need error reporting)
export const faultManager = new FaultManager({
  accessToken: config.apiKey!,
  teamId: config.teamId!,
  appName: config.appName,
  environment: config.environment,
  deduplicate: true,
});

/**
 * Report an error to Linear
 */
export async function reportError(
  error: Error,
  context?: {
    userId?: string;
    url?: string;
    action?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  try {
    const result = await faultManager.report({
      message: error.message,
      stack: error.stack,
      severity: 'error',
      userId: context?.userId,
      url: context?.url,
      context: {
        action: context?.action,
        ...context?.metadata,
      },
    });

    if (!result.isDuplicate) {
      console.log(`[Linear] Created issue: ${result.identifier}`);
    } else {
      console.log(`[Linear] Duplicate error, updated existing issue`);
    }
  } catch (e) {
    // Don't let Linear errors break the application
    console.error('[Linear] Failed to report error:', e);
  }
}

/**
 * Express error middleware for automatic error reporting
 */
export function linearErrorMiddleware() {
  return async (
    error: Error,
    req: any,
    res: any,
    next: any
  ) => {
    // Report to Linear
    await reportError(error, {
      url: req.originalUrl || req.url,
      userId: req.user?.id || req.auth?.userId,
      action: `${req.method} ${req.path}`,
      metadata: {
        method: req.method,
        query: req.query,
        // Don't log sensitive body data
        bodyKeys: req.body ? Object.keys(req.body) : [],
      },
    });

    // Continue to next error handler
    next(error);
  };
}

/**
 * Global unhandled error handlers
 */
export function setupGlobalErrorHandlers(): void {
  // Unhandled promise rejections
  process.on('unhandledRejection', (reason: any) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    reportError(error, {
      action: 'unhandledRejection',
    });
  });

  // Uncaught exceptions
  process.on('uncaughtException', (error: Error) => {
    reportError(error, {
      action: 'uncaughtException',
    }).finally(() => {
      // Give time for the report to be sent before crashing
      setTimeout(() => process.exit(1), 1000);
    });
  });
}

// Example usage in your Express app:
/*
import express from 'express';
import { linearErrorMiddleware, setupGlobalErrorHandlers } from './linear-integration';

const app = express();

// Setup global handlers early
setupGlobalErrorHandlers();

// ... your routes ...

// Add Linear error middleware BEFORE your final error handler
app.use(linearErrorMiddleware());

// Your final error handler
app.use((err, req, res, next) => {
  res.status(500).json({ error: 'Internal server error' });
});
*/
