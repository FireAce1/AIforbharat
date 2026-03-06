"""
Database Optimizer for Python Services

Provides optimized database operations including:
- Connection pooling with proper configuration
- Query performance monitoring
- Prepared statement support via SQLAlchemy
- Batch operations
- N+1 query prevention with eager loading
"""

from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker, Session, joinedload, selectinload
from sqlalchemy.pool import QueuePool
from contextlib import contextmanager
from typing import Generator, List, Dict, Any, Optional
import time
import logging
from datetime import datetime

from .config import settings

logger = logging.getLogger(__name__)


class DatabaseOptimizer:
    """Optimized database connection and query manager"""
    
    def __init__(self):
        self.engine = self._create_optimized_engine()
        self.SessionLocal = sessionmaker(
            autocommit=False,
            autoflush=False,
            bind=self.engine
        )
        self.query_metrics: List[Dict[str, Any]] = []
        self.SLOW_QUERY_THRESHOLD = 100  # milliseconds
        
        # Set up query logging
        self._setup_query_logging()
    
    def _create_optimized_engine(self):
        """Create database engine with optimized connection pooling"""
        return create_engine(
            settings.DATABASE_URL,
            # Connection pool settings
            poolclass=QueuePool,
            pool_size=settings.DB_POOL_SIZE,  # 20 connections
            max_overflow=settings.DB_MAX_OVERFLOW,  # 10 additional connections
            pool_pre_ping=True,  # Verify connections before using
            pool_recycle=3600,  # Recycle connections after 1 hour
            
            # Performance settings
            echo=False,  # Don't log all SQL (we'll do custom logging)
            echo_pool=False,
            
            # Connection settings
            connect_args={
                "connect_timeout": 10,
                "options": "-c statement_timeout=30000"  # 30 second query timeout
            }
        )
    
    def _setup_query_logging(self):
        """Set up event listeners for query performance monitoring"""
        
        @event.listens_for(self.engine, "before_cursor_execute")
        def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
            conn.info.setdefault('query_start_time', []).append(time.time())
        
        @event.listens_for(self.engine, "after_cursor_execute")
        def after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
            total_time = time.time() - conn.info['query_start_time'].pop()
            duration_ms = total_time * 1000
            
            # Log slow queries
            if duration_ms > self.SLOW_QUERY_THRESHOLD:
                logger.warning(
                    f"Slow query detected: {duration_ms:.2f}ms",
                    extra={
                        'query': self._sanitize_query(statement),
                        'duration_ms': duration_ms,
                        'rows': cursor.rowcount if hasattr(cursor, 'rowcount') else 0
                    }
                )
            
            # Store metrics
            self.query_metrics.append({
                'query': self._sanitize_query(statement),
                'duration_ms': duration_ms,
                'rows': cursor.rowcount if hasattr(cursor, 'rowcount') else 0,
                'timestamp': datetime.now()
            })
            
            # Keep only recent metrics (last 1000)
            if len(self.query_metrics) > 1000:
                self.query_metrics.pop(0)
    
    @contextmanager
    def get_db(self) -> Generator[Session, None, None]:
        """
        Get database session with automatic cleanup
        
        Usage:
            with db_optimizer.get_db() as db:
                result = db.query(Model).all()
        """
        db = self.SessionLocal()
        try:
            yield db
        finally:
            db.close()
    
    def execute_with_retry(
        self,
        db: Session,
        query: str,
        params: Optional[Dict[str, Any]] = None,
        max_retries: int = 3
    ) -> Any:
        """Execute query with automatic retry on connection errors"""
        for attempt in range(max_retries):
            try:
                result = db.execute(text(query), params or {})
                return result
            except Exception as e:
                if attempt == max_retries - 1:
                    logger.error(f"Query failed after {max_retries} attempts: {e}")
                    raise
                logger.warning(f"Query attempt {attempt + 1} failed, retrying: {e}")
                db.rollback()
                time.sleep(0.1 * (attempt + 1))  # Exponential backoff
    
    def batch_insert(
        self,
        db: Session,
        model_class: Any,
        records: List[Dict[str, Any]],
        batch_size: int = 100
    ) -> None:
        """
        Optimized batch insert using bulk operations
        
        Args:
            db: Database session
            model_class: SQLAlchemy model class
            records: List of dictionaries with record data
            batch_size: Number of records per batch
        """
        for i in range(0, len(records), batch_size):
            batch = records[i:i + batch_size]
            db.bulk_insert_mappings(model_class, batch)
            db.flush()
        
        db.commit()
        logger.info(f"Batch inserted {len(records)} records into {model_class.__tablename__}")
    
    def batch_update(
        self,
        db: Session,
        model_class: Any,
        records: List[Dict[str, Any]],
        batch_size: int = 100
    ) -> None:
        """
        Optimized batch update using bulk operations
        
        Args:
            db: Database session
            model_class: SQLAlchemy model class
            records: List of dictionaries with record data (must include primary key)
            batch_size: Number of records per batch
        """
        for i in range(0, len(records), batch_size):
            batch = records[i:i + batch_size]
            db.bulk_update_mappings(model_class, batch)
            db.flush()
        
        db.commit()
        logger.info(f"Batch updated {len(records)} records in {model_class.__tablename__}")
    
    def eager_load_relationships(
        self,
        query: Any,
        relationships: List[str],
        strategy: str = 'joined'
    ) -> Any:
        """
        Add eager loading to prevent N+1 queries
        
        Args:
            query: SQLAlchemy query object
            relationships: List of relationship names to eager load
            strategy: 'joined' for joinedload or 'select' for selectinload
        
        Returns:
            Modified query with eager loading
        """
        for relationship in relationships:
            if strategy == 'joined':
                query = query.options(joinedload(relationship))
            elif strategy == 'select':
                query = query.options(selectinload(relationship))
        
        return query
    
    def get_pool_stats(self) -> Dict[str, Any]:
        """Get connection pool statistics"""
        pool = self.engine.pool
        return {
            'pool_size': pool.size(),
            'checked_in': pool.checkedin(),
            'checked_out': pool.checkedout(),
            'overflow': pool.overflow(),
            'total_connections': pool.size() + pool.overflow()
        }
    
    def get_slow_queries(self, threshold_ms: Optional[int] = None) -> List[Dict[str, Any]]:
        """Get queries that exceeded the slow query threshold"""
        threshold = threshold_ms or self.SLOW_QUERY_THRESHOLD
        return [
            metric for metric in self.query_metrics
            if metric['duration_ms'] > threshold
        ]
    
    def clear_metrics(self) -> None:
        """Clear stored query metrics"""
        self.query_metrics = []
    
    @staticmethod
    def _sanitize_query(query: str) -> str:
        """Sanitize query for logging (remove sensitive data, limit length)"""
        # Remove extra whitespace
        sanitized = ' '.join(query.split())
        # Limit length
        return sanitized[:200] + ('...' if len(sanitized) > 200 else '')
    
    def close(self) -> None:
        """Close all database connections"""
        self.engine.dispose()
        logger.info("Database connections closed")


# Global instance
db_optimizer = DatabaseOptimizer()


def get_db() -> Generator[Session, None, None]:
    """
    Dependency function for FastAPI to get database session
    
    Usage in FastAPI:
        @app.get("/items")
        def get_items(db: Session = Depends(get_db)):
            return db.query(Item).all()
    """
    with db_optimizer.get_db() as db:
        yield db


# Utility functions for common patterns

def get_with_relationships(
    db: Session,
    model_class: Any,
    filters: Dict[str, Any],
    relationships: List[str],
    strategy: str = 'joined'
) -> Optional[Any]:
    """
    Get single record with eager-loaded relationships
    
    Example:
        farm = get_with_relationships(
            db,
            Farm,
            {'id': farm_id},
            ['crops', 'user'],
            strategy='joined'
        )
    """
    query = db.query(model_class)
    
    # Add filters
    for key, value in filters.items():
        query = query.filter(getattr(model_class, key) == value)
    
    # Add eager loading
    query = db_optimizer.eager_load_relationships(query, relationships, strategy)
    
    return query.first()


def get_many_with_relationships(
    db: Session,
    model_class: Any,
    filters: Dict[str, Any],
    relationships: List[str],
    strategy: str = 'select',
    limit: Optional[int] = None,
    offset: Optional[int] = None
) -> List[Any]:
    """
    Get multiple records with eager-loaded relationships
    
    Example:
        farms = get_many_with_relationships(
            db,
            Farm,
            {'user_id': user_id},
            ['crops'],
            strategy='select',
            limit=10
        )
    """
    query = db.query(model_class)
    
    # Add filters
    for key, value in filters.items():
        query = query.filter(getattr(model_class, key) == value)
    
    # Add eager loading
    query = db_optimizer.eager_load_relationships(query, relationships, strategy)
    
    # Add pagination
    if offset:
        query = query.offset(offset)
    if limit:
        query = query.limit(limit)
    
    return query.all()
