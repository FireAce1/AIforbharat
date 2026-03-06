/**
 * In-Memory LRU Cache Manager
 * 
 * Implements a Least Recently Used (LRU) cache with:
 * - Automatic eviction when size limit reached
 * - TTL support for automatic expiration
 * - Pattern-based deletion
 * - Memory-efficient storage
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

interface CacheOptions {
  maxSize: number;      // Maximum number of entries
  maxAge?: number;      // Default TTL in milliseconds
}

export class MemoryCacheManager {
  private cache: Map<string, CacheEntry<any>>;
  private accessOrder: string[];
  private maxSize: number;
  private defaultMaxAge: number;

  constructor(options: CacheOptions) {
    this.cache = new Map();
    this.accessOrder = [];
    this.maxSize = options.maxSize;
    this.defaultMaxAge = options.maxAge || 300000; // 5 minutes default
  }

  /**
   * Get value from cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      return null;
    }
    
    // Update access order (move to end = most recently used)
    this.updateAccessOrder(key);
    
    return entry.value as T;
  }

  /**
   * Set value in cache
   */
  set<T>(key: string, value: T, ttl?: number): void {
    const maxAge = ttl || this.defaultMaxAge;
    const expiresAt = Date.now() + maxAge;
    
    // If key exists, update it
    if (this.cache.has(key)) {
      this.cache.set(key, { value, expiresAt });
      this.updateAccessOrder(key);
      return;
    }
    
    // Check if we need to evict
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }
    
    // Add new entry
    this.cache.set(key, { value, expiresAt });
    this.accessOrder.push(key);
  }

  /**
   * Delete value from cache
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    
    if (deleted) {
      this.removeFromAccessOrder(key);
    }
    
    return deleted;
  }

  /**
   * Delete all keys matching pattern (supports wildcards)
   */
  deletePattern(pattern: string): number {
    const regex = new RegExp(
      '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
    );
    
    let deletedCount = 0;
    
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.delete(key);
        deletedCount++;
      }
    }
    
    return deletedCount;
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }
    
    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      return false;
    }
    
    return true;
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Get all keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Clean up expired entries
   */
  cleanup(): number {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        this.removeFromAccessOrder(key);
        cleanedCount++;
      }
    }
    
    return cleanedCount;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const now = Date.now();
    let expiredCount = 0;
    
    for (const entry of this.cache.values()) {
      if (now > entry.expiresAt) {
        expiredCount++;
      }
    }
    
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      utilization: (this.cache.size / this.maxSize) * 100,
      expiredCount,
    };
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    if (this.accessOrder.length === 0) {
      return;
    }
    
    // First entry is least recently used
    const lruKey = this.accessOrder.shift();
    
    if (lruKey) {
      this.cache.delete(lruKey);
    }
  }

  /**
   * Update access order (move key to end)
   */
  private updateAccessOrder(key: string): void {
    this.removeFromAccessOrder(key);
    this.accessOrder.push(key);
  }

  /**
   * Remove key from access order
   */
  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    
    if (index !== -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  /**
   * Start automatic cleanup interval
   */
  startCleanupInterval(intervalMs: number = 60000): NodeJS.Timeout {
    return setInterval(() => {
      const cleaned = this.cleanup();
      
      if (cleaned > 0) {
        console.log(`Memory cache cleanup: removed ${cleaned} expired entries`);
      }
    }, intervalMs);
  }
}

export default MemoryCacheManager;
