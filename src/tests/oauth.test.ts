/**
 * OAuth Authentication Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LinearAuthClient } from '../auth/oauth';

describe('LinearAuthClient', () => {
  let authClient: LinearAuthClient;

  beforeEach(() => {
    authClient = new LinearAuthClient({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      redirectUri: 'http://localhost:3000/callback',
    });
  });

  describe('generatePKCE', () => {
    it('should generate valid PKCE challenge', () => {
      const pkce = authClient.generatePKCE();

      expect(pkce.codeVerifier).toBeDefined();
      expect(pkce.codeChallenge).toBeDefined();
      expect(pkce.codeChallengeMethod).toBe('S256');
      expect(pkce.codeVerifier.length).toBeGreaterThan(32);
    });

    it('should generate different challenges each time', () => {
      const pkce1 = authClient.generatePKCE();
      const pkce2 = authClient.generatePKCE();

      expect(pkce1.codeVerifier).not.toBe(pkce2.codeVerifier);
      expect(pkce1.codeChallenge).not.toBe(pkce2.codeChallenge);
    });
  });

  describe('generateState', () => {
    it('should generate a random state string', () => {
      const state = authClient.generateState();

      expect(state).toBeDefined();
      expect(state.length).toBe(32); // 16 bytes = 32 hex chars
    });

    it('should generate different states each time', () => {
      const state1 = authClient.generateState();
      const state2 = authClient.generateState();

      expect(state1).not.toBe(state2);
    });
  });

  describe('getAuthorizationUrl', () => {
    it('should generate valid authorization URL with required params', () => {
      const url = authClient.getAuthorizationUrl();

      expect(url).toContain('https://linear.app/oauth/authorize');
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain('redirect_uri=');
      expect(url).toContain('response_type=code');
      expect(url).toContain('scope=');
    });

    it('should include state when provided', () => {
      const url = authClient.getAuthorizationUrl({ state: 'test-state' });

      expect(url).toContain('state=test-state');
    });

    it('should include PKCE parameters when provided', () => {
      const pkce = authClient.generatePKCE();
      const url = authClient.getAuthorizationUrl({ pkce });

      expect(url).toContain('code_challenge=');
      expect(url).toContain('code_challenge_method=S256');
    });

    it('should include actor when provided', () => {
      const url = authClient.getAuthorizationUrl({ actor: 'app' });

      expect(url).toContain('actor=app');
    });

    it('should include prompt when provided', () => {
      const url = authClient.getAuthorizationUrl({ prompt: 'consent' });

      expect(url).toContain('prompt=consent');
    });
  });
});
