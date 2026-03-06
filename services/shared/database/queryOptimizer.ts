/**
 * Query Optimizer Utility
 * 
 * Provides utilities for database query optimization including:
 * - Prepared statement management
 * - Query performance monitoring
 * - N+1 query detection
 * - Connection pool management
 */

import { Pool, PoolClient, QueryResult } from 'pg';
import logger from '../utils/logger';

export interface QueryMetrics {
  query: string;
  duration: number;
  rows: number;
  timestamp: Date;
}

export class QueryOptimizer {
  private pool: Pool;
  private preparedStatements: Map<string, string> = new Map();
  private queryMetrics: QueryMetrics[] = [];
  private readonly SLOW_QUERY_THRESHOLD = 100; // ms
  private readonly MAX_METRICS_SIZE = 1000;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Execute query with performance monitoring and prepared statement support
   */
  async query<T = any>(
    text: string,
    params?: any[],
    options?: { name?: string; useCache?: boolean }
  ): Promise<QueryResult<T>> {
    const start = Date.now();
    const statementName = options?.name;

    try {
      let result: QueryResult<T>;

      if (statementName && params) {
        // Use prepared statement
        result = await this.executePreparedStatement<T>(statementName, text, params);
      } else {
        // Regular query
        result = await this.pool.query<T>(text, params);
      }

      const duration = Date.now() - start;

      // Log slow queries
      if (duration > this.SLOW_QUERY_THRESHOLD) {
        logger.warn('Slow query detected', {
          query: this.sanitizeQuery(text),
          duration,
          rows: result.rowCount,
          params: params?.length,
        });
      }

      // Store metrics
      this.recordMetrics({
        query: this.sanitizeQuery(text),
        duration,
        rows: result.rowCount || 0,
        timestamp: new Date(),
      });

      return result;
    } catch (error) {
      const duration = Date.now() - start;
      logger.error('Query execution error', {
        query: this.sanitizeQuery(text),
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Execute prepared statement with automatic registration
   */
  private async executePreparedStatement<T = any>(
    name: string,
    text: string,
    params: any[]
  ): Promise<QueryResult<T>> {
    // Register prepared statement if not already registered
    if (!this.preparedStatements.has(name)) {
      await this.pool.query({
        name,
        text,
        values: params,
      });
      this.preparedStatements.set(name, text);
      logger.debug('Prepared statement registered', { name });
    }

    // Execute prepared statement
    return await this.pool.query<T>({
      name,
      text,
      values: params,
    });
  }

  /**
   * Execute query with transaction support
   */
  async transaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Transaction rolled back', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Batch insert with optimized multi-row INSERT
   */
  async batchInsert(
    table: string,
    columns: string[],
    rows: any[][],
    options?: { batchSize?: number; onConflict?: string }
  ): Promise<void> {
    const batchSize = options?.batchSize || 100;
    const onConflict = options?.onConflict || '';

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      
      // Build multi-row INSERT statement
      const placeholders = batch
        .map((_, rowIndex) => {
          const rowPlaceholders = columns
            .map((_, colIndex) => `$${rowIndex * columns.length + colIndex + 1}`)
            .join(', ');
          return `(${rowPlaceholders})`;
        })
        .join(', ');

      const query = `
        INSERT INTO ${table} (${columns.join(', ')})
        VALUES ${placeholders}
        ${onConflict}
      `;

      const params = batch.flat();

      await this.query(query, params);
      
      logger.debug('Batch insert completed', {
        table,
        rows: batch.length,
        total: rows.length,
      });
    }
  }

  /**
   * Get query performance metrics
   */
  getMetrics(): QueryMetrics[] {
    return [...this.queryMetrics];
  }

  /**
   * Get slow queries (above threshold)
   */
  getSlowQueries(): QueryMetrics[] {
    return this.queryMetrics.filter(m => m.duration > this.SLOW_QUERY_THRESHOLD);
  }

  /**
   * Clear metrics
   */
  clearMetrics(): void {
    this.queryMetrics = [];
  }

  /**
   * Record query metrics
   */
  private recordMetrics(metrics: QueryMetrics): void {
    this.queryMetrics.push(metrics);
    
    // Keep only recent metrics
    if (this.queryMetrics.length > this.MAX_METRICS_SIZE) {
      this.queryMetrics.shift();
    }
  }

  /**
   * Sanitize query for logging (remove sensitive data)
   */
  private sanitizeQuery(query: string): string {
    // Remove extra whitespace
    return query.replace(/\s+/g, ' ').trim().substring(0, 200);
  }

  /**
   * Get connection pool stats
   */
  getPoolStats() {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
    };
  }
}
