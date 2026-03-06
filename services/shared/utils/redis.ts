import { createClient, RedisClientType } from 'redis';
import logger from './logger';

class RedisClient {
  private client: RedisClientType | null = null;
  private isConnected: boolean = false;

  constructor() {
    // Redis client will be initialized when connect() is called
  }

  async connect(config: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  }): Promise<void> {
    if (this.isConnected && this.client) {
      return;
    }

    this.client = createClient({
      socket: {
        host: config.host,
        port: config.port,
      },
      password: config.password,
      database: config.db || 0,
    });

    this.client.on('error', err => {
      logger.error('Redis client error', { error: err.message });
      this.isConnected = false;
    });

    this.client.on('connect', () => {
      logger.info('Redis client connected');
      this.isConnected = true;
    });

    this.client.on('ready', () => {
      logger.info('Redis client ready');
    });

    this.client.on('end', () => {
      logger.info('Redis client disconnected');
      this.isConnected = false;
    });

    await this.client.connect();
  }

  async get(key: string): Promise<string | null> {
    if (!this.client) {
      logger.error('Redis client not initialized');
      return null;
    }

    try {
      return await this.client.get(key);
    } catch (error) {
      logger.error('Redis GET error', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  async set(key: string, value: string): Promise<void> {
    if (!this.client) {
      logger.error('Redis client not initialized');
      return;
    }

    try {
      await this.client.set(key, value);
    } catch (error) {
      logger.error('Redis SET error', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async setex(key: string, ttl: number, value: string): Promise<void> {
    if (!this.client) {
      logger.error('Redis client not initialized');
      return;
    }

    try {
      await this.client.setEx(key, ttl, value);
    } catch (error) {
      logger.error('Redis SETEX error', {
        key,
        ttl,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async del(key: string): Promise<void> {
    if (!this.client) {
      logger.error('Redis client not initialized');
      return;
    }

    try {
      await this.client.del(key);
    } catch (error) {
      logger.error('Redis DEL error', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.client) {
      logger.error('Redis client not initialized');
      return false;
    }

    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Redis EXISTS error', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  async incr(key: string): Promise<number> {
    if (!this.client) {
      logger.error('Redis client not initialized');
      return 0;
    }

    try {
      return await this.client.incr(key);
    } catch (error) {
      logger.error('Redis INCR error', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return 0;
    }
  }

  async expire(key: string, seconds: number): Promise<void> {
    if (!this.client) {
      logger.error('Redis client not initialized');
      return;
    }

    try {
      await this.client.expire(key, seconds);
    } catch (error) {
      logger.error('Redis EXPIRE error', {
        key,
        seconds,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async keys(pattern: string): Promise<string[]> {
    if (!this.client) {
      logger.error('Redis client not initialized');
      return [];
    }

    try {
      return await this.client.keys(pattern);
    } catch (error) {
      logger.error('Redis KEYS error', {
        pattern,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      logger.info('Redis client closed');
      this.client = null;
      this.isConnected = false;
    }
  }

  getClient(): RedisClientType | null {
    return this.client;
  }
}

export default new RedisClient();
