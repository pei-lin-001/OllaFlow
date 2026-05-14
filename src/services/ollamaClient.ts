import { Agent, ProxyAgent, request as undiciRequest } from 'undici';
import type { Readable } from 'node:stream';
import { config } from '../config.js';
import { getDecryptedApiKey, getProxyAuth } from './accountSelector.js';
import type { Account } from '@prisma/client';

const defaultAgent = new Agent({
  connect: { rejectUnauthorized: true },
});

export interface ProxyResponse {
  statusCode: number;
  headers: Record<string, string | string[]>;
  body: Readable;
}

export async function forwardToOllama(
  account: Account,
  method: string,
  path: string,
  headers: Record<string, string | string[] | undefined>,
  body?: string | Buffer
): Promise<ProxyResponse> {
  const apiKey = getDecryptedApiKey(account);
  const proxyAuth = getProxyAuth(account);

  const upstreamHeaders: Record<string, string> = {
    authorization: `Bearer ${apiKey}`,
  };

  if (body) {
    if (typeof body === 'string') {
      upstreamHeaders['content-type'] = 'application/json';
    } else {
      upstreamHeaders['content-type'] = 'application/octet-stream';
    }
  }

  // Forward relevant client headers
  const forwardHeaders = ['accept', 'accept-encoding', 'accept-language', 'user-agent'];
  for (const h of forwardHeaders) {
    if (headers[h]) {
      upstreamHeaders[h] = String(headers[h]);
    }
  }

  const url = `${config.OLLAMA_CLOUD_HOST}${path}`;

  let dispatcher: Agent | ProxyAgent = defaultAgent;
  if (account.proxyUrl) {
    const opts: ConstructorParameters<typeof ProxyAgent>[0] = {
      uri: account.proxyUrl,
    };
    if (proxyAuth) {
      opts.token = `Basic ${Buffer.from(`${proxyAuth.username}:${proxyAuth.password}`).toString('base64')}`;
    }
    dispatcher = new ProxyAgent(opts);
  }

  const response = await undiciRequest(url, {
    method: method as any,
    headers: upstreamHeaders,
    body: body || undefined,
    dispatcher,
    headersTimeout: 300_000,
    bodyTimeout: 0,
  });

  return {
    statusCode: response.statusCode,
    headers: response.headers as unknown as Record<string, string | string[]>,
    body: response.body as unknown as Readable,
  };
}
