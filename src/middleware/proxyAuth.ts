import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db.js';

export async function proxyAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header. Use Bearer <token>.' });
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return res.status(401).json({ error: 'Empty API key.' });
  }

  const proxyUser = await prisma.proxyUser.findUnique({
    where: { apiKey: token },
  });

  if (!proxyUser || !proxyUser.isActive) {
    return res.status(401).json({ error: 'Invalid or deactivated API key.' });
  }

  (req as any).proxyUser = proxyUser;
  next();
}
