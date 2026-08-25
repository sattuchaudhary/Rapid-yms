import { VehicleRCDetails } from '../core/rc.types';

interface CacheEntry {
  data: VehicleRCDetails;
  expiresAt: number;
}

/**
 * Standalone High-Performance In-Memory Cache with TTL
 * Ensures repeat lookups for the same vehicle resolve in < 1ms.
 */
export class RCCacheService {
  private static instance: RCCacheService;
  private cache = new Map<string, CacheEntry>();
  private defaultTtlMs: number = 7 * 24 * 60 * 60 * 1000; // 7 Days default cache

  private constructor() {
    // Periodic cleanup of expired entries every 30 minutes
    setInterval(() => this.cleanup(), 30 * 60 * 1000).unref();
  }

  public static getInstance(): RCCacheService {
    if (!RCCacheService.instance) {
      RCCacheService.instance = new RCCacheService();
    }
    return RCCacheService.instance;
  }

  public get(rcNumber: string): VehicleRCDetails | null {
    const entry = this.cache.get(rcNumber.toUpperCase());
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(rcNumber.toUpperCase());
      return null;
    }

    return {
      ...entry.data,
      cached: true,
    };
  }

  public set(rcNumber: string, data: VehicleRCDetails, ttlMs?: number): void {
    const expiresAt = Date.now() + (ttlMs || this.defaultTtlMs);
    this.cache.set(rcNumber.toUpperCase(), {
      data,
      expiresAt,
    });
  }

  public invalidate(rcNumber: string): void {
    this.cache.delete(rcNumber.toUpperCase());
  }

  public clear(): void {
    this.cache.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}
