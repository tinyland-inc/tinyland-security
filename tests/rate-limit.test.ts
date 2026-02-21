/**
 * Rate Limiting Unit Tests + Property-Based Testing
 *
 * Tests for:
 *   - Window expiry resets counters
 *   - Counter increment on each check
 *   - Limit enforcement and blocking
 *   - Key generation helpers
 *   - PBT: never exceeds configured limit
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { test as fcTest } from '@fast-check/vitest';
import fc from 'fast-check';
import { RateLimiter, RATE_LIMIT_CONFIGS, getClientIP, createIPKey, createSessionKey, createAccountKey } from '../src/rateLimit.js';
import { RateLimitStore } from '../src/rateLimitStore.js';
import type { RateLimitConfig } from '../src/rateLimit.js';

// ============================================================================
// Test helpers
// ============================================================================

function createLimiter(opts?: { bypassForTesting?: boolean; store?: RateLimitStore }): RateLimiter {
  return new RateLimiter({
    bypassForTesting: opts?.bypassForTesting ?? false,
    store: opts?.store,
  });
}

const testConfig: RateLimitConfig = {
  windowMs: 1000,        // 1 second window (fast for tests)
  maxAttempts: 3,
  blockDurationMs: 2000, // 2 second block
};

// ============================================================================
// Unit Tests
// ============================================================================

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = createLimiter();
  });

  afterEach(() => {
    limiter.destroy();
  });

  describe('checkLimit', () => {
    it('should allow the first request', async () => {
      const result = await limiter.checkLimit('test-key', testConfig);
      expect(result.allowed).toBe(true);
      expect(result.stats.attempts).toBe(1);
      expect(result.stats.remaining).toBe(2);
      expect(result.stats.isBlocked).toBe(false);
    });

    it('should increment counter on successive requests', async () => {
      const r1 = await limiter.checkLimit('test-key', testConfig);
      expect(r1.stats.attempts).toBe(1);
      expect(r1.stats.remaining).toBe(2);

      const r2 = await limiter.checkLimit('test-key', testConfig);
      expect(r2.stats.attempts).toBe(2);
      expect(r2.stats.remaining).toBe(1);

      const r3 = await limiter.checkLimit('test-key', testConfig);
      expect(r3.stats.attempts).toBe(3);
      expect(r3.stats.remaining).toBe(0);
      expect(r3.allowed).toBe(true); // Last allowed attempt
    });

    it('should block after exceeding maxAttempts', async () => {
      // Exhaust the limit
      for (let i = 0; i < testConfig.maxAttempts; i++) {
        await limiter.checkLimit('block-key', testConfig);
      }

      // Next attempt should be blocked
      const blocked = await limiter.checkLimit('block-key', testConfig);
      expect(blocked.allowed).toBe(false);
      expect(blocked.stats.isBlocked).toBe(true);
      expect(blocked.stats.blockedUntil).toBeDefined();
      expect(blocked.retryAfter).toBeGreaterThan(0);
    });

    it('should remain blocked during block duration', async () => {
      for (let i = 0; i < testConfig.maxAttempts; i++) {
        await limiter.checkLimit('persist-key', testConfig);
      }
      // Trigger block
      await limiter.checkLimit('persist-key', testConfig);

      // Immediately check again -- still blocked
      const stillBlocked = await limiter.checkLimit('persist-key', testConfig);
      expect(stillBlocked.allowed).toBe(false);
      expect(stillBlocked.stats.isBlocked).toBe(true);
    });

    it('should reset counter after window expires', async () => {
      vi.useFakeTimers();

      const shortWindow: RateLimitConfig = {
        windowMs: 500,
        maxAttempts: 2,
        blockDurationMs: 1000,
      };

      await limiter.checkLimit('window-key', shortWindow);
      await limiter.checkLimit('window-key', shortWindow);

      // Advance past window
      vi.advanceTimersByTime(600);

      const afterExpiry = await limiter.checkLimit('window-key', shortWindow);
      expect(afterExpiry.allowed).toBe(true);
      expect(afterExpiry.stats.attempts).toBe(1);

      vi.useRealTimers();
    });

    it('should track separate keys independently', async () => {
      await limiter.checkLimit('key-a', testConfig);
      await limiter.checkLimit('key-a', testConfig);

      const resultA = await limiter.checkLimit('key-a', testConfig);
      expect(resultA.stats.attempts).toBe(3);

      const resultB = await limiter.checkLimit('key-b', testConfig);
      expect(resultB.stats.attempts).toBe(1);
    });
  });

  describe('bypass mode', () => {
    it('should always allow when bypassed', async () => {
      const bypassed = createLimiter({ bypassForTesting: true });

      for (let i = 0; i < 100; i++) {
        const result = await bypassed.checkLimit('bypass-key', testConfig);
        expect(result.allowed).toBe(true);
        expect(result.stats.isBlocked).toBe(false);
      }

      bypassed.destroy();
    });
  });

  describe('resetLimit', () => {
    it('should clear rate limit state for a key', async () => {
      for (let i = 0; i < testConfig.maxAttempts; i++) {
        await limiter.checkLimit('reset-key', testConfig);
      }

      await limiter.resetLimit('reset-key');

      const result = await limiter.checkLimit('reset-key', testConfig);
      expect(result.allowed).toBe(true);
      expect(result.stats.attempts).toBe(1);
    });
  });

  describe('getStats', () => {
    it('should return null for unknown key', async () => {
      const stats = await limiter.getStats('nonexistent');
      expect(stats).toBeNull();
    });

    it('should return stats for a tracked key', async () => {
      await limiter.checkLimit('stats-key', testConfig);
      await limiter.checkLimit('stats-key', testConfig);

      const stats = await limiter.getStats('stats-key');
      expect(stats).not.toBeNull();
      expect(stats!.attempts).toBe(2);
    });
  });
});

// ============================================================================
// Key generation helpers
// ============================================================================

describe('Key generation helpers', () => {
  it('createIPKey should produce correct format', () => {
    expect(createIPKey('192.168.1.1')).toBe('ip:192.168.1.1');
    expect(createIPKey('10.0.0.1', 'login')).toBe('login:10.0.0.1');
  });

  it('createSessionKey should produce correct format', () => {
    expect(createSessionKey('sess-abc')).toBe('session:sess-abc');
    expect(createSessionKey('sess-abc', 'totp')).toBe('totp:sess-abc');
  });

  it('createAccountKey should produce correct format', () => {
    expect(createAccountKey('user@example.com')).toBe('account:user@example.com');
    expect(createAccountKey('user@example.com', 'lockout')).toBe('lockout:user@example.com');
  });
});

// ============================================================================
// getClientIP
// ============================================================================

describe('getClientIP', () => {
  function makeRequest(headerMap: Record<string, string>) {
    const headers = new Headers();
    for (const [k, v] of Object.entries(headerMap)) {
      headers.set(k, v);
    }
    return { headers, url: 'https://example.com/test' };
  }

  it('should extract IP from x-forwarded-for', () => {
    const req = makeRequest({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' });
    expect(getClientIP(req)).toBe('1.2.3.4');
  });

  it('should extract IP from x-real-ip', () => {
    const req = makeRequest({ 'x-real-ip': '10.20.30.40' });
    expect(getClientIP(req)).toBe('10.20.30.40');
  });

  it('should prefer x-forwarded-for over x-real-ip', () => {
    const req = makeRequest({
      'x-forwarded-for': '1.1.1.1',
      'x-real-ip': '2.2.2.2',
    });
    expect(getClientIP(req)).toBe('1.1.1.1');
  });

  it('should return unknown when no IP headers present', () => {
    const req = makeRequest({});
    expect(getClientIP(req)).toBe('unknown');
  });
});

// ============================================================================
// Predefined config validation
// ============================================================================

describe('RATE_LIMIT_CONFIGS', () => {
  it('login config should have reasonable defaults', () => {
    const c = RATE_LIMIT_CONFIGS.login;
    expect(c.maxAttempts).toBe(5);
    expect(c.windowMs).toBeGreaterThan(0);
    expect(c.blockDurationMs).toBeGreaterThan(0);
  });

  it('totp config should be stricter than login', () => {
    expect(RATE_LIMIT_CONFIGS.totp.maxAttempts).toBeLessThan(
      RATE_LIMIT_CONFIGS.login.maxAttempts
    );
  });

  it('accountLockout config should have the longest window', () => {
    expect(RATE_LIMIT_CONFIGS.accountLockout.windowMs).toBeGreaterThan(
      RATE_LIMIT_CONFIGS.login.windowMs
    );
  });
});

// ============================================================================
// RateLimitStore
// ============================================================================

describe('RateLimitStore', () => {
  let store: RateLimitStore;

  beforeEach(() => {
    store = new RateLimitStore();
  });

  afterEach(() => {
    store.destroy();
  });

  it('should store and retrieve entries', async () => {
    const entry = {
      key: 'test',
      attempts: 2,
      firstAttemptAt: Date.now(),
      lastAttemptAt: Date.now(),
    };
    await store.set('test', entry);
    const retrieved = await store.get('test');
    expect(retrieved).toEqual(entry);
  });

  it('should delete entries', async () => {
    await store.set('del', { key: 'del', attempts: 1, firstAttemptAt: 0, lastAttemptAt: 0 });
    await store.delete('del');
    expect(await store.get('del')).toBeUndefined();
  });

  it('should report size', async () => {
    expect(await store.size()).toBe(0);
    await store.set('a', { key: 'a', attempts: 1, firstAttemptAt: 0, lastAttemptAt: 0 });
    await store.set('b', { key: 'b', attempts: 1, firstAttemptAt: 0, lastAttemptAt: 0 });
    expect(await store.size()).toBe(2);
  });

  it('should clear all entries', async () => {
    await store.set('x', { key: 'x', attempts: 1, firstAttemptAt: 0, lastAttemptAt: 0 });
    await store.clear();
    expect(await store.size()).toBe(0);
  });

  it('should clean up expired blocked entries', async () => {
    const past = Date.now() - 100_000;
    await store.set('expired', {
      key: 'expired',
      attempts: 10,
      firstAttemptAt: past,
      lastAttemptAt: past,
      blockedUntil: past + 1000, // Expired block
    });
    const cleaned = await store.cleanup();
    expect(cleaned).toBe(1);
    expect(await store.get('expired')).toBeUndefined();
  });
});

// ============================================================================
// Property-Based Tests: Rate limiting never exceeds configured limit
// ============================================================================

describe('PBT: Rate limiting invariants', () => {
  fcTest.prop([
    fc.integer({ min: 1, max: 20 }),   // maxAttempts
    fc.integer({ min: 1, max: 50 }),    // numRequests
  ])('should never allow more than maxAttempts within a window', async (maxAttempts, numRequests) => {
    const store = new RateLimitStore();
    const limiter = new RateLimiter({ bypassForTesting: false, store });
    const config: RateLimitConfig = {
      windowMs: 60_000, // 60 seconds -- won't expire during test
      maxAttempts,
      blockDurationMs: 60_000,
    };

    let allowedCount = 0;

    for (let i = 0; i < numRequests; i++) {
      const result = await limiter.checkLimit('pbt-key', config);
      if (result.allowed) {
        allowedCount++;
      }
    }

    // The invariant: allowed requests never exceed maxAttempts
    expect(allowedCount).toBeLessThanOrEqual(maxAttempts);

    limiter.destroy();
  });

  fcTest.prop([
    fc.string({ minLength: 1, maxLength: 50 }),  // key prefix
    fc.string({ minLength: 1, maxLength: 50 }),   // key suffix
  ])('different keys should be tracked independently', async (prefix, suffix) => {
    const store = new RateLimitStore();
    const limiter = new RateLimiter({ bypassForTesting: false, store });
    const config: RateLimitConfig = {
      windowMs: 60_000,
      maxAttempts: 1,
      blockDurationMs: 60_000,
    };

    const keyA = `a:${prefix}`;
    const keyB = `b:${suffix}`;

    // Exhaust key A
    await limiter.checkLimit(keyA, config);
    const blockedA = await limiter.checkLimit(keyA, config);

    // Key B should still be allowed
    const resultB = await limiter.checkLimit(keyB, config);

    expect(blockedA.allowed).toBe(false);
    expect(resultB.allowed).toBe(true);

    limiter.destroy();
  });
});
