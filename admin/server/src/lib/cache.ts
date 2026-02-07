/**
 * Simple in-memory TTL cache for API responses
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class TTLCache<T = unknown> {
  private cache = new Map<string, CacheEntry<T>>();
  private defaultTTL: number;

  /**
   * Create a new TTL cache
   * @param defaultTTLSeconds Default time-to-live in seconds
   */
  constructor(defaultTTLSeconds = 60) {
    this.defaultTTL = defaultTTLSeconds * 1000;

    // Cleanup expired entries every minute
    setInterval(() => this.cleanup(), 60 * 1000);
  }

  /**
   * Get a value from cache
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  /**
   * Set a value in cache
   * @param key Cache key
   * @param value Value to cache
   * @param ttlSeconds Optional TTL in seconds (overrides default)
   */
  set(key: string, value: T, ttlSeconds?: number): void {
    const ttl = ttlSeconds ? ttlSeconds * 1000 : this.defaultTTL;
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttl,
    });
  }

  /**
   * Delete a value from cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get or set a value with a factory function
   * If key exists and not expired, returns cached value
   * Otherwise calls factory, caches result, and returns it
   */
  async getOrSet<R extends T>(
    key: string,
    factory: () => Promise<R> | R,
    ttlSeconds?: number
  ): Promise<R> {
    const cached = this.get(key);
    if (cached !== undefined) {
      return cached as R;
    }

    const value = await factory();
    this.set(key, value, ttlSeconds);
    return value;
  }

  /**
   * Get or set synchronously
   */
  getOrSetSync<R extends T>(
    key: string,
    factory: () => R,
    ttlSeconds?: number
  ): R {
    const cached = this.get(key);
    if (cached !== undefined) {
      return cached as R;
    }

    const value = factory();
    this.set(key, value, ttlSeconds);
    return value;
  }

  /**
   * Check if a key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Get cache stats
   */
  stats(): { size: number; keys: string[] } {
    this.cleanup();
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * Remove expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}

// Global cache instances for different purposes
export const apiCache = new TTLCache(60); // 1 minute default
export const railwayCache = new TTLCache(300); // 5 minutes for Railway API
export const projectsCache = new TTLCache(30); // 30 seconds for project lists
