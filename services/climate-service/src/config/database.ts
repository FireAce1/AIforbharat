import { Pool, PoolClient } from 'pg';
import { config } from './index';
import logger from '../utils/logger';

class Database {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      host: config.database.host,
      port: config.database.port,
      database: config.database.database,
      user: config.database.user,
      password: config.database.password,
      min: config.database.min,
      max: config.database.max,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.pool.on('error', (err) => {
      logger.error('Unexpected database error', { error: err.message });
    });

    this.pool.on('connect', () => {
      logger.info('New database connection established');
    });
  }

  async query(text: string, params?: any[]): Promise<any> {
    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      
      if (duration > 100) {
        logger.warn('Slow query detected', { 
          query: text, 
          duration,
          params: params?.length 
        });
      }
      
      return result;
    } catch (error) {
      logger.error('Database query error', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        query: text 
      });
      throw error;
    }
  }

  async getClient(): Promise<PoolClient> {
    return await this.pool.connect();
  }

  async testConnection(): Promise<boolean> {
    try {
      const result = await this.query('SELECT NOW()');
      logger.info('Database connection test successful', { 
        timestamp: result.rows[0].now 
      });
      return true;
    } catch (error) {
      logger.error('Database connection test failed', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return false;
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
    logger.info('Database pool closed');
  }
}

export default new Database();
