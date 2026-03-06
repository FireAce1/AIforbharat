import { Pool, PoolClient } from 'pg';
import { config } from './index';
import { logger } from '../utils/logger';

class Database {
  private pool: Pool;

  constructor() {
    this.pool = new Pool(config.database);
    
    this.pool.on('error', (err) => {
      logger.error('Unexpected database error', { error: err.message });
    });
    
    this.pool.on('connect', () => {
      logger.info('New database connection established');
    });
  }

  async query(text: string, params?: any[]) {
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

  async close() {
    await this.pool.end();
    logger.info('Database pool closed');
  }

  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.query('SELECT NOW()');
      return result.rows.length > 0;
    } catch (error) {
      logger.error('Database health check failed', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return false;
    }
  }
}

export const db = new Database();
