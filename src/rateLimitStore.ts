/**
 * In-memory rate limit storage with automatic cleanup
 *
 * For production use, consider replacing with Redis or another
 * persistent store. This in-memory store is suitable for
 * single-process deployments and testing.
 *
 * @module rateLimitStore
 */

import type { RateLimitEntry } from './rateLimit.js';

const CLEANUP_INTERVAL = 60 * 60 * 1000; // Clean up every hour

export class RateLimitStore {
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

    // Don't prevent process exit
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
