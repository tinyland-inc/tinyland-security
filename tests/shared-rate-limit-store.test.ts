/**
 * Tests for the rate-limit storage seam and the shared (cross-replica) store.
 *
 * These cover the P0 fix: the default in-memory store is per-process, so a
 * multi-replica deploy lets an attacker spread brute-force attempts across pods.
 * The `IRateLimitStore` interface + `SharedRateLimitStore` let every replica
 * share one counter.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RateLimiter } from '../src/rateLimit.js';
import type { RateLimitConfig, RateLimitEntry } from '../src/rateLimit.js';
import { RateLimitStore, type IRateLimitStore } from '../src/rateLimitStore.js';
import {
  SharedRateLimitStore,
  createSharedRateLimitStore,
  type RateLimitKVClient,
} from '../src/sharedRateLimitStore.js';

/**
 * In-memory fake of a shared KV backend (models `@upstash/redis`'s structural
 * surface). Clones on write so callers cannot mutate stored entries by
 * reference — mirroring a real serializing backend.
 */
class FakeKV implements RateLimitKVClient {
  store = new Map<string, { value: unknown; px?: number }>();
  setCalls: Array<{ key: string; px?: number }> = [];
  delCalls: string[] = [];

  async get<T = unknown>(key: string): Promise<T | null> {
    const hit = this.store.get(key);
    return hit ? (hit.value as T) : null;
  }

  async set(key: string, value: unknown, opts?: { px?: number }): Promise<unknown> {
    this.store.set(key, { value: JSON.parse(JSON.stringify(value)), px: opts?.px });
    this.setCalls.push({ key, px: opts?.px });
    return 'OK';
  }

  async del(key: string): Promise<unknown> {
    this.delCalls.push(key);
    return this.store.delete(key) ? 1 : 0;
  }
}

const strictConfig: RateLimitConfig = {
  windowMs: 60_000,
  maxAttempts: 3,
  blockDurationMs: 60_000,
};

function sampleEntry(overrides: Partial<RateLimitEntry> = {}): RateLimitEntry {
  const now = Date.now();
  return { key: 'k', attempts: 1, firstAttemptAt: now, lastAttemptAt: now, ...overrides };
}

// ---------------------------------------------------------------------------
// Interface conformance
// ---------------------------------------------------------------------------

describe('IRateLimitStore conformance', () => {
  it('the in-memory RateLimitStore satisfies the interface', () => {
    const store: IRateLimitStore = new RateLimitStore();
    expect(typeof store.get).toBe('function');
    expect(typeof store.set).toBe('function');
    expect(typeof store.delete).toBe('function');
    expect(typeof store.destroy).toBe('function');
    store.destroy();
  });

  it('the SharedRateLimitStore satisfies the interface', () => {
    const store: IRateLimitStore = new SharedRateLimitStore({ client: new FakeKV() });
    expect(typeof store.get).toBe('function');
    expect(typeof store.set).toBe('function');
    expect(typeof store.delete).toBe('function');
    expect(typeof store.destroy).toBe('function');
    store.destroy();
  });
});

// ---------------------------------------------------------------------------
// SharedRateLimitStore unit behavior
// ---------------------------------------------------------------------------

describe('SharedRateLimitStore', () => {
  let kv: FakeKV;
  let store: SharedRateLimitStore;

  beforeEach(() => {
    kv = new FakeKV();
    store = new SharedRateLimitStore({ client: kv });
  });

  it('throws when no client is provided', () => {
    // @ts-expect-error deliberately omitting the required client
    expect(() => new SharedRateLimitStore({})).toThrow(/client/);
  });

  it('round-trips an entry through the backend', async () => {
    const entry = sampleEntry({ key: 'foo', attempts: 2 });
    await store.set('foo', entry);
    expect(await store.get('foo')).toEqual(entry);
  });

  it('namespaces keys with the default prefix', async () => {
    await store.set('foo', sampleEntry());
    expect(kv.store.has('ratelimit:foo')).toBe(true);
  });

  it('honors a custom prefix', async () => {
    const custom = new SharedRateLimitStore({ client: kv, prefix: 'rl' });
    await custom.set('foo', sampleEntry());
    expect(kv.store.has('rl:foo')).toBe(true);
  });

  it('returns undefined (not null) for a missing key', async () => {
    expect(await store.get('missing')).toBeUndefined();
  });

  it('deletes an entry', async () => {
    await store.set('gone', sampleEntry());
    await store.delete('gone');
    expect(await store.get('gone')).toBeUndefined();
    expect(kv.delCalls).toContain('ratelimit:gone');
  });

  it('applies the fallback TTL to unblocked entries', async () => {
    const custom = new SharedRateLimitStore({ client: kv, ttlMs: 5_000 });
    await custom.set('foo', sampleEntry());
    expect(kv.setCalls.at(-1)?.px).toBe(5_000);
  });

  it('extends the TTL to cover an active block', async () => {
    const custom = new SharedRateLimitStore({ client: kv, ttlMs: 1_000 });
    const blockedUntil = Date.now() + 10_000;
    await custom.set('foo', sampleEntry({ blockedUntil }));
    // TTL must outlive the block, not the (shorter) fallback TTL.
    expect(kv.setCalls.at(-1)?.px).toBeGreaterThanOrEqual(9_000);
  });

  it('createSharedRateLimitStore builds an equivalent instance', () => {
    const built = createSharedRateLimitStore({ client: kv });
    expect(built).toBeInstanceOf(SharedRateLimitStore);
  });
});

// ---------------------------------------------------------------------------
// RateLimiter honors an injected store
// ---------------------------------------------------------------------------

describe('RateLimiter store injection', () => {
  it('routes all reads and writes through the injected store', async () => {
    const backing = new Map<string, RateLimitEntry>();
    const mock: IRateLimitStore = {
      get: vi.fn(async (k: string) => backing.get(k)),
      set: vi.fn(async (k: string, e: RateLimitEntry) => {
        backing.set(k, e);
      }),
      delete: vi.fn(async (k: string) => {
        backing.delete(k);
      }),
      destroy: vi.fn(),
    };

    const limiter = new RateLimiter({ bypassForTesting: false, store: mock });
    const result = await limiter.checkLimit('key', strictConfig);

    expect(result.allowed).toBe(true);
    expect(mock.get).toHaveBeenCalledWith('key');
    expect(mock.set).toHaveBeenCalledTimes(1);

    limiter.destroy();
    expect(mock.destroy).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// The P0 itself: shared state across replicas
// ---------------------------------------------------------------------------

describe('multi-replica brute-force accounting', () => {
  it('a shared store carries the block across replicas', async () => {
    const kv = new FakeKV();
    // Two independent limiter instances (two pods) over ONE shared backend.
    const replicaA = new RateLimiter({
      bypassForTesting: false,
      store: new SharedRateLimitStore({ client: kv }),
    });
    const replicaB = new RateLimiter({
      bypassForTesting: false,
      store: new SharedRateLimitStore({ client: kv }),
    });

    // Exhaust the budget on replica A (maxAttempts = 3, all allowed).
    for (let i = 0; i < strictConfig.maxAttempts; i++) {
      const r = await replicaA.checkLimit('ip:1.2.3.4', strictConfig);
      expect(r.allowed).toBe(true);
    }

    // The next attempt lands on replica B and MUST be blocked, because B reads
    // the shared counter rather than its own empty Map.
    const spillover = await replicaB.checkLimit('ip:1.2.3.4', strictConfig);
    expect(spillover.allowed).toBe(false);
    expect(spillover.stats.isBlocked).toBe(true);

    replicaA.destroy();
    replicaB.destroy();
  });

  it('per-replica in-memory stores leak the budget (the vulnerability being fixed)', async () => {
    // Same scenario, but each replica keeps its own in-memory Map.
    const replicaA = new RateLimiter({ bypassForTesting: false, store: new RateLimitStore() });
    const replicaB = new RateLimiter({ bypassForTesting: false, store: new RateLimitStore() });

    for (let i = 0; i < strictConfig.maxAttempts; i++) {
      await replicaA.checkLimit('ip:1.2.3.4', strictConfig);
    }

    // Replica B sees a fresh counter and lets the attacker keep going.
    const spillover = await replicaB.checkLimit('ip:1.2.3.4', strictConfig);
    expect(spillover.allowed).toBe(true);

    replicaA.destroy();
    replicaB.destroy();
  });
});
