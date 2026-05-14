import { prisma } from '../db.js';
import { decrypt } from '../crypto.js';
import { config } from '../config.js';
import type { Account } from '@prisma/client';

const roundRobinIndex = new Map<string, number>();

function getStrategyKey(endpoint: string): string {
  return 'global';
}

export function getCooldownMs(): number {
  return config.CIRCUIT_BREAKER_COOLDOWN * 1000;
}

export function getThreshold(): number {
  return config.CIRCUIT_BREAKER_THRESHOLD;
}

export async function selectAccount(endpoint: string): Promise<Account | null> {
  const cooldownThreshold = new Date(Date.now() - getCooldownMs());

  const accounts = await prisma.account.findMany({
    where: {
      OR: [
        { isActive: true },
        {
          isActive: false,
          disabledAt: { not: null, lt: cooldownThreshold },
        },
      ],
    },
    orderBy: { id: 'asc' },
  });

  if (accounts.length === 0) return null;

  const activeAccounts = accounts.filter((a) => a.isActive);
  const pool = activeAccounts.length > 0 ? activeAccounts : accounts;

  const key = getStrategyKey(endpoint);
  const idx = roundRobinIndex.get(key) ?? 0;
  const account = pool[idx % pool.length];
  roundRobinIndex.set(key, (idx + 1) % pool.length);

  return account;
}

export async function markAccountSuccess(accountId: number) {
  try {
    await prisma.account.update({
      where: { id: accountId },
      data: {
        failCount: 0,
        isActive: true,
        disabledAt: null,
        lastUsedAt: new Date(),
      },
    });
  } catch (err: any) {
    if (err.code === 'P2025') return;
    throw err;
  }
}

export async function markAccountFailure(accountId: number) {
  let account: Account | null = null;
  try {
    account = await prisma.account.update({
      where: { id: accountId },
      data: { failCount: { increment: 1 }, lastUsedAt: new Date() },
    });
  } catch (err: any) {
    if (err.code === 'P2025') return;
    throw err;
  }

  if (account && account.failCount >= config.CIRCUIT_BREAKER_THRESHOLD) {
    try {
      await prisma.account.update({
        where: { id: accountId },
        data: { isActive: false, disabledAt: new Date() },
      });
    } catch (err: any) {
      if (err.code === 'P2025') return;
      throw err;
    }
  }
}

export async function reactivateAccount(accountId: number) {
  try {
    await prisma.account.update({
      where: { id: accountId },
      data: { isActive: true, failCount: 0, disabledAt: null },
    });
  } catch (err: any) {
    if (err.code === 'P2025') return;
    throw err;
  }
}

export function getDecryptedApiKey(account: Account): string {
  return decrypt(account.apiKey);
}

export function getProxyAuth(account: Account): { username: string; password: string } | null {
  if (!account.proxyAuth) return null;
  const decoded = decrypt(account.proxyAuth);
  const colonIdx = decoded.indexOf(':');
  if (colonIdx === -1) return null;
  return {
    username: decoded.slice(0, colonIdx),
    password: decoded.slice(colonIdx + 1),
  };
}