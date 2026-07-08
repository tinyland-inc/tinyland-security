/**
 * Shared, cross-replica rate-limit store.
 *
 * The default {@link RateLimitStore} keeps counters in a per-process `Map`. In a
 * multi-replica deploy that lets an attacker spread brute-force attempts across
 * pods, since each pod counts independently and restarts drop state. This store
 * delegates to a shared key/value substrate so every replica sees one counter.
 *
 * It is deliberately backend-agnostic: it does NOT import a Redis client, so the
 * package keeps its databaseless posture and zero runtime dependencies. Instead
 * it accepts any client that satisfies the small {@link RateLimitKVClient}
 * surface — which is a structural subset of `@upstash/redis` (the client used by
 * the `@tummycrypt/tinyland-auth-redis` adapter), so wiring one in is a one-liner:
 *
 * ```ts
 * import { Redis } from '@upstash/redis';
 * import { createSharedRateLimitStore, RateLimiter } from '@tummycrypt/tinyland-security';
 *
 * const store = createSharedRateLimitStore({ client: Redis.fromEnv() });
 * const limiter = new RateLimiter({ store });
 * ```
 *
 * Backends that do not auto-serialize objects (e.g. `ioredis`) should wrap the
 * client so `set` receives a JSON string and `get` returns one, mirroring how
 * `tinyland-auth-redis` leans on Upstash's built-in JSON handling.
 */

import type { RateLimitEntry } from './rateLimit.js';
import type { IRateLimitStore } from './rateLimitStore.js';

/**
 * Minimal key/value contract a shared backend must satisfy. Structurally a
 * subset of `@upstash/redis`'s `Redis`: `get<T>`, `set(key, value, { px })`,
 * and `del`.
 */
export interface RateLimitKVClient {
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: unknown, opts?: { px?: number }): Promise<unknown>;
  del(key: string): Promise<unknown>;
}

export interface SharedRateLimitStoreConfig {
  /** Shared backend client (e.g. an `@upstash/redis` instance). */
  client: RateLimitKVClient;
  /** Key namespace applied to every entry (default: `'ratelimit'`). */
  prefix?: string;
  /**
   * Fallback TTL, in milliseconds, applied to entries that are not currently
   * blocked. Acts as a garbage-collection floor so stale counters expire from
   * the shared backend even if a key is never revisited. Blocked entries always
   * live at least until their `blockedUntil` deadline. Default: 24 hours, which
   * comfortably exceeds every window in `RATE_LIMIT_CONFIGS`.
   */
  ttlMs?: number;
}

const DEFAULT_PREFIX = 'ratelimit';
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * {@link IRateLimitStore} backed by a shared key/value substrate. Expiry is
 * handled by the backend's TTL, so there is no in-process cleanup timer.
 */
export class SharedRateLimitStore implements IRateLimitStore {
  private readonly client: RateLimitKVClient;
  private readonly prefix: string;
  private readonly ttlMs: number;

  constructor(config: SharedRateLimitStoreConfig) {
    if (!config?.client) {
      throw new Error('SharedRateLimitStore requires a `client`');
    }
    this.client = config.client;
    this.prefix = config.prefix ?? DEFAULT_PREFIX;
    this.ttlMs = config.ttlMs ?? DEFAULT_TTL_MS;
  }

  private redisKey(key: string): string {
    return `${this.prefix}:${key}`;
  }

  async get(key: string): Promise<RateLimitEntry | undefined> {
    const value = await this.client.get<RateLimitEntry>(this.redisKey(key));
    return value ?? undefined;
  }

  async set(key: string, entry: RateLimitEntry): Promise<void> {
    const px = this.computeTtlMs(entry);
    await this.client.set(this.redisKey(key), entry, { px });
  }

  async delete(key: string): Promise<void> {
    await this.client.del(this.redisKey(key));
  }

  /**
   * No-op: the shared backend owns its own lifecycle and expires keys via TTL.
   */
  destroy(): void {
    // intentionally empty
  }

  private computeTtlMs(entry: RateLimitEntry): number {
    const untilBlockEnds = entry.blockedUntil ? entry.blockedUntil - Date.now() : 0;
    return Math.max(1, this.ttlMs, untilBlockEnds);
  }
}

/** Factory mirroring `createRedisStorageAdapter` in `tinyland-auth-redis`. */
export const createSharedRateLimitStore = (
  config: SharedRateLimitStoreConfig,
): SharedRateLimitStore => new SharedRateLimitStore(config);
