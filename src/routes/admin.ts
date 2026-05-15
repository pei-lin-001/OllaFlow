import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../db.js';
import { config } from '../config.js';
import { encrypt, decrypt } from '../crypto.js';
import { adminAuthMiddleware } from '../middleware/adminAuth.js';
import { reactivateAccount } from '../services/accountSelector.js';
import { getActiveRequests } from '../services/activeRequests.js';

const router = Router();

// ── Auth ─────────────────────────────────────────────

router.post('/login', async (req, res) => {
  const schema = z.object({
    username: z.string().min(1),
    password: z.string().min(1),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid credentials format.' });
  }

  const { username, password } = parsed.data;
  const admin = await prisma.adminUser.findUnique({ where: { username } });
  if (!admin || !(await bcrypt.compare(password, admin.password))) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  const token = jwt.sign({ adminId: admin.id, username: admin.username }, config.JWT_SECRET, {
    expiresIn: '7d',
  });

  res.json({ token, username: admin.username });
});

// ── Admin middleware for all below ─────────────────────

router.use(adminAuthMiddleware);

// ── Dashboard stats ──────────────────────────────────

router.get('/dashboard', async (_req, res) => {
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [totalRequests, todayAgg, totalAccounts, totalProxyUsers] = await Promise.all([
    prisma.usageRecord.count(),
    prisma.usageAggregate.findMany({
      where: { period: 'day', periodStart: dayStart },
    }),
    prisma.account.count(),
    prisma.proxyUser.count(),
  ]);

  const todayTokens = todayAgg.reduce((sum, a) => sum + a.totalTokens, 0);
  const todayRequests = todayAgg.reduce((sum, a) => sum + a.requestCount, 0);

  res.json({
    totalRequests,
    todayTokens,
    todayRequests,
    totalAccounts,
    totalProxyUsers,
  });
});

router.get('/circuit-breaker-config', (_req, res) => {
  res.json({
    threshold: config.CIRCUIT_BREAKER_THRESHOLD,
    cooldownSeconds: config.CIRCUIT_BREAKER_COOLDOWN,
  });
});

router.get('/active-requests', (_req, res) => {
  const requests = getActiveRequests().map((r) => ({
    ...r,
    elapsedMs: Date.now() - r.startTime,
  }));
  res.json(requests);
});

// ── Accounts ─────────────────────────────────────���───

router.get('/accounts', async (_req, res) => {
  const accounts = await prisma.account.findMany({ orderBy: { id: 'asc' } });
  res.json(
    accounts.map((a) => ({
      id: a.id,
      name: a.name,
      proxyUrl: a.proxyUrl,
      isActive: a.isActive,
      weight: a.weight,
      failCount: a.failCount,
      disabledAt: a.disabledAt,
      lastUsedAt: a.lastUsedAt,
      createdAt: a.createdAt,
    }))
  );
});

const accountSchema = z.object({
  name: z.string().min(1).max(100),
  apiKey: z.string().min(1),
  proxyUrl: z.preprocess((v) => (v === '' || v === null || v === undefined) ? null : v, z.string().url().nullable().optional()),
  proxyAuth: z.preprocess((v) => (v === '' || v === null || v === undefined) ? null : v, z.string().nullable().optional()),
  isActive: z.boolean().default(true),
  weight: z.number().int().min(1).max(100).default(1),
});

router.post('/accounts', async (req, res) => {
  const parsed = accountSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.format() });

  const data = parsed.data;
  const encryptedKey = encrypt(data.apiKey);
  const encryptedProxyAuth = data.proxyAuth ? encrypt(data.proxyAuth) : null;

  const account = await prisma.account.create({
    data: {
      name: data.name,
      apiKey: encryptedKey,
      proxyUrl: data.proxyUrl ?? null,
      proxyAuth: encryptedProxyAuth,
      isActive: data.isActive,
      weight: data.weight,
    },
  });

  res.status(201).json({ id: account.id, name: account.name });
});

router.patch('/accounts/:id', async (req, res) => {
  const id = Number(req.params.id);
  const parsed = accountSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.format() });

  const data = parsed.data;
  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.apiKey !== undefined) updateData.apiKey = encrypt(data.apiKey);
  if (data.proxyUrl !== undefined) updateData.proxyUrl = data.proxyUrl ?? null;
  if (data.proxyAuth !== undefined) updateData.proxyAuth = data.proxyAuth ? encrypt(data.proxyAuth) : null;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.weight !== undefined) updateData.weight = data.weight;

  try {
    const account = await prisma.account.update({ where: { id }, data: updateData });
    res.json({ id: account.id, name: account.name });
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Account not found' });
    throw err;
  }
});

router.delete('/accounts/:id', async (req, res) => {
  const id = Number(req.params.id);
  try {
    await prisma.account.delete({ where: { id } });
    res.status(204).send();
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Account not found' });
    if (err.code === 'P2003') return res.status(409).json({ error: 'Cannot delete account: referenced by other records' });
    throw err;
  }
});

router.post('/accounts/:id/test', async (req, res) => {
  const id = Number(req.params.id);
  const account = await prisma.account.findUnique({ where: { id } });
  if (!account) return res.status(404).json({ error: 'Account not found' });

  const { forwardToOllama } = await import('../services/ollamaClient.js');
  try {
    const resp = await forwardToOllama(account, 'GET', '/api/tags', {});
    const chunks: Buffer[] = [];
    resp.body.on('data', (c: Buffer) => chunks.push(c));
    resp.body.on('end', async () => {
      const body = Buffer.concat(chunks).toString('utf8');
      if (resp.statusCode === 200) {
        await reactivateAccount(id);
      }
      res.json({ success: resp.statusCode === 200, statusCode: resp.statusCode, body: body.slice(0, 500) });
    });
  } catch (err: any) {
    res.status(502).json({ success: false, error: err.message });
  }
});

router.post('/accounts/:id/reactivate', async (req, res) => {
  const id = Number(req.params.id);
  const account = await prisma.account.findUnique({ where: { id } });
  if (!account) return res.status(404).json({ error: 'Account not found' });

  await reactivateAccount(id);
  res.json({ success: true });
});

// ── Proxy Users ──────────────────────────────────────

router.get('/proxy-users', async (_req, res) => {
  const users = await prisma.proxyUser.findMany({ orderBy: { id: 'asc' } });
  res.json(users);
});

const proxyUserSchema = z.object({
  name: z.string().min(1).max(100),
  apiKey: z.string().min(8).optional(),
  isActive: z.boolean().default(true),
  rateLimit: z.number().int().min(1).optional().nullable(),
});

router.post('/proxy-users', async (req, res) => {
  const parsed = proxyUserSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.format() });

  const data = parsed.data;
  const apiKey = data.apiKey || crypto.randomUUID();

  const user = await prisma.proxyUser.create({
    data: {
      name: data.name,
      apiKey,
      isActive: data.isActive,
      rateLimit: data.rateLimit ?? null,
    },
  });

  res.status(201).json(user);
});

router.patch('/proxy-users/:id', async (req, res) => {
  const id = Number(req.params.id);
  const parsed = proxyUserSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.format() });

  const data = parsed.data;
  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.apiKey !== undefined) updateData.apiKey = data.apiKey;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.rateLimit !== undefined) updateData.rateLimit = data.rateLimit ?? null;

  try {
    const user = await prisma.proxyUser.update({ where: { id }, data: updateData });
    res.json(user);
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Proxy user not found' });
    throw err;
  }
});

router.delete('/proxy-users/:id', async (req, res) => {
  const id = Number(req.params.id);
  try {
    await prisma.proxyUser.delete({ where: { id } });
    res.status(204).send();
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Proxy user not found' });
    if (err.code === 'P2003') return res.status(409).json({ error: 'Cannot delete proxy user: referenced by other records' });
    throw err;
  }
});

// ── Usage ────────────────────────────────────────────

router.get('/usage', async (req, res) => {
  const { accountId, proxyUserId, model, from, to, groupBy = 'day' } = req.query;

  const where: any = {};
  if (accountId) where.accountId = Number(accountId);
  if (proxyUserId) where.proxyUserId = Number(proxyUserId);
  if (model) where.model = String(model);
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(String(from));
    if (to) where.createdAt.lte = new Date(String(to));
  }

  const records = await prisma.usageRecord.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 500,
  });

  res.json(records);
});

router.get('/usage/aggregate', async (req, res) => {
  const { accountId, proxyUserId, model, from, to, period = 'day' } = req.query;

  const where: any = { period: String(period) };
  if (accountId) where.accountId = Number(accountId);
  if (proxyUserId) where.proxyUserId = Number(proxyUserId);
  if (model) where.model = String(model);
  if (from || to) {
    where.periodStart = {};
    if (from) where.periodStart.gte = new Date(String(from));
    if (to) where.periodStart.lte = new Date(String(to));
  }

  const aggregates = await prisma.usageAggregate.findMany({
    where,
    orderBy: { periodStart: 'asc' },
  });

  res.json(aggregates);
});

router.get('/usage/by-model', async (req, res) => {
  const { from, to } = req.query;

  const where: any = {};
  if (from) where.createdAt = { ...where.createdAt, gte: new Date(String(from)) };
  if (to) where.createdAt = { ...where.createdAt, lte: new Date(String(to)) };

  const records = await prisma.usageRecord.findMany({ where });

  // Join with RequestLog to get durationMs and ttffbMs for TPS calculation
  // Group results by model
  const models = new Map<string, { requestCount: number; promptTokens: number; completionTokens: number; totalTokens: number; totalTpsWeighted: number; tpsCount: number }>();

  for (const r of records) {
    const m = r.model || 'unknown';
    const entry = models.get(m) || { requestCount: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, totalTpsWeighted: 0, tpsCount: 0 };
    entry.requestCount += 1;
    entry.promptTokens += r.promptEvalCount ?? 0;
    entry.completionTokens += r.evalCount ?? 0;
    entry.totalTokens += (r.promptEvalCount ?? 0) + (r.evalCount ?? 0);

    // Calculate per-record TPS:
    // 1. Ollama native: evalCount / (evalDuration_ns / 1e9)
    // 2. Fallback: evalCount / ((totalDuration_ns / 1e9)) if available
    // Only count if we have evalCount > 0 and a valid duration
    if (r.evalCount && r.evalCount > 0) {
      if (r.evalDuration && r.evalDuration > 0n) {
        // Ollama native: precise TPS from eval_duration
        const evalDurationNs = Number(r.evalDuration);
        const tps = r.evalCount / (evalDurationNs / 1e9);
        entry.totalTpsWeighted += tps * r.evalCount; // weighted by token count
        entry.tpsCount += r.evalCount;
      } else if (r.totalDuration && r.totalDuration > 0n) {
        // Fallback: use total_duration (includes load + prompt eval)
        const totalDurationNs = Number(r.totalDuration);
        const tps = r.evalCount / (totalDurationNs / 1e9);
        entry.totalTpsWeighted += tps * r.evalCount;
        entry.tpsCount += r.evalCount;
      }
    }

    models.set(m, entry);
  }

  const result = Array.from(models.entries()).map(([model, data]) => {
    // Weighted average TPS: sum(tps * tokens) / sum(tokens)
    const avgTps = data.tpsCount > 0 ? Math.round((data.totalTpsWeighted / data.tpsCount) * 10) / 10 : null;

    return {
      model,
      requestCount: data.requestCount,
      promptTokens: data.promptTokens,
      completionTokens: data.completionTokens,
      totalTokens: data.totalTokens,
      avgTps,
    };
  }).sort((a, b) => b.requestCount - a.requestCount);

  res.json(result);
});

// ── Logs ─────────────────────────────────────────────

router.get('/logs', async (req, res) => {
  const { accountId, proxyUserId, endpoint, from, to, page = '1', pageSize = '50' } = req.query;

  const where: any = {};
  if (accountId) where.accountId = Number(accountId);
  if (proxyUserId) where.proxyUserId = Number(proxyUserId);
  if (endpoint) where.endpoint = { contains: String(endpoint) };
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(String(from));
    if (to) where.createdAt.lte = new Date(String(to));
  }

  const skip = (Number(page) - 1) * Number(pageSize);
  const [logs, total] = await Promise.all([
    prisma.requestLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: Number(pageSize),
    }),
    prisma.requestLog.count({ where }),
  ]);

  res.json({ logs, total, page: Number(page), pageSize: Number(pageSize) });
});

// ── Settings / Cleanup ───────────────────────────────

router.post('/cleanup', async (_req, res) => {
  const days = config.LOG_RETENTION_DAYS;
  if (days <= 0) return res.json({ message: 'Log retention is disabled (0 days).' });

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const deleted = await prisma.requestLog.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });

  res.json({ deleted: deleted.count, cutoff });
});

// ── Change Password ───────────────────────────────────

router.patch('/password', async (req, res) => {
  const schema = z.object({
    oldPassword: z.string().min(1),
    newPassword: z.string().min(6),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.format() });

  const { oldPassword, newPassword } = parsed.data;
  const adminId = (req as any).adminUser.adminId;

  const admin = await prisma.adminUser.findUnique({ where: { id: adminId } });
  if (!admin) return res.status(404).json({ error: '用户不存在' });

  if (!(await bcrypt.compare(oldPassword, admin.password))) {
    return res.status(400).json({ error: '当前密码错误' });
  }

  const hash = await bcrypt.hash(newPassword, 10);
  await prisma.adminUser.update({ where: { id: adminId }, data: { password: hash } });

  res.json({ message: '密码修改成功' });
});

// ── Admin Users ───────────────────────────────────────

router.get('/admins', async (_req, res) => {
  const admins = await prisma.adminUser.findMany({
    orderBy: { id: 'asc' },
    select: { id: true, username: true, createdAt: true },
  });
  res.json(admins);
});

router.post('/admins', async (req, res) => {
  const schema = z.object({
    username: z.string().min(2).max(50),
    password: z.string().min(6),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.format() });

  const { username, password } = parsed.data;

  const existing = await prisma.adminUser.findUnique({ where: { username } });
  if (existing) return res.status(409).json({ error: '用户名已存在' });

  const hash = await bcrypt.hash(password, 10);
  const admin = await prisma.adminUser.create({
    data: { username, password: hash },
  });

  res.status(201).json({ id: admin.id, username: admin.username });
});

router.delete('/admins/:id', async (req, res) => {
  const id = Number(req.params.id);
  const currentAdminId = (req as any).adminUser.adminId;

  if (id === currentAdminId) {
    return res.status(400).json({ error: '不能删除当前登录的管理员' });
  }

  try {
    await prisma.adminUser.delete({ where: { id } });
    res.status(204).send();
  } catch (err: any) {
    if (err.code === 'P2025') return res.status(404).json({ error: '用户不存在' });
    throw err;
  }
});

export default router;
