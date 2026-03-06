import {
  schemaMigrations,
  createTable,
  addColumns,
} from '@nozbe/watermelondb/Schema/migrations';

export default schemaMigrations({
  migrations: [
    // Migration to version 2 - Add cached_recommendations table
    {
      toVersion: 2,
      steps: [
        createTable({
          name: 'cached_recommendations',
          columns: [
            { name: 'farm_id', type: 'string', isIndexed: true },
            { name: 'recommendations_data', type: 'string' },
            { name: 'cached_at', type: 'number' },
            { name: 'expires_at', type: 'number', isIndexed: true },
          ],
        }),
      ],
    },
    // Migration to version 3 - Add cached_schemes and chat_conversations tables
    {
      toVersion: 3,
      steps: [
        createTable({
          name: 'cached_schemes',
          columns: [
            { name: 'scheme_id', type: 'string', isIndexed: true },
            { name: 'scheme_name', type: 'string' },
            { name: 'scheme_name_hi', type: 'string' },
            { name: 'scheme_name_mr', type: 'string' },
            { name: 'description', type: 'string' },
            { name: 'benefits_amount', type: 'number' },
            { name: 'benefits_description', type: 'string' },
            { name: 'benefits_description_hi', type: 'string' },
            { name: 'benefits_description_mr', type: 'string' },
            { name: 'eligibility', type: 'string' },
            { name: 'documents', type: 'string' },
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
        createTable({
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
      ],
    },
    // Migration to version 4 - Add conflict_log table for sync conflict resolution
    {
      toVersion: 4,
      steps: [
        createTable({
          name: 'conflict_log',
          columns: [
            { name: 'entity_type', type: 'string', isIndexed: true },
            { name: 'entity_id', type: 'string', isIndexed: true },
            { name: 'local_data', type: 'string' },
            { name: 'server_data', type: 'string' },
            { name: 'local_updated_at', type: 'number' },
            { name: 'server_updated_at', type: 'number' },
            { name: 'resolution_strategy', type: 'string' },
            { name: 'resolved_data', type: 'string' },
            { name: 'resolved_at', type: 'number' },
            { name: 'created_at', type: 'number', isIndexed: true },
            { name: 'updated_at', type: 'number' },
          ],
        }),
      ],
    },
  ],
});
