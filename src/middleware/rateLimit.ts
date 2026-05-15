import type { Request, Response, NextFunction } from 'express';

const userBuckets = new Map<number, { count: number; resetAt: number }>();

export async function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  const proxyUser = (req as any).proxyUser;
  if (!proxyUser) return next();

  const limit = proxyUser.rateLimit;
  if (!limit) return next();

  const now = Date.now();
  let bucket = userBuckets.get(proxyUser.id);

  if (!bucket || now > bucket.resetAt) {
    userBuckets.set(proxyUser.id, { count: 1, resetAt: now + 60_000 });
    return next();
  }

  const newCount = ++bucket.count;
  if (newCount > limit) {
    bucket.count--;
    return res.status(429).json({ error: 'Rate limit exceeded. Try again later.' });
  }

  next();
}

export function cleanupRateLimitBuckets() {
  const now = Date.now();
  for (const [id, bucket] of userBuckets.entries()) {
    if (now > bucket.resetAt) userBuckets.delete(id);
  }
}
