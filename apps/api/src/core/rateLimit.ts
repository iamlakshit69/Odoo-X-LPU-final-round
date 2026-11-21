// Core rate limiter utility for public endpoints
import { FastifyRequest } from 'fastify';
import { AppError } from './errors.js';

const ipRateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function rateLimitMiddleware(max = 10, windowMs = 60 * 1000) {
  return async (req: FastifyRequest) => {
    const ip = req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1';
    const route = req.routeOptions?.url || req.url;
    const key = `${ip}:${route}`;
    const now = Date.now();
    const entry = ipRateLimitMap.get(key);

    if (!entry || entry.resetAt <= now) {
      ipRateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
      return;
    }

    if (entry.count >= max) {
      throw new AppError('VALIDATION', 'Too many requests, please try again later', 429);
    }

    entry.count += 1;
  };
}

export function resetRateLimits() {
  ipRateLimitMap.clear();
}
