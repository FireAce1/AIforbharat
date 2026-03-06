/**
 * Redis Cache Utility Module
 * Provides helper functions for cache operations with standardized key naming
 * and TTL policies
 */

const { getRedisClient } = require('../config/redis');

/**
 * TTL Policies (in seconds)
 */
const TTL = {
  OTP: 300,           // 5 minutes
  API_RESPONSE: 3600, // 1 hour
  SESSION: 604800,    // 7 days
};

/**
 * Generate cache key following convention: service:resource:id
 * @param {string} service - Service name (e.g., 'auth', 'crop', 'market')
 * @param {string} resource - Resource type (e.g., 'otp', 'user', 'session')
 * @param {string} id - Resource identifier
 * @returns {string} Formatted cache key
 */
function generateKey(service, resource, id) {
  return `${service}:${resource}:${id}`;
}

/**
 * Get value from cache
 * @param {string} key - Cache key
 * @returns {Promise<string|null>} Cached value or null if not found
 */
async function get(key) {
  try {
    const client = getRedisClient();
    const value = await client.get(key);
    return value;
  } catch (error) {
    console.error(`Cache GET error for key ${key}:`, error);
    return null;
  }
}

/**
 * Get JSON object from cache
 * @param {string} key - Cache key
 * @returns {Promise<Object|null>} Parsed JSON object or null
 */
async function getJSON(key) {
  try {
    const value = await get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.error(`Cache GET JSON error for key ${key}:`, error);
    return null;
  }
}

/**
 * Set value in cache with TTL
 * @param {string} key - Cache key
 * @param {string} value - Value to cache
 * @param {number} ttl - Time to live in seconds (optional)
 * @returns {Promise<boolean>} Success status
 */
async function set(key, value, ttl = null) {
  try {
    const client = getRedisClient();
    
    if (ttl) {
      await client.setEx(key, ttl, value);
    } else {
      await client.set(key, value);
    }
    
    return true;
  } catch (error) {
    console.error(`Cache SET error for key ${key}:`, error);
    return false;
  }
}

/**
 * Set JSON object in cache with TTL
 * @param {string} key - Cache key
 * @param {Object} value - Object to cache
 * @param {number} ttl - Time to live in seconds (optional)
 * @returns {Promise<boolean>} Success status
 */
async function setJSON(key, value, ttl = null) {
  try {
    const jsonString = JSON.stringify(value);
    return await set(key, jsonString, ttl);
  } catch (error) {
    console.error(`Cache SET JSON error for key ${key}:`, error);
    return false;
  }
}

/**
 * Delete key from cache
 * @param {string} key - Cache key
 * @returns {Promise<boolean>} Success status
 */
async function del(key) {
  try {
    const client = getRedisClient();
    await client.del(key);
    return true;
  } catch (error) {
    console.error(`Cache DELETE error for key ${key}:`, error);
    return false;
  }
}

/**
 * Delete multiple keys from cache
 * @param {string[]} keys - Array of cache keys
 * @returns {Promise<boolean>} Success status
 */
async function delMultiple(keys) {
  try {
    const client = getRedisClient();
    if (keys.length > 0) {
      await client.del(keys);
    }
    return true;
  } catch (error) {
    console.error(`Cache DELETE MULTIPLE error:`, error);
    return false;
  }
}

/**
 * Set expiration time for a key
 * @param {string} key - Cache key
 * @param {number} ttl - Time to live in seconds
 * @returns {Promise<boolean>} Success status
 */
async function expire(key, ttl) {
  try {
    const client = getRedisClient();
    await client.expire(key, ttl);
    return true;
  } catch (error) {
    console.error(`Cache EXPIRE error for key ${key}:`, error);
    return false;
  }
}

/**
 * Check if key exists in cache
 * @param {string} key - Cache key
 * @returns {Promise<boolean>} True if key exists
 */
async function exists(key) {
  try {
    const client = getRedisClient();
    const result = await client.exists(key);
    return result === 1;
  } catch (error) {
    console.error(`Cache EXISTS error for key ${key}:`, error);
    return false;
  }
}

/**
 * Get remaining TTL for a key
 * @param {string} key - Cache key
 * @returns {Promise<number>} Remaining TTL in seconds (-1 if no expiry, -2 if key doesn't exist)
 */
async function ttl(key) {
  try {
    const client = getRedisClient();
    return await client.ttl(key);
  } catch (error) {
    console.error(`Cache TTL error for key ${key}:`, error);
    return -2;
  }
}

/**
 * Increment counter in cache
 * @param {string} key - Cache key
 * @returns {Promise<number>} New value after increment
 */
async function incr(key) {
  try {
    const client = getRedisClient();
    return await client.incr(key);
  } catch (error) {
    console.error(`Cache INCR error for key ${key}:`, error);
    return 0;
  }
}

/**
 * Increment counter with expiry
 * @param {string} key - Cache key
 * @param {number} ttl - Time to live in seconds
 * @returns {Promise<number>} New value after increment
 */
async function incrWithExpiry(key, ttl) {
  try {
    const client = getRedisClient();
    const value = await client.incr(key);
    
    // Set expiry only on first increment
    if (value === 1) {
      await client.expire(key, ttl);
    }
    
    return value;
  } catch (error) {
    console.error(`Cache INCR WITH EXPIRY error for key ${key}:`, error);
    return 0;
  }
}

/**
 * Get all keys matching a pattern
 * @param {string} pattern - Key pattern (e.g., 'auth:otp:*')
 * @returns {Promise<string[]>} Array of matching keys
 */
async function keys(pattern) {
  try {
    const client = getRedisClient();
    return await client.keys(pattern);
  } catch (error) {
    console.error(`Cache KEYS error for pattern ${pattern}:`, error);
    return [];
  }
}

/**
 * Flush all keys in current database (use with caution!)
 * @returns {Promise<boolean>} Success status
 */
async function flushDB() {
  try {
    const client = getRedisClient();
    await client.flushDb();
    return true;
  } catch (error) {
    console.error(`Cache FLUSH DB error:`, error);
    return false;
  }
}

module.exports = {
  TTL,
  generateKey,
  get,
  getJSON,
  set,
  setJSON,
  del,
  delMultiple,
  expire,
  exists,
  ttl,
  incr,
  incrWithExpiry,
  keys,
  flushDB,
};
