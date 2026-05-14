import type { Request, Response } from 'express';
import { pipeline } from 'stream';
import { selectAccount, markAccountSuccess, markAccountFailure } from '../services/accountSelector.js';
import { forwardToOllama } from '../services/ollamaClient.js';
import { createNdjsonInterceptor, createSSEInterceptor } from '../services/streamInterceptor.js';
import { recordUsage, recordOpenAIUsage } from '../services/usageTracker.js';
import { prisma } from '../db.js';
import { config } from '../config.js';

const NO_MODEL_ENDPOINTS = ['/api/tags', '/api/version', '/api/ps', '/v1/models'];
const NO_USAGE_ENDPOINTS = ['/api/tags', '/api/version', '/api/ps', '/api/create', '/api/pull', '/api/push', '/api/copy', '/api/delete', '/api/show', '/api/blobs', '/v1/models'];

function isNoModelEndpoint(path: string, method: string): boolean {
  if (method === 'GET') return true;
  return NO_MODEL_ENDPOINTS.some((ep) => path.startsWith(ep));
}

function shouldSkipUsage(path: string): boolean {
  return NO_USAGE_ENDPOINTS.some((ep) => path.startsWith(ep));
}

export async function proxyHandler(req: Request, res: Response) {
  const startTime = Date.now();
  const proxyUser = (req as any).proxyUser;
  const path = req.originalUrl || req.path;
  const method = req.method;

  let account = await selectAccount(path);
  if (!account) {
    return res.status(503).json({ error: 'No active accounts available.' });
  }

  let bodyStr: string | undefined;
  const rawBody: Buffer | undefined = (req as any).rawBody;
  const isBlobUpload = !!rawBody;
  if (rawBody) {
    // Binary blob upload - pass through as-is, skip JSON handling
    bodyStr = undefined;
  } else if (method !== 'GET' && method !== 'HEAD') {
    if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
      bodyStr = JSON.stringify(req.body);
    } else if (typeof req.body === 'string' && req.body.length > 0) {
      bodyStr = req.body;
    }
  }

  let modelName: string | null = null;
  if (bodyStr) {
    try {
      const parsed = JSON.parse(bodyStr);
      modelName = parsed.model || null;
    } catch {
      // ignore
    }
  }

  const shouldRecordUsage = !shouldSkipUsage(path);

  let upstreamResponse;
  try {
    const forwardBody = rawBody ? rawBody : bodyStr;
    upstreamResponse = await forwardToOllama(account, method, path, req.headers, forwardBody);
  } catch (err: any) {
    await markAccountFailure(account.id);
    await logRequest({
      accountId: account.id,
      proxyUserId: proxyUser?.id,
      model: modelName,
      endpoint: path,
      method,
      statusCode: 502,
      error: err?.message || 'Upstream connection failed',
      durationMs: Date.now() - startTime,
      requestBody: config.SAVE_REQUEST_BODIES ? bodyStr ?? undefined : undefined,
    });
    return res.status(502).json({ error: 'Failed to connect to upstream Ollama Cloud.' });
  }

  const contentType = upstreamResponse.headers['content-type']?.toString() ?? '';
  const isStream = contentType.includes('ndjson') || contentType.includes('event-stream');
  const isSSE = contentType.includes('event-stream');
  const isV1 = path.startsWith('/v1/');
  const streamed = isStream;

  res.status(upstreamResponse.statusCode);
  for (const [key, value] of Object.entries(upstreamResponse.headers)) {
    if (value != null && key.toLowerCase() !== 'content-encoding') {
      res.setHeader(key, value as string | string[]);
    }
  }

  if (upstreamResponse.statusCode >= 400) {
    const chunks: Buffer[] = [];
    upstreamResponse.body.on('data', (chunk: Buffer) => chunks.push(chunk));
    upstreamResponse.body.on('end', async () => {
      const body = Buffer.concat(chunks).toString('utf8');
      let errorMsg: string | undefined;
      try {
        const parsed = JSON.parse(body);
        errorMsg = parsed.error;
      } catch {
        errorMsg = body.slice(0, 500);
      }
      await markAccountFailure(account.id);
      await logRequest({
        accountId: account.id,
        proxyUserId: proxyUser?.id,
        model: modelName,
        endpoint: path,
        method,
        statusCode: upstreamResponse.statusCode,
        error: errorMsg,
        durationMs: Date.now() - startTime,
        requestBody: config.SAVE_REQUEST_BODIES ? bodyStr ?? undefined : undefined,
        responseBody: config.SAVE_RESPONSE_BODIES ? body : undefined,
      });
      res.end(body);
    });
    upstreamResponse.body.on('error', async (err: Error) => {
      await markAccountFailure(account.id);
      await logRequest({
        accountId: account.id,
        proxyUserId: proxyUser?.id,
        model: modelName,
        endpoint: path,
        method,
        statusCode: upstreamResponse.statusCode,
        error: err.message,
        durationMs: Date.now() - startTime,
        requestBody: config.SAVE_REQUEST_BODIES ? bodyStr ?? undefined : undefined,
      });
      res.end();
    });
    return;
  }

  if (streamed) {
    if (isSSE || isV1) {
      const interceptor = createSSEInterceptor({
        onUsage: async (usage, streamModel) => {
          if (shouldRecordUsage) {
            const effectiveModel = modelName || streamModel || 'unknown';
            await recordOpenAIUsage({
              accountId: account.id,
              proxyUserId: proxyUser?.id,
              model: effectiveModel,
              endpoint: path,
              statusCode: upstreamResponse.statusCode,
              usage,
              streamed: true,
            });
          }
          await markAccountSuccess(account.id);
          await logRequest({
            accountId: account.id,
            proxyUserId: proxyUser?.id,
            model: modelName || streamModel || null,
            endpoint: path,
            method,
            statusCode: upstreamResponse.statusCode,
            durationMs: Date.now() - startTime,
            requestBody: config.SAVE_REQUEST_BODIES ? bodyStr ?? undefined : undefined,
          });
        },
        onErrorChunk: async (_error) => {
          // handled in flush
        },
      });

      pipeline(upstreamResponse.body, interceptor, res, (err) => {
        if (err) {
          // Client disconnect or pipe error
        }
      });
    } else {
      const interceptor = createNdjsonInterceptor({
        onUsage: async (usage) => {
          if (shouldRecordUsage) {
            const effectiveModel = modelName || usage.model || 'unknown';
            await recordUsage({
              accountId: account.id,
              proxyUserId: proxyUser?.id,
              model: effectiveModel,
              endpoint: path,
              statusCode: upstreamResponse.statusCode,
              usage,
              streamed: true,
            });
          }
          await markAccountSuccess(account.id);
          await logRequest({
            accountId: account.id,
            proxyUserId: proxyUser?.id,
            model: modelName || usage.model || null,
            endpoint: path,
            method,
            statusCode: upstreamResponse.statusCode,
            durationMs: Date.now() - startTime,
            requestBody: config.SAVE_REQUEST_BODIES ? bodyStr ?? undefined : undefined,
          });
        },
        onErrorChunk: async (_error) => {
          // handled in flush
        },
      });

      pipeline(upstreamResponse.body, interceptor, res, (err) => {
        if (err) {
          // Client disconnect or pipe error
        }
      });
    }
  } else {
    const chunks: Buffer[] = [];
    upstreamResponse.body.on('data', (chunk: Buffer) => chunks.push(chunk));
    upstreamResponse.body.on('end', async () => {
      const body = Buffer.concat(chunks).toString('utf8');

      if (shouldRecordUsage) {
        if (isV1) {
          let usage = {} as { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
          try {
            const parsed = JSON.parse(body);
            if (parsed.usage) {
              usage = {
                prompt_tokens: parsed.usage.prompt_tokens,
                completion_tokens: parsed.usage.completion_tokens,
                total_tokens: parsed.usage.total_tokens,
              };
            }
            if (!modelName && parsed.model) modelName = parsed.model;
          } catch {
            // ignore
          }

          await recordOpenAIUsage({
            accountId: account.id,
            proxyUserId: proxyUser?.id,
            model: modelName || 'unknown',
            endpoint: path,
            statusCode: upstreamResponse.statusCode,
            usage,
            streamed: false,
          });
        } else {
          let usage = {} as Parameters<typeof recordUsage>[0]['usage'];
          try {
            const parsed = JSON.parse(body);
            usage = {
              model: parsed.model,
              total_duration: parsed.total_duration,
              load_duration: parsed.load_duration,
              prompt_eval_count: parsed.prompt_eval_count,
              prompt_eval_duration: parsed.prompt_eval_duration,
              eval_count: parsed.eval_count,
              eval_duration: parsed.eval_duration,
            };
            if (!modelName && parsed.model) modelName = parsed.model;
          } catch {
            // ignore
          }

          await recordUsage({
            accountId: account.id,
            proxyUserId: proxyUser?.id,
            model: modelName || usage.model || 'unknown',
            endpoint: path,
            statusCode: upstreamResponse.statusCode,
            usage,
            streamed: false,
          });
        }
      }

      await markAccountSuccess(account.id);
      await logRequest({
        accountId: account.id,
        proxyUserId: proxyUser?.id,
        model: modelName,
        endpoint: path,
        method,
        statusCode: upstreamResponse.statusCode,
        durationMs: Date.now() - startTime,
        requestBody: config.SAVE_REQUEST_BODIES ? bodyStr ?? undefined : undefined,
        responseBody: config.SAVE_RESPONSE_BODIES ? body : undefined,
      });
      res.end(body);
    });
  }
}

async function logRequest(data: {
  accountId?: number;
  proxyUserId?: number;
  model?: string | null;
  endpoint: string;
  method: string;
  statusCode?: number;
  error?: string;
  durationMs: number;
  requestBody?: string;
  responseBody?: string;
}) {
  await prisma.requestLog.create({
    data: {
      accountId: data.accountId ?? null,
      proxyUserId: data.proxyUserId ?? null,
      model: data.model ?? null,
      endpoint: data.endpoint,
      method: data.method,
      statusCode: data.statusCode ?? null,
      requestBody: data.requestBody ?? null,
      responseBody: data.responseBody ?? null,
      error: data.error ?? null,
      durationMs: data.durationMs,
    },
  });
}