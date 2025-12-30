#!/usr/bin/env node
/**
 * CLI Setup Tool for Linear Integration
 * Guides users through OAuth setup and configuration
 */

import { createServer } from 'http';
import { URL } from 'url';
import { LinearAuthClient } from '../auth/oauth';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

const DEFAULT_PORT = 3847;
const REDIRECT_PATH = '/auth/callback';

interface SetupConfig {
  clientId: string;
  clientSecret: string;
  port?: number;
}

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function startCallbackServer(
  authClient: LinearAuthClient,
  port: number,
  codeVerifier: string
): Promise<{ accessToken: string; refreshToken?: string }> {
  return new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      if (!req.url?.startsWith(REDIRECT_PATH)) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const url = new URL(req.url, `http://localhost:${port}`);
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      if (error) {
        res.writeHead(400);
        res.end(`Authorization error: ${error}`);
        server.close();
        reject(new Error(error));
        return;
      }

      if (!code) {
        res.writeHead(400);
        res.end('No authorization code received');
        server.close();
        reject(new Error('No authorization code'));
        return;
      }

      try {
        const tokens = await authClient.exchangeCode(code, codeVerifier);

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <body style="font-family: system-ui; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #1a1a2e;">
              <div style="text-align: center; color: white;">
                <h1 style="color: #5e6ad2;">Linear Authentication Successful!</h1>
                <p>You can close this window and return to your terminal.</p>
              </div>
            </body>
          </html>
        `);

        server.close();
        resolve({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
        });
      } catch (err) {
        res.writeHead(500);
        res.end(`Token exchange failed: ${err}`);
        server.close();
        reject(err);
      }
    });

    server.listen(port, () => {
      console.log(`\nCallback server listening on http://localhost:${port}${REDIRECT_PATH}`);
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      server.close();
      reject(new Error('Authorization timeout'));
    }, 300000);
  });
}

async function saveConfig(
  accessToken: string,
  refreshToken?: string,
  outputPath?: string
): Promise<void> {
  const config = {
    LINEAR_ACCESS_TOKEN: accessToken,
    LINEAR_REFRESH_TOKEN: refreshToken || '',
    GENERATED_AT: new Date().toISOString(),
  };

  const envContent = Object.entries(config)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const filePath = outputPath || path.join(process.cwd(), '.env.linear');
  fs.writeFileSync(filePath, envContent);
  console.log(`\nConfiguration saved to: ${filePath}`);
}

async function main(): Promise<void> {
  console.log('\n=== Linear Integration Setup ===\n');
  console.log('This tool will guide you through setting up Linear OAuth authentication.\n');
  console.log('Prerequisites:');
  console.log('1. Create an OAuth application at https://linear.app/settings/api');
  console.log('2. Set the callback URL to: http://localhost:3847/auth/callback\n');

  const clientId = await prompt('Enter your Linear Client ID: ');
  if (!clientId) {
    console.error('Client ID is required');
    process.exit(1);
  }

  const clientSecret = await prompt('Enter your Linear Client Secret: ');
  if (!clientSecret) {
    console.error('Client Secret is required');
    process.exit(1);
  }

  const portStr = await prompt(`Enter callback port (default: ${DEFAULT_PORT}): `);
  const port = portStr ? parseInt(portStr, 10) : DEFAULT_PORT;

  const redirectUri = `http://localhost:${port}${REDIRECT_PATH}`;

  const authClient = new LinearAuthClient({
    clientId,
    clientSecret,
    redirectUri,
    scopes: ['read', 'write', 'issues:create', 'comments:create'],
  });

  // Generate PKCE challenge
  const pkce = authClient.generatePKCE();
  const state = authClient.generateState();

  // Get authorization URL
  const authUrl = authClient.getAuthorizationUrl({
    state,
    pkce,
  });

  console.log('\n--- Authorization Required ---');
  console.log('\nPlease open this URL in your browser to authorize the application:\n');
  console.log(authUrl);
  console.log('\nWaiting for authorization...');

  // Try to open browser automatically
  try {
    const open = await import('open');
    await open.default(authUrl);
    console.log('(Browser opened automatically)');
  } catch {
    console.log('(Please open the URL manually)');
  }

  try {
    const tokens = await startCallbackServer(authClient, port, pkce.codeVerifier);

    console.log('\n--- Authentication Successful! ---');
    console.log(`\nAccess Token: ${tokens.accessToken.slice(0, 20)}...`);

    const saveChoice = await prompt('\nSave configuration to .env.linear? (y/n): ');
    if (saveChoice.toLowerCase() === 'y') {
      await saveConfig(tokens.accessToken, tokens.refreshToken);
    }

    console.log('\n--- Setup Complete ---');
    console.log('\nYou can now use the Linear Integration Module in your application:');
    console.log(`
  import { LinearClient } from '@flocommand/linear-integration';
  
  const client = new LinearClient({
    accessToken: process.env.LINEAR_ACCESS_TOKEN,
    faults: {
      teamId: 'YOUR_TEAM_ID',
      appName: 'YourApp',
    },
  });
`);
  } catch (error) {
    console.error('\nSetup failed:', error);
    process.exit(1);
  }
}

main().catch(console.error);
