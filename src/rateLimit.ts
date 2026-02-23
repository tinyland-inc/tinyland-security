






import { RateLimitStore } from './rateLimitStore.js';
import type { SecurityRequest } from './types.js';

export interface RateLimitConfig {
  windowMs: number;
  maxAttempts: number;
  blockDurationMs: number;
}

export interface RateLimitStats {
  attempts: number;
  remaining: number;
  resetAt: number;
  isBlocked: boolean;
  blockedUntil?: number;
}

export interface RateLimitEntry {
  key: string;
  attempts: number;
  firstAttemptAt: number;
  lastAttemptAt: number;
  blockedUntil?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  stats: RateLimitStats;
  retryAfter?: number;
}

export const RATE_LIMIT_CONFIGS = {
  login: {
    windowMs: 15 * 60 * 1000,
    maxAttempts: 5,
    blockDurationMs: 15 * 60 * 1000
  } as RateLimitConfig,

  totp: {
    windowMs: 5 * 60 * 1000,
    maxAttempts: 3,
    blockDurationMs: 5 * 60 * 1000
  } as RateLimitConfig,

  accountLockout: {
    windowMs: 60 * 60 * 1000,
    maxAttempts: 10,
    blockDurationMs: 60 * 60 * 1000
  } as RateLimitConfig
};

export class RateLimiter {
  private store: RateLimitStore;
  private bypassForTesting: boolean;

  constructor(options?: { bypassForTesting?: boolean; store?: RateLimitStore }) {
    this.store = options?.store ?? new RateLimitStore();
    this.bypassForTesting = options?.bypassForTesting ?? (
      process.env.NODE_ENV === 'test' ||
      process.env.RATE_LIMIT_BYPASS === 'true'
    );
  }

  


  async checkLimit(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
    if (this.bypassForTesting) {
      return {
        allowed: true,
        stats: {
          attempts: 0,
          remaining: config.maxAttempts,
          resetAt: Date.now() + config.windowMs,
          isBlocked: false
        }
      };
    }

    const now = Date.now();
    const entry = await this.store.get(key);

    if (entry?.blockedUntil && entry.blockedUntil > now) {
      const retryAfter = Math.ceil((entry.blockedUntil - now) / 1000);
      return {
        allowed: false,
        stats: {
          attempts: entry.attempts,
          remaining: 0,
          resetAt: entry.blockedUntil,
          isBlocked: true,
          blockedUntil: entry.blockedUntil
        },
        retryAfter
      };
    }

    if (!entry || now - entry.firstAttemptAt > config.windowMs) {
      await this.store.set(key, {
        key,
        attempts: 1,
        firstAttemptAt: now,
        lastAttemptAt: now
      });
      return {
        allowed: true,
        stats: {
          attempts: 1,
          remaining: config.maxAttempts - 1,
          resetAt: now + config.windowMs,
          isBlocked: false
        }
      };
    }

    const newAttempts = entry.attempts + 1;
    const remaining = Math.max(0, config.maxAttempts - newAttempts);

    if (newAttempts > config.maxAttempts) {
      const blockedUntil = now + config.blockDurationMs;
      await this.store.set(key, {
        ...entry,
        attempts: newAttempts,
        lastAttemptAt: now,
        blockedUntil
      });
      const retryAfter = Math.ceil(config.blockDurationMs / 1000);

      console.warn(
        `[RateLimit] Violation: ${key} exceeded limit (${newAttempts}/${config.maxAttempts})`
      );

      return {
        allowed: false,
        stats: {
          attempts: newAttempts,
          remaining: 0,
          resetAt: blockedUntil,
          isBlocked: true,
          blockedUntil
        },
        retryAfter
      };
    }

    await this.store.set(key, {
      ...entry,
      attempts: newAttempts,
      lastAttemptAt: now
    });

    return {
      allowed: true,
      stats: {
        attempts: newAttempts,
        remaining,
        resetAt: entry.firstAttemptAt + config.windowMs,
        isBlocked: false
      }
    };
  }

  async resetLimit(key: string): Promise<void> {
    await this.store.delete(key);
  }

  async getStats(key: string): Promise<RateLimitStats | null> {
    const entry = await this.store.get(key);
    if (!entry) return null;

    const now = Date.now();
    return {
      attempts: entry.attempts,
      remaining: 0,
      resetAt: entry.firstAttemptAt + (entry.blockedUntil ? 0 : 60000),
      isBlocked: !!entry.blockedUntil && entry.blockedUntil > now,
      blockedUntil: entry.blockedUntil
    };
  }

  destroy(): void {
    this.store.destroy();
  }
}




export function getClientIP(request: SecurityRequest): string {
  const headers = request.headers;
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIP = headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  return 'unknown';
}




export function createIPKey(ip: string, prefix: string = 'ip'): string {
  return `${prefix}:${ip}`;
}




export function createSessionKey(sessionId: string, prefix: string = 'session'): string {
  return `${prefix}:${sessionId}`;
}




export function createAccountKey(identifier: string, prefix: string = 'account'): string {
  return `${prefix}:${identifier}`;
}
