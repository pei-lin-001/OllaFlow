import { Agent, ProxyAgent, request as undiciRequest } from 'undici';
import type { Readable } from 'node:stream';
import https from 'node:https';
import { config } from '../config.js';
import { getDecryptedApiKey, getProxyAuth } from './accountSelector.js';
import type { Account } from '@prisma/client';
import { SocksProxyAgent } from 'socks-proxy-agent';

// ── 代理类型判断 ──────────────────────────────────────

type ProxyType = 'http' | 'socks';

function classifyProxy(proxyUrl: string | null): ProxyType {
  if (!proxyUrl) return 'http';
  const lower = proxyUrl.toLowerCase();
  if (lower.startsWith('socks4://') || lower.startsWith('socks4a://') ||
      lower.startsWith('socks5://') || lower.startsWith('socks5h://') ||
      lower.startsWith('socks://')) {
    return 'socks';
  }
  return 'http';
}

// ── Agent 缓存 ─────────────────────────────────────────

const defaultAgent = new Agent({
  connect: { rejectUnauthorized: true },
  keepAliveTimeout: 30_000,
  keepAliveMaxTimeout: 600_000,
  connections: 50,
});

const httpProxyAgentCache = new Map<string, ProxyAgent>();
const socksProxyAgentCache = new Map<string, SocksProxyAgent>();

function getHttpProxyAgent(account: Account): Agent | ProxyAgent {
  if (!account.proxyUrl) return defaultAgent;
  const proxyAuth = getProxyAuth(account);
  const key = account.proxyUrl + '|' + (proxyAuth ? `${proxyAuth.username}:${proxyAuth.password}` : '');
  let agent = httpProxyAgentCache.get(key);
  if (!agent) {
    const opts: ConstructorParameters<typeof ProxyAgent>[0] = { uri: account.proxyUrl };
    if (proxyAuth) {
      opts.token = `Basic ${Buffer.from(`${proxyAuth.username}:${proxyAuth.password}`).toString('base64')}`;
    }
    agent = new ProxyAgent(opts);
    httpProxyAgentCache.set(key, agent);
  }
  return agent;
}

function getSocksProxyAgent(account: Account): SocksProxyAgent {
  const proxyAuth = getProxyAuth(account);
  // 构建 SOCKS 代理 URL（含认证信息）
  let proxyUrl = account.proxyUrl!;
  if (proxyAuth && !proxyUrl.includes('@')) {
    // 将认证信息嵌入 URL：socks5://user:pass@host:port
    try {
      const parsed = new URL(proxyUrl);
      parsed.username = proxyAuth.username;
      parsed.password = proxyAuth.password;
      proxyUrl = parsed.toString();
    } catch {
      // URL 解析失败，回退到手动拼接
      const proto = proxyUrl.includes('://') ? proxyUrl.split('://')[0] : 'socks5';
      const rest = proxyUrl.includes('://') ? proxyUrl.split('://')[1] : proxyUrl;
      proxyUrl = `${proto}://${encodeURIComponent(proxyAuth.username)}:${encodeURIComponent(proxyAuth.password)}@${rest}`;
    }
  }
  const key = proxyUrl;
  let agent = socksProxyAgentCache.get(key);
  if (!agent) {
    agent = new SocksProxyAgent(proxyUrl);
    socksProxyAgentCache.set(key, agent);
  }
  return agent;
}

// ── 统一响应接口 ───────────────────────────────────────

export interface ProxyResponse {
  statusCode: number;
  headers: Record<string, string | string[]>;
  body: Readable;
}

// ── SOCKS5 代理转发（使用 Node.js https 模块）──────────

function forwardViaSocks(account: Account, method: string, path: string, headers: Record<string, string | string[] | undefined>, body?: string | Buffer): Promise<ProxyResponse> {
  return new Promise((resolve, reject) => {
    const apiKey = getDecryptedApiKey(account);
    const url = new URL(path, config.OLLAMA_CLOUD_HOST);

    const upstreamHeaders: Record<string, string> = {
      authorization: `Bearer ${apiKey}`,
    };
    if (body) {
      upstreamHeaders['content-type'] = typeof body === 'string' ? 'application/json' : 'application/octet-stream';
    }
    const forwardHeaders = ['accept', 'accept-encoding', 'accept-language', 'user-agent'];
    for (const h of forwardHeaders) {
      if (headers[h]) upstreamHeaders[h] = String(headers[h]);
    }
    if (method !== 'GET' && method !== 'HEAD' && !upstreamHeaders['content-length'] && body) {
      upstreamHeaders['content-length'] = String(Buffer.byteLength(typeof body === 'string' ? body : body));
    }

    const agent = getSocksProxyAgent(account);

    const req = https.request(url, {
      method,
      headers: upstreamHeaders,
      agent,
      timeout: 600_000,
    }, (res) => {
      resolve({
        statusCode: res.statusCode ?? 502,
        headers: res.headers as Record<string, string | string[]>,
        body: res,
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy(new Error('SOCKS proxy request timed out'));
    });

    if (body) {
      req.write(body);
    }
    req.end();
  });
}

// ── HTTP/HTTPS 代理转发（使用 undici）──────────────────

function forwardViaHttpProxy(account: Account, method: string, path: string, headers: Record<string, string | string[] | undefined>, body?: string | Buffer): Promise<ProxyResponse> {
  const apiKey = getDecryptedApiKey(account);

  const upstreamHeaders: Record<string, string> = {
    authorization: `Bearer ${apiKey}`,
  };
  if (body) {
    upstreamHeaders['content-type'] = typeof body === 'string' ? 'application/json' : 'application/octet-stream';
  }
  const forwardHeaders = ['accept', 'accept-encoding', 'accept-language', 'user-agent'];
  for (const h of forwardHeaders) {
    if (headers[h]) upstreamHeaders[h] = String(headers[h]);
  }

  const url = `${config.OLLAMA_CLOUD_HOST}${path}`;
  const dispatcher = account.proxyUrl ? getHttpProxyAgent(account) : defaultAgent;

  return undiciRequest(url, {
    method: method as any,
    headers: upstreamHeaders,
    body: body || undefined,
    dispatcher,
    headersTimeout: 60_000,
    bodyTimeout: 600_000,
  }).then((response) => ({
    statusCode: response.statusCode,
    headers: response.headers as unknown as Record<string, string | string[]>,
    body: response.body as unknown as Readable,
  }));
}

// ── 统一入口：根据代理类型自动分发 ────────────────────

export async function forwardToOllama(
  account: Account,
  method: string,
  path: string,
  headers: Record<string, string | string[] | undefined>,
  body?: string | Buffer
): Promise<ProxyResponse> {
  const proxyType = classifyProxy(account.proxyUrl);

  if (proxyType === 'socks') {
    return forwardViaSocks(account, method, path, headers, body);
  }

  return forwardViaHttpProxy(account, method, path, headers, body);
}
