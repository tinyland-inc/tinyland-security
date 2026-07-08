









import type { RateLimitEntry } from './rateLimit.js';

const CLEANUP_INTERVAL = 60 * 60 * 1000;

/**
 * Storage seam for the rate limiter.
 *
 * The default {@link RateLimitStore} keeps state in a per-process `Map`, which
 * is correct for a single instance but leaks brute-force budget across a
 * multi-replica deploy: an attacker can spread attempts over pods and each pod
 * counts independently. Multi-replica deploys must inject a store backed by a
 * shared substrate (see `SharedRateLimitStore`) so every replica reads and
 * writes the same counter.
 *
 * The contract is intentionally tiny — read (`get`), write (`set`, carrying the
 * `blockedUntil` deadline that shared backends translate into a TTL), and reset
 * (`delete`) — keyed by the existing rate-limit keys.
 */
export interface IRateLimitStore {
  get(key: string): Promise<RateLimitEntry | undefined>;
  set(key: string, entry: RateLimitEntry): Promise<void>;
  delete(key: string): Promise<void>;
  /** Release any resources (timers, connections). Safe to call more than once. */
  destroy(): void;
}

/**
 * Default in-memory {@link IRateLimitStore}. Per-process and lost on restart —
 * safe for single-instance/databaseless deploys, NOT safe across replicas.
 */
export class RateLimitStore implements IRateLimitStore {
  private data: Map<string, RateLimitEntry> = new Map();
  private cleanupTimer?: ReturnType<typeof setInterval>;

  constructor() {
    this.startCleanup();
  }

  async get(key: string): Promise<RateLimitEntry | undefined> {
    return this.data.get(key);
  }

  async set(key: string, entry: RateLimitEntry): Promise<void> {
    this.data.set(key, entry);
  }

  async delete(key: string): Promise<void> {
    this.data.delete(key);
  }

  async cleanup(): Promise<number> {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.data.entries()) {
      if (entry.blockedUntil && entry.blockedUntil <= now) {
        this.data.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }

  private startCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(async () => {
      await this.cleanup();
    }, CLEANUP_INTERVAL);

    
    if (this.cleanupTimer && typeof this.cleanupTimer === 'object' && 'unref' in this.cleanupTimer) {
      (this.cleanupTimer as NodeJS.Timeout).unref();
    }
  }

  async clear(): Promise<void> {
    this.data.clear();
  }

  async size(): Promise<number> {
    return this.data.size;
  }

  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }
}
