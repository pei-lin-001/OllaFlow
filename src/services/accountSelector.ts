import { prisma } from '../db.js';
import { decrypt } from '../crypto.js';
import type { Account } from '@prisma/client';

const roundRobinIndex = new Map<string, number>();

function getStrategyKey(endpoint: string): string {
  return 'global';
}

export async function selectAccount(endpoint: string): Promise<Account | null> {
  const accounts = await prisma.account.findMany({
    where: { isActive: true },
    orderBy: { id: 'asc' },
  });

  if (accounts.length === 0) return null;

  const key = getStrategyKey(endpoint);
  const idx = roundRobinIndex.get(key) ?? 0;
  const account = accounts[idx % accounts.length];
  roundRobinIndex.set(key, (idx + 1) % accounts.length);

  return account;
}

export async function markAccountSuccess(accountId: number) {
  await prisma.account.update({
    where: { id: accountId },
    data: { failCount: 0, lastUsedAt: new Date() },
  });
}

export async function markAccountFailure(accountId: number) {
  const account = await prisma.account.update({
    where: { id: accountId },
    data: { failCount: { increment: 1 }, lastUsedAt: new Date() },
  });

  if (account.failCount >= 3) {
    await prisma.account.update({
      where: { id: accountId },
      data: { isActive: false },
    });
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
