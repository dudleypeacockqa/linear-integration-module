/**
 * Cursor / Claude Code Integration Example
 * 
 * This example shows how to integrate Linear error reporting
 * into Cursor or Claude Code extensions/tools.
 */

import { FaultManager } from '@flocommand/linear-integration';

// Initialize with API key (no OAuth needed for CLI tools)
const linearFaults = new FaultManager({
  accessToken: process.env.LINEAR_API_KEY!,
  teamId: process.env.LINEAR_DEFAULT_TEAM_ID!,
  appName: process.env.LINEAR_APP_NAME || 'Claude Code',
  environment: process.env.NODE_ENV || 'development',
  deduplicate: true,
  dedupeWindow: 300000, // 5 minute deduplication for dev
});

/**
 * Report a coding error to Linear
 */
export async function reportCodingError(
  error: Error,
  context: {
    file?: string;
    line?: number;
    command?: string;
    workspace?: string;
  }
): Promise<string | null> {
  try {
    const result = await linearFaults.report({
      message: error.message,
      stack: error.stack,
      severity: 'error',
      context: {
        file: context.file,
        line: context.line,
        command: context.command,
        workspace: context.workspace,
        tool: 'Claude Code',
      },
    });

    return result.isDuplicate ? null : result.url;
  } catch (e) {
    console.error('Failed to report error to Linear:', e);
    return null;
  }
}

/**
 * Report a warning (lower priority)
 */
export async function reportWarning(
  message: string,
  context?: Record<string, unknown>
): Promise<void> {
  try {
    await linearFaults.report({
      message,
      severity: 'warning',
      context,
    });
  } catch (e) {
    // Silently fail for warnings
  }
}

/**
 * Create a feature request issue
 */
export async function createFeatureRequest(
  title: string,
  description: string
): Promise<string | null> {
  try {
    // Use the underlying Linear SDK for non-fault issues
    const { LinearClient } = await import('@linear/sdk');
    const client = new LinearClient({ apiKey: process.env.LINEAR_API_KEY });
    
    const issue = await client.createIssue({
      teamId: process.env.LINEAR_DEFAULT_TEAM_ID!,
      title: `[Feature Request] ${title}`,
      description,
      priority: 4, // Low priority for feature requests
    });
    
    const created = await issue.issue;
    return created?.url || null;
  } catch (e) {
    console.error('Failed to create feature request:', e);
    return null;
  }
}

// Example usage:
/*
try {
  await someRiskyOperation();
} catch (error) {
  const issueUrl = await reportCodingError(error as Error, {
    file: '/src/components/Dashboard.tsx',
    line: 42,
    command: 'npm run build',
    workspace: 'sales-proposals',
  });
  
  if (issueUrl) {
    console.log(`Created Linear issue: ${issueUrl}`);
  }
}
*/
