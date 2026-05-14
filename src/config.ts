import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const configSchema = z.object({
  PORT: z.string().default('6478').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().default('file:./prisma/data/app.db'),
  ENCRYPTION_KEY: z.string().min(32, 'Encryption key must be at least 32 characters'),
  JWT_SECRET: z.string().min(16, 'JWT secret must be at least 16 characters'),
  OLLAMA_CLOUD_HOST: z.string().url().default('https://ollama.com'),
  ADMIN_USERNAME: z.string().default('admin'),
  ADMIN_PASSWORD: z.string().default('admin'),
  CIRCUIT_BREAKER_THRESHOLD: z.string().default('3').transform(Number),
  CIRCUIT_BREAKER_COOLDOWN: z.string().default('300').transform(Number),
  LOG_RETENTION_DAYS: z.string().default('30').transform(Number),
  SAVE_REQUEST_BODIES: z.string().default('false').transform(v => v === 'true'),
  SAVE_RESPONSE_BODIES: z.string().default('false').transform(v => v === 'true'),
});

const parsed = configSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Config validation error:', parsed.error.format());
  process.exit(1);
}

export const config = parsed.data;
