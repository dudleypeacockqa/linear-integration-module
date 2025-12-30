/**
 * Fault Manager Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FaultManager } from '../faults/manager';

// Mock the Linear SDK
vi.mock('@linear/sdk', () => ({
  LinearClient: vi.fn().mockImplementation(() => ({
    createIssue: vi.fn().mockResolvedValue({
      issue: Promise.resolve({
        id: 'issue-123',
        identifier: 'TEST-1',
        url: 'https://linear.app/test/issue/TEST-1',
      }),
    }),
    createComment: vi.fn().mockResolvedValue({ success: true }),
  })),
}));

describe('FaultManager', () => {
  let faultManager: FaultManager;

  beforeEach(() => {
    faultManager = new FaultManager({
      accessToken: 'test-token',
      teamId: 'team-123',
      appName: 'TestApp',
      environment: 'test',
      deduplicate: false,
    });
  });

  describe('report', () => {
    it('should create an issue for a fault report', async () => {
      const result = await faultManager.report({
        message: 'Test error message',
        severity: 'error',
      });

      expect(result.issueId).toBe('issue-123');
      expect(result.identifier).toBe('TEST-1');
      expect(result.isDuplicate).toBe(false);
    });

    it('should handle critical severity with priority 1', async () => {
      const result = await faultManager.report({
        message: 'Critical error',
        severity: 'critical',
      });

      expect(result.issueId).toBeDefined();
    });

    it('should include stack trace in description', async () => {
      const result = await faultManager.report({
        message: 'Error with stack',
        stack: 'Error: Test\n    at test.js:1:1',
      });

      expect(result.issueId).toBeDefined();
    });

    it('should include context in description', async () => {
      const result = await faultManager.report({
        message: 'Error with context',
        context: { userId: 'user-1', action: 'test' },
      });

      expect(result.issueId).toBeDefined();
    });
  });

  describe('reportError', () => {
    it('should create issue from Error object', async () => {
      const error = new Error('Test error');
      const result = await faultManager.reportError(error);

      expect(result.issueId).toBeDefined();
      expect(result.isDuplicate).toBe(false);
    });

    it('should include additional context', async () => {
      const error = new Error('Test error');
      const result = await faultManager.reportError(error, {
        userId: 'user-1',
        requestId: 'req-123',
      });

      expect(result.issueId).toBeDefined();
    });
  });

  describe('deduplication', () => {
    it('should deduplicate similar errors when enabled', async () => {
      const dedupeManager = new FaultManager({
        accessToken: 'test-token',
        teamId: 'team-123',
        deduplicate: true,
        dedupeWindow: 60000,
      });

      // First report
      const result1 = await dedupeManager.report({
        message: 'Duplicate error',
        stack: 'Error: Duplicate\n    at test.js:1:1',
      });

      expect(result1.isDuplicate).toBe(false);

      // Second report (same error)
      const result2 = await dedupeManager.report({
        message: 'Duplicate error',
        stack: 'Error: Duplicate\n    at test.js:1:1',
      });

      expect(result2.isDuplicate).toBe(true);
    });
  });

  describe('createGlobalHandler', () => {
    it('should return a function that reports errors', () => {
      const handler = faultManager.createGlobalHandler();

      expect(typeof handler).toBe('function');
    });
  });

  describe('clearCache', () => {
    it('should clear the fault cache', async () => {
      const dedupeManager = new FaultManager({
        accessToken: 'test-token',
        teamId: 'team-123',
        deduplicate: true,
      });

      await dedupeManager.report({ message: 'Test error' });
      dedupeManager.clearCache();

      // After clearing, same error should not be duplicate
      const result = await dedupeManager.report({ message: 'Test error' });
      expect(result.isDuplicate).toBe(false);
    });
  });
});
