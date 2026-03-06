-- ============================================
-- Index Usage Verification Script
-- Task 12.2: Database Performance Optimization
-- ============================================

\echo ''
\echo '============================================'
\echo 'Database Performance Optimization Verification'
\echo '============================================'
\echo ''

-- 1. List all custom indexes
\echo '1. Custom Indexes Created:'
\echo '-------------------------------------------'
SELECT 
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

\echo ''
\echo '2. Index Usage Statistics:'
\echo '-------------------------------------------'
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan as scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched,
  pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
AND indexname LIKE 'idx_%'
ORDER BY idx_scan DESC, tablename;

\echo ''
\echo '3. Unused Indexes (Potential Candidates for Removal):'
\echo '-------------------------------------------'
SELECT 
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as wasted_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
AND idx_scan = 0
AND indexname LIKE 'idx_%'
AND indexrelid NOT IN (
  SELECT indexrelid FROM pg_index WHERE indisprimary OR indisunique
)
ORDER BY pg_relation_size(indexrelid) DESC;

\echo ''
\echo '4. Table Statistics:'
\echo '-------------------------------------------'
SELECT 
  schemaname,
  tablename,
  n_live_tup as live_rows,
  n_dead_tup as dead_rows,
  last_vacuum,
  last_analyze
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC;

\echo ''
\echo '5. Index Size Summary by Table:'
\echo '-------------------------------------------'
SELECT 
  tablename,
  COUNT(*) as index_count,
  pg_size_pretty(SUM(pg_relation_size(indexrelid))) as total_index_size,
  pg_size_pretty(pg_relation_size(tablename::regclass)) as table_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
AND indexname LIKE 'idx_%'
GROUP BY tablename
ORDER BY SUM(pg_relation_size(indexrelid)) DESC;

\echo ''
\echo '6. Most Scanned Indexes (Top 10):'
\echo '-------------------------------------------'
SELECT 
  tablename,
  indexname,
  idx_scan as scans,
  pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
AND indexname LIKE 'idx_%'
ORDER BY idx_scan DESC
LIMIT 10;

\echo ''
\echo '7. Connection Pool Status:'
\echo '-------------------------------------------'
SELECT 
  datname as database,
  numbackends as active_connections,
  xact_commit as transactions_committed,
  xact_rollback as transactions_rolled_back,
  blks_read as blocks_read,
  blks_hit as blocks_hit,
  ROUND(100.0 * blks_hit / NULLIF(blks_hit + blks_read, 0), 2) as cache_hit_ratio
FROM pg_stat_database
WHERE datname = current_database();

\echo ''
\echo '8. Slow Query Detection (queries > 100ms):'
\echo '-------------------------------------------'
\echo 'Note: Enable pg_stat_statements extension to track query performance'
\echo 'Run: CREATE EXTENSION IF NOT EXISTS pg_stat_statements;'
\echo ''

-- Check if pg_stat_statements is available
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements'
    ) THEN 'pg_stat_statements is enabled'
    ELSE 'pg_stat_statements is NOT enabled - run CREATE EXTENSION pg_stat_statements;'
  END as status;

\echo ''
\echo '9. TimescaleDB Hypertable Status:'
\echo '-------------------------------------------'
SELECT 
  hypertable_schema,
  hypertable_name,
  num_chunks,
  compression_enabled,
  pg_size_pretty(total_bytes) as total_size
FROM timescaledb_information.hypertables
WHERE hypertable_schema = 'public';

\echo ''
\echo '10. Recommendations:'
\echo '-------------------------------------------'
\echo '- Monitor index usage weekly and remove unused indexes'
\echo '- Run ANALYZE after bulk data loads to update statistics'
\echo '- Run VACUUM ANALYZE monthly to reclaim space and update stats'
\echo '- Monitor cache hit ratio (should be > 95%)'
\echo '- Monitor connection pool usage (should not exceed 20 connections)'
\echo '- Review slow queries and add indexes as needed'
\echo ''
\echo '============================================'
\echo 'Verification Complete'
\echo '============================================'
\echo ''
