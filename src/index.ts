import express from 'express';
import { config } from './config.js';
import { prisma } from './db.js';
import { proxyAuthMiddleware } from './middleware/proxyAuth.js';
import { rateLimitMiddleware, cleanupRateLimitBuckets } from './middleware/rateLimit.js';
import { proxyHandler } from './routes/proxy.js';
import adminRouter from './routes/admin.js';
import bcrypt from 'bcryptjs';

const app = express();
const jsonParser = express.json({ limit: '10mb' });
const MAX_BLOB_SIZE = 50 * 1024 * 1024;

app.use((req, res, next) => {
  if (req.path.startsWith('/api/blobs/')) {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > MAX_BLOB_SIZE) {
        res.status(413).json({ error: 'Payload too large.' });
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      (req as any).rawBody = Buffer.concat(chunks);
      next();
    });
    req.on('error', (err) => next(err));
  } else {
    jsonParser(req, res, next);
  }
});

// Health check (no auth)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Admin API (no proxy auth)
app.use('/admin/api', adminRouter);

// Serve frontend static files
app.use('/admin', express.static('dist/frontend'));
app.use('/', express.static('dist/frontend'));

// Fallback to index.html for SPA routes
app.get('/admin/*', (_req, res) => {
  res.sendFile('dist/frontend/index.html', { root: process.cwd() });
});

// Proxy API: auth + rate limit + forward
app.all('/api/*', proxyAuthMiddleware, rateLimitMiddleware, proxyHandler);
app.all('/v1/*', proxyAuthMiddleware, rateLimitMiddleware, proxyHandler);

// Global error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

async function bootstrap() {
  // Ensure default admin exists
  const existing = await prisma.adminUser.findFirst();
  if (!existing) {
    const hash = await bcrypt.hash(config.ADMIN_PASSWORD, 10);
    await prisma.adminUser.create({
      data: { username: config.ADMIN_USERNAME, password: hash },
    });
    console.log(`Created default admin user: ${config.ADMIN_USERNAME}`);
  }

  app.listen(config.PORT, () => {
    console.log(`OllaFlow listening on http://0.0.0.0:${config.PORT}`);
    console.log(`Admin API:  http://0.0.0.0:${config.PORT}/admin/api`);
  });

  setInterval(cleanupRateLimitBuckets, 60_000);
}

bootstrap().catch((err) => {
  console.error('Bootstrap failed:', err);
  process.exit(1);
});
