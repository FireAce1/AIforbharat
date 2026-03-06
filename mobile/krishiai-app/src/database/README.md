# WatermelonDB Database Setup

This directory contains the WatermelonDB offline-first database configuration for the KrishiAI mobile app.

## Overview

WatermelonDB provides a high-performance, offline-first database solution optimized for React Native applications. It uses SQLite as the underlying storage engine on Android.

## Structure

```
database/
├── schema.ts           # Database schema definition
├── migrations.ts       # Schema migration definitions
├── index.ts           # Database initialization and exports
├── models/            # Model classes
│   ├── User.ts
│   ├── Farm.ts
│   ├── Crop.ts
│   ├── CachedWeather.ts
│   ├── CachedPrice.ts
│   ├── SyncQueueItem.ts
│   └── index.ts
└── README.md
```

## Tables

### users
Stores user profile information.
- `phone`: User's phone number (indexed)
- `name`: User's name (optional)
- `language`: Preferred language (hi/mr)
- `created_at`: Account creation timestamp
- `last_active`: Last activity timestamp

### farms
Stores farm profile data.
- `user_id`: Reference to user (indexed)
- `location_lat`, `location_lng`: GPS coordinates
- `size_hectares`: Farm size in hectares
- `soil_type`: Soil type (Alluvial, Black, Red, etc.)
- `irrigation_type`: Irrigation method
- `created_at`, `updated_at`: Timestamps

### crops
Stores crop information for each farm.
- `farm_id`: Reference to farm (indexed)
- `crop_name`: Name of the crop
- `variety`: Crop variety (optional)
- `sowing_date`: Sowing date (optional)
- `expected_harvest`: Expected harvest date (optional)
- `status`: Crop status (active, harvested, etc.)
- `created_at`, `updated_at`: Timestamps

### cached_weather
Stores cached weather forecast data (7-day retention).
- `location_lat`, `location_lng`: Location coordinates
- `forecast_date`: Date of forecast (indexed)
- `temperature`, `rainfall`, `humidity`, `wind_speed`: Weather parameters
- `forecast_data`: Full forecast JSON string
- `cached_at`: Cache timestamp
- `expires_at`: Expiration timestamp (indexed)

### cached_prices
Stores cached market price data (90-day retention).
- `crop_name`: Crop name (indexed)
- `market_name`: Market/mandi name
- `location_lat`, `location_lng`: Market coordinates
- `price_per_kg`: Price per kilogram
- `quantity_traded`: Quantity traded (optional)
- `price_date`: Price date (indexed)
- `trend`: Price trend (up/down/stable)
- `cached_at`: Cache timestamp
- `expires_at`: Expiration timestamp (indexed)

### sync_queue
Stores offline actions for synchronization.
- `action`: Action type (e.g., 'CREATE_DISEASE_DETECTION')
- `payload`: Action payload as JSON string
- `priority`: Priority level (CRITICAL/HIGH/MEDIUM/LOW, indexed)
- `status`: Sync status (PENDING/SYNCING/COMPLETED/FAILED, indexed)
- `retry_count`: Number of retry attempts
- `created_at`: Creation timestamp (indexed)
- `updated_at`: Last update timestamp
- `error_message`: Error message if failed (optional)

## Usage

### Initialize Database

```typescript
import database from '@database';

// Database is automatically initialized and ready to use
```

### Query Data

```typescript
import database, { Q } from '@database';

// Get all farms for a user
const farms = await database
  .get('farms')
  .query(Q.where('user_id', userId))
  .fetch();

// Get active crops for a farm
const crops = await database
  .get('crops')
  .query(
    Q.where('farm_id', farmId),
    Q.where('status', 'active')
  )
  .fetch();

// Get non-expired weather cache
const weather = await database
  .get('cached_weather')
  .query(Q.where('expires_at', Q.gt(Date.now())))
  .fetch();
```

### Create Records

```typescript
import database from '@database';

await database.write(async () => {
  const user = await database.get('users').create((user) => {
    user.phone = '+919876543210';
    user.name = 'Farmer Name';
    user.language = 'hi';
    user.createdAt = new Date();
  });
});
```

### Update Records

```typescript
await database.write(async () => {
  await farm.update((farm) => {
    farm.sizeHectares = 2.5;
    farm.updatedAt = new Date();
  });
});
```

### Delete Records

```typescript
await database.write(async () => {
  await crop.markAsDeleted();
});
```

### Using Relations

```typescript
// Get user's farms
const user = await database.get('users').find(userId);
const farms = await user.farms.fetch();

// Get farm's crops
const farm = await database.get('farms').find(farmId);
const crops = await farm.crops.fetch();

// Get crop's farm
const crop = await database.get('crops').find(cropId);
const farm = await crop.farm.fetch();
```

### Sync Queue Operations

```typescript
import database from '@database';
import type { SyncQueueItem } from '@database';

// Add item to sync queue
await database.write(async () => {
  await database.get('sync_queue').create((item) => {
    item.action = 'CREATE_DISEASE_DETECTION';
    item.payload = JSON.stringify({ imageUrl, cropId, location });
    item.priority = 'HIGH';
    item.status = 'PENDING';
    item.retryCount = 0;
    item.createdAt = new Date();
    item.updatedAt = new Date();
  });
});

// Get pending items by priority
const pendingItems = await database
  .get('sync_queue')
  .query(
    Q.where('status', 'PENDING'),
    Q.sortBy('priority', Q.asc),
    Q.sortBy('created_at', Q.asc)
  )
  .fetch();
```

## Helper Functions

### Get Database Statistics

```typescript
import { getDatabaseStats } from '@database';

const stats = await getDatabaseStats();
console.log(stats);
// {
//   users: 1,
//   farms: 2,
//   crops: 5,
//   cachedWeather: 10,
//   cachedPrices: 50,
//   syncQueue: 3
// }
```

### Clean Expired Cache

```typescript
import { cleanExpiredCache } from '@database';

// Remove expired weather and price cache
await cleanExpiredCache();
```

### Reset Database (Development Only)

```typescript
import { resetDatabase } from '@database';

// WARNING: This will delete all data
await resetDatabase();
```

## Migrations

When the schema needs to be updated, add migrations to `migrations.ts`:

```typescript
export default schemaMigrations({
  migrations: [
    {
      toVersion: 2,
      steps: [
        addColumns({
          table: 'users',
          columns: [
            { name: 'email', type: 'string', isOptional: true },
          ],
        }),
      ],
    },
  ],
});
```

## Performance Tips

1. **Use Indexes**: Tables have indexes on frequently queried fields (user_id, farm_id, dates, etc.)
2. **Batch Operations**: Use `database.write()` for multiple operations
3. **Query Optimization**: Use `Q.where()` filters before fetching
4. **Cache Cleanup**: Regularly run `cleanExpiredCache()` to remove stale data
5. **JSI Mode**: Enabled for better performance on React Native 0.68+

## Offline-First Strategy

The database supports the offline-first architecture:

1. **Local Storage**: All data is stored locally in SQLite
2. **Sync Queue**: Offline actions are queued for later synchronization
3. **Cache Management**: Weather (7 days) and prices (90 days) are cached
4. **Conflict Resolution**: Last-write-wins based on timestamps

## Validations

Requirements validated by this implementation:
- **Requirement 10.1-10.7**: Offline-first architecture with local storage
- **Design Section 6.1**: WatermelonDB configuration and schema

## Next Steps

After database setup:
1. Implement API client with offline queue support (Task 3.4)
2. Integrate database with Redux state management
3. Add sync logic for background synchronization
4. Implement cache refresh strategies
