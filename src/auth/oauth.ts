/**
 * OAuth 2.0 Authentication for Linear
 * Supports PKCE for enhanced security
 */

import crypto from 'crypto';

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes?: string[];
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

export interface PKCEChallenge {
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: 'S256';
}

export class LinearAuthClient {
  private config: OAuthConfig;
  private baseAuthUrl = 'https://linear.app/oauth/authorize';
  private tokenUrl = 'https://api.linear.app/oauth/token';

  constructor(config: OAuthConfig) {
    this.config = {
      ...config,
      scopes: config.scopes || ['read', 'write', 'issues:create', 'comments:create'],
    };
  }

  /**
   * Generate PKCE challenge for enhanced security
   */
  generatePKCE(): PKCEChallenge {
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    return {
      codeVerifier,
      codeChallenge,
      codeChallengeMethod: 'S256',
    };
  }

  /**
   * Generate state parameter for CSRF protection
   */
  generateState(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Get the authorization URL for OAuth flow
   */
  getAuthorizationUrl(options?: {
    state?: string;
    pkce?: PKCEChallenge;
    actor?: 'user' | 'app';
    prompt?: 'consent';
  }): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: this.config.scopes!.join(','),
    });

    if (options?.state) {
      params.set('state', options.state);
    }

    if (options?.pkce) {
      params.set('code_challenge', options.pkce.codeChallenge);
      params.set('code_challenge_method', options.pkce.codeChallengeMethod);
    }

    if (options?.actor) {
      params.set('actor', options.actor);
    }

    if (options?.prompt) {
      params.set('prompt', options.prompt);
    }

    return `${this.baseAuthUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCode(
    code: string,
    codeVerifier?: string
  ): Promise<TokenResponse> {
    const body = new URLSearchParams({
      code,
      redirect_uri: this.config.redirectUri,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      grant_type: 'authorization_code',
    });

    if (codeVerifier) {
      body.set('code_verifier', codeVerifier);
    }

    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    return response.json();
  }

  /**
   * Refresh an access token
   */
  async refreshToken(refreshToken: string): Promise<TokenResponse> {
    const body = new URLSearchParams({
      refresh_token: refreshToken,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      grant_type: 'refresh_token',
    });

    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token refresh failed: ${error}`);
    }

    return response.json();
  }

  /**
   * Revoke an access token
   */
  async revokeToken(token: string): Promise<void> {
    const response = await fetch('https://api.linear.app/oauth/revoke', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        token,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      }).toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token revocation failed: ${error}`);
    }
  }
}
