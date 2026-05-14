import { PrismaClient } from '@prisma/client';

// Helper to serialize BigInt recursively
function serializeBigInt(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') return Number(obj);
  if (typeof obj !== 'object') return obj;
  if (obj instanceof Date) return obj;
  if (Array.isArray(obj)) return obj.map(serializeBigInt);
  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = serializeBigInt(value);
  }
  return result;
}

function serializeResult(result: any): any {
  if (result === null || result === undefined) return result;
  if (Array.isArray(result)) return result.map(serializeBigInt);
  return serializeBigInt(result);
}

// Extended Prisma Client with automatic BigInt serialization
const _prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

export const prisma = new Proxy(_prisma, {
  get(target, prop) {
    const model = (target as any)[prop];
    if (model && typeof model === 'object') {
      return new Proxy(model, {
        get(targetModel, method) {
          const fn = targetModel[method as keyof typeof targetModel];
          if (typeof fn === 'function') {
            return async (...args: any[]) => {
              const result = await fn.apply(targetModel, args);
              return serializeResult(result);
            };
          }
          return fn;
        },
      });
    }
    return model;
  },
});
