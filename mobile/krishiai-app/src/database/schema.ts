import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 4,
  tables: [
    tableSchema({
      name: 'users',
      columns: [
        { name: 'phone', type: 'string', isIndexed: true },
        { name: 'name', type: 'string', isOptional: true },
        { name: 'language', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'last_active', type: 'number', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'farms',
      columns: [
        { name: 'user_id', type: 'string', isIndexed: true },
        { name: 'location_lat', type: 'number' },
        { name: 'location_lng', type: 'number' },
        { name: 'size_hectares', type: 'number' },
        { name: 'soil_type', type: 'string' },
        { name: 'irrigation_type', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'crops',
      columns: [
        { name: 'farm_id', type: 'string', isIndexed: true },
        { name: 'crop_name', type: 'string' },
        { name: 'variety', type: 'string', isOptional: true },
        { name: 'sowing_date', type: 'number', isOptional: true },
        { name: 'expected_harvest', type: 'number', isOptional: true },
        { name: 'status', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'cached_weather',
      columns: [
        { name: 'location_lat', type: 'number' },
        { name: 'location_lng', type: 'number' },
        { name: 'forecast_date', type: 'number', isIndexed: true },
        { name: 'temperature', type: 'number' },
        { name: 'rainfall', type: 'number' },
        { name: 'humidity', type: 'number' },
        { name: 'wind_speed', type: 'number' },
        { name: 'forecast_data', type: 'string' }, // JSON string for full forecast
        { name: 'cached_at', type: 'number' },
        { name: 'expires_at', type: 'number', isIndexed: true },
      ],
    }),
    tableSchema({
      name: 'cached_prices',
      columns: [
        { name: 'crop_name', type: 'string', isIndexed: true },
        { name: 'market_name', type: 'string' },
        { name: 'location_lat', type: 'number' },
        { name: 'location_lng', type: 'number' },
        { name: 'price_per_kg', type: 'number' },
        { name: 'quantity_traded', type: 'number', isOptional: true },
        { name: 'price_date', type: 'number', isIndexed: true },
        { name: 'trend', type: 'string', isOptional: true }, // 'up', 'down', 'stable'
        { name: 'cached_at', type: 'number' },
        { name: 'expires_at', type: 'number', isIndexed: true },
      ],
    }),
    tableSchema({
      name: 'sync_queue',
      columns: [
        { name: 'action', type: 'string' },
        { name: 'payload', type: 'string' }, // JSON string
        { name: 'priority', type: 'string', isIndexed: true }, // 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'
        { name: 'status', type: 'string', isIndexed: true }, // 'PENDING', 'SYNCING', 'COMPLETED', 'FAILED'
        { name: 'retry_count', type: 'number' },
        { name: 'created_at', type: 'number', isIndexed: true },
        { name: 'updated_at', type: 'number' },
        { name: 'error_message', type: 'string', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'cached_recommendations',
      columns: [
        { name: 'farm_id', type: 'string', isIndexed: true },
        { name: 'recommendations_data', type: 'string' }, // JSON string of recommendations array
        { name: 'cached_at', type: 'number' },
        { name: 'expires_at', type: 'number', isIndexed: true },
      ],
    }),
    tableSchema({
      name: 'cached_schemes',
      columns: [
        { name: 'scheme_id', type: 'string', isIndexed: true },
        { name: 'scheme_name', type: 'string' },
        { name: 'scheme_name_hi', type: 'string' },
        { name: 'scheme_name_mr', type: 'string' },
        { name: 'description', type: 'string' }, // JSON string
        { name: 'benefits_amount', type: 'number' },
        { name: 'benefits_description', type: 'string' },
        { name: 'benefits_description_hi', type: 'string' },
        { name: 'benefits_description_mr', type: 'string' },
        { name: 'eligibility', type: 'string' }, // JSON string
        { name: 'documents', type: 'string' }, // JSON string array
        { name: 'deadline', type: 'number', isIndexed: true },
        { name: 'application_link', type: 'string' },
        { name: 'scheme_type', type: 'string', isIndexed: true },
        { name: 'state', type: 'string' },
        { name: 'is_eligible', type: 'boolean' },
        { name: 'cached_at', type: 'number' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'chat_conversations',
      columns: [
        { name: 'query_text', type: 'string' },
        { name: 'response_text', type: 'string' },
        { name: 'intent', type: 'string' },
        { name: 'confidence', type: 'number' },
        { name: 'language', type: 'string' },
        { name: 'is_voice', type: 'boolean' },
        { name: 'created_at', type: 'number', isIndexed: true },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'conflict_log',
      columns: [
        { name: 'entity_type', type: 'string', isIndexed: true },
        { name: 'entity_id', type: 'string', isIndexed: true },
        { name: 'local_data', type: 'string' }, // JSON string of local version
        { name: 'server_data', type: 'string' }, // JSON string of server version
        { name: 'local_updated_at', type: 'number' },
        { name: 'server_updated_at', type: 'number' },
        { name: 'resolution_strategy', type: 'string' }, // 'last-write-wins', 'manual', etc.
        { name: 'resolved_data', type: 'string' }, // JSON string of resolved version
        { name: 'resolved_at', type: 'number' },
        { name: 'created_at', type: 'number', isIndexed: true },
        { name: 'updated_at', type: 'number' },
      ],
    }),
  ],
});
