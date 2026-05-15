import { prisma } from '../db.js';
import type { OllamaUsage } from '../types/ollama.js';

export async function recordUsage(params: {
  accountId: number;
  proxyUserId?: number;
  model: string;
  endpoint: string;
  statusCode: number;
  usage: OllamaUsage & { errorMessage?: string; model?: string };
  streamed: boolean;
  durationMs?: number;
}): Promise<void> {
  const durationFallbackNs = params.durationMs != null ? Math.round(params.durationMs * 1e6) : undefined;

  await prisma.usageRecord.create({
    data: {
      accountId: params.accountId,
      proxyUserId: params.proxyUserId ?? null,
      model: params.model || 'unknown',
      endpoint: params.endpoint,
      promptEvalCount: params.usage.prompt_eval_count ?? null,
      evalCount: params.usage.eval_count ?? null,
      totalDuration: params.usage.total_duration ?? durationFallbackNs ?? null,
      loadDuration: params.usage.load_duration ?? null,
      promptEvalDuration: params.usage.prompt_eval_duration ?? null,
      evalDuration: params.usage.eval_duration ?? durationFallbackNs ?? null,
      statusCode: params.statusCode,
      errorMessage: params.usage.errorMessage ?? null,
      streamed: params.streamed,
    },
  });

  const now = new Date();
  const hourStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const promptTokens = params.usage.prompt_eval_count ?? 0;
  const completionTokens = params.usage.eval_count ?? 0;
  const totalTokens = promptTokens + completionTokens;
  const duration = BigInt(params.usage.total_duration ?? 0);
  const isError = params.statusCode >= 400 || !!params.usage.errorMessage;

  const upsertData = {
    accountId: params.accountId,
    proxyUserId: params.proxyUserId ?? null,
    model: params.model || 'unknown',
    promptTokens,
    completionTokens,
    totalTokens,
    totalDuration: duration,
    isError,
  };

  await Promise.all([
    prisma.usageAggregate.upsert({
      where: {
        accountId_proxyUserId_model_period_periodStart: {
          accountId: params.accountId,
          proxyUserId: (params.proxyUserId ?? null) as any,
          model: params.model || 'unknown',
          period: 'hour',
          periodStart: hourStart,
        },
      },
      create: { ...upsertData, period: 'hour', periodStart: hourStart, requestCount: 1, errorCount: isError ? 1 : 0 },
      update: {
        requestCount: { increment: 1 },
        promptTokens: { increment: promptTokens },
        completionTokens: { increment: completionTokens },
        totalTokens: { increment: totalTokens },
        totalDuration: { increment: duration },
        errorCount: { increment: isError ? 1 : 0 },
      },
    }),
    prisma.usageAggregate.upsert({
      where: {
        accountId_proxyUserId_model_period_periodStart: {
          accountId: params.accountId,
          proxyUserId: (params.proxyUserId ?? null) as any,
          model: params.model || 'unknown',
          period: 'day',
          periodStart: dayStart,
        },
      },
      create: { ...upsertData, period: 'day', periodStart: dayStart, requestCount: 1, errorCount: isError ? 1 : 0 },
      update: {
        requestCount: { increment: 1 },
        promptTokens: { increment: promptTokens },
        completionTokens: { increment: completionTokens },
        totalTokens: { increment: totalTokens },
        totalDuration: { increment: duration },
        errorCount: { increment: isError ? 1 : 0 },
      },
    }),
  ]);
}

// ── OpenAI-compatible usage recording ──────────────────────────────────────

export async function recordOpenAIUsage(params: {
  accountId: number;
  proxyUserId?: number;
  model: string;
  endpoint: string;
  statusCode: number;
  usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  streamed: boolean;
  durationMs?: number;
}): Promise<void> {
  const durationFallbackNs = params.durationMs != null ? Math.round(params.durationMs * 1e6) : undefined;

  await prisma.usageRecord.create({
    data: {
      accountId: params.accountId,
      proxyUserId: params.proxyUserId ?? null,
      model: params.model || 'unknown',
      endpoint: params.endpoint,
      promptEvalCount: params.usage.prompt_tokens ?? null,
      evalCount: params.usage.completion_tokens ?? null,
      totalDuration: durationFallbackNs ?? null,
      evalDuration: durationFallbackNs ?? null,
      statusCode: params.statusCode,
      streamed: params.streamed,
    },
  });

  const now = new Date();
  const hourStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const promptTokens = params.usage.prompt_tokens ?? 0;
  const completionTokens = params.usage.completion_tokens ?? 0;
  const totalTokens = params.usage.total_tokens ?? (promptTokens + completionTokens);
  const isError = params.statusCode >= 400;

  const baseData = {
    accountId: params.accountId,
    proxyUserId: params.proxyUserId ?? null,
    model: params.model || 'unknown',
    promptTokens,
    completionTokens,
    totalTokens,
    totalDuration: 0n,
    isError,
  };

  await Promise.all([
    prisma.usageAggregate.upsert({
      where: {
        accountId_proxyUserId_model_period_periodStart: {
          accountId: params.accountId,
          proxyUserId: (params.proxyUserId ?? null) as any,
          model: params.model || 'unknown',
          period: 'hour',
          periodStart: hourStart,
        },
      },
      create: { ...baseData, period: 'hour', periodStart: hourStart, requestCount: 1, errorCount: isError ? 1 : 0 },
      update: {
        requestCount: { increment: 1 },
        promptTokens: { increment: promptTokens },
        completionTokens: { increment: completionTokens },
        totalTokens: { increment: totalTokens },
        totalDuration: { increment: 0 },
        errorCount: { increment: isError ? 1 : 0 },
      },
    }),
    prisma.usageAggregate.upsert({
      where: {
        accountId_proxyUserId_model_period_periodStart: {
          accountId: params.accountId,
          proxyUserId: (params.proxyUserId ?? null) as any,
          model: params.model || 'unknown',
          period: 'day',
          periodStart: dayStart,
        },
      },
      create: { ...baseData, period: 'day', periodStart: dayStart, requestCount: 1, errorCount: isError ? 1 : 0 },
      update: {
        requestCount: { increment: 1 },
        promptTokens: { increment: promptTokens },
        completionTokens: { increment: completionTokens },
        totalTokens: { increment: totalTokens },
        totalDuration: { increment: 0 },
        errorCount: { increment: isError ? 1 : 0 },
      },
    }),
  ]);
}
