import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { schema } from './schema';
import migrations from './migrations';
import { models } from './models';
import { initializeSyncQueueManager } from '../services/syncQueueManager';
import { initializeConflictResolver } from '../services/conflictResolver';

// SQLite adapter configuration for Android
const adapter = new SQLiteAdapter({
  schema,
  migrations,
  // Optional: Enable JSI for better performance (requires React Native 0.68+)
  jsi: true,
  // Optional: Enable experimental JSI mode
  onSetUpError: (error) => {
    console.error('Database setup error:', error);
  },
});

// Initialize database
export const database = new Database({
  adapter,
  modelClasses: models,
});

// Initialize sync queue manager with database
export const syncQueueManager = initializeSyncQueueManager(database);

// Initialize conflict resolver with database
export const conflictResolver = initializeConflictResolver(database);

// Export types for convenience
export type { Database } from '@nozbe/watermelondb';
export { Q } from '@nozbe/watermelondb';

// Export models
export * from './models';

// Helper function to reset database (useful for development/testing)
export const resetDatabase = async (): Promise<void> => {
  await database.write(async () => {
    await database.unsafeResetDatabase();
  });
};

// Helper function to get database statistics
export const getDatabaseStats = async () => {
  const stats = {
    users: await database.get('users').query().fetchCount(),
    farms: await database.get('farms').query().fetchCount(),
    crops: await database.get('crops').query().fetchCount(),
    cachedWeather: await database.get('cached_weather').query().fetchCount(),
    cachedPrices: await database.get('cached_prices').query().fetchCount(),
    syncQueue: await database.get('sync_queue').query().fetchCount(),
  };
  return stats;
};

// Helper function to clean expired cache
export const cleanExpiredCache = async (): Promise<void> => {
  const now = Date.now();

  await database.write(async () => {
    // Clean expired weather cache
    const expiredWeather = await database
      .get('cached_weather')
      .query(Q.where('expires_at', Q.lt(now)))
      .fetch();

    for (const item of expiredWeather) {
      await item.markAsDeleted();
    }

    // Clean expired price cache
    const expiredPrices = await database
      .get('cached_prices')
      .query(Q.where('expires_at', Q.lt(now)))
      .fetch();

    for (const item of expiredPrices) {
      await item.markAsDeleted();
    }
  });
};

export default database;
