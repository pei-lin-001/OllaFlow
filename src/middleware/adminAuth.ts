import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export interface AdminJwtPayload {
  adminId: number;
  username: string;
}

export function adminAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing Authorization header.' });
  }

  const token = authHeader.slice(7).trim();
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET) as AdminJwtPayload;
    (req as any).adminUser = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}
