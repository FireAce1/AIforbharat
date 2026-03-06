import { Database } from '@nozbe/watermelondb';
import { schema } from '../schema';
import { models } from '../models';

describe('WatermelonDB Database Setup', () => {
  it('should have correct schema version', () => {
    expect(schema.version).toBe(1);
  });

  it('should have all required tables', () => {
    const tableNames = Object.keys(schema.tables);
    expect(tableNames).toContain('users');
    expect(tableNames).toContain('farms');
    expect(tableNames).toContain('crops');
    expect(tableNames).toContain('cached_weather');
    expect(tableNames).toContain('cached_prices');
    expect(tableNames).toContain('sync_queue');
  });

  it('should have correct number of tables', () => {
    expect(Object.keys(schema.tables)).toHaveLength(6);
  });

  it('should have all model classes', () => {
    expect(models).toHaveLength(6);
  });

  it('should have users table with correct columns', () => {
    const usersTable = schema.tables['users'];
    expect(usersTable).toBeDefined();
    
    const columnNames = usersTable.columnArray.map((col: any) => col.name);
    expect(columnNames).toContain('phone');
    expect(columnNames).toContain('name');
    expect(columnNames).toContain('language');
    expect(columnNames).toContain('created_at');
    expect(columnNames).toContain('last_active');
  });

  it('should have farms table with correct columns', () => {
    const farmsTable = schema.tables['farms'];
    expect(farmsTable).toBeDefined();
    
    const columnNames = farmsTable.columnArray.map((col: any) => col.name);
    expect(columnNames).toContain('user_id');
    expect(columnNames).toContain('location_lat');
    expect(columnNames).toContain('location_lng');
    expect(columnNames).toContain('size_hectares');
    expect(columnNames).toContain('soil_type');
    expect(columnNames).toContain('irrigation_type');
  });

  it('should have crops table with correct columns', () => {
    const cropsTable = schema.tables['crops'];
    expect(cropsTable).toBeDefined();
    
    const columnNames = cropsTable.columnArray.map((col: any) => col.name);
    expect(columnNames).toContain('farm_id');
    expect(columnNames).toContain('crop_name');
    expect(columnNames).toContain('variety');
    expect(columnNames).toContain('sowing_date');
    expect(columnNames).toContain('expected_harvest');
    expect(columnNames).toContain('status');
  });

  it('should have cached_weather table with correct columns', () => {
    const weatherTable = schema.tables['cached_weather'];
    expect(weatherTable).toBeDefined();
    
    const columnNames = weatherTable.columnArray.map((col: any) => col.name);
    expect(columnNames).toContain('location_lat');
    expect(columnNames).toContain('location_lng');
    expect(columnNames).toContain('forecast_date');
    expect(columnNames).toContain('temperature');
    expect(columnNames).toContain('rainfall');
    expect(columnNames).toContain('humidity');
    expect(columnNames).toContain('wind_speed');
    expect(columnNames).toContain('forecast_data');
    expect(columnNames).toContain('cached_at');
    expect(columnNames).toContain('expires_at');
  });

  it('should have cached_prices table with correct columns', () => {
    const pricesTable = schema.tables['cached_prices'];
    expect(pricesTable).toBeDefined();
    
    const columnNames = pricesTable.columnArray.map((col: any) => col.name);
    expect(columnNames).toContain('crop_name');
    expect(columnNames).toContain('market_name');
    expect(columnNames).toContain('location_lat');
    expect(columnNames).toContain('location_lng');
    expect(columnNames).toContain('price_per_kg');
    expect(columnNames).toContain('price_date');
    expect(columnNames).toContain('trend');
    expect(columnNames).toContain('cached_at');
    expect(columnNames).toContain('expires_at');
  });

  it('should have sync_queue table with correct columns', () => {
    const syncTable = schema.tables['sync_queue'];
    expect(syncTable).toBeDefined();
    
    const columnNames = syncTable.columnArray.map((col: any) => col.name);
    expect(columnNames).toContain('action');
    expect(columnNames).toContain('payload');
    expect(columnNames).toContain('priority');
    expect(columnNames).toContain('status');
    expect(columnNames).toContain('retry_count');
    expect(columnNames).toContain('created_at');
    expect(columnNames).toContain('updated_at');
    expect(columnNames).toContain('error_message');
  });

  it('should have indexed columns for performance', () => {
    const usersTable = schema.tables['users'];
    const phoneColumn = usersTable.columnArray.find((col: any) => col.name === 'phone');
    expect(phoneColumn?.isIndexed).toBe(true);

    const farmsTable = schema.tables['farms'];
    const userIdColumn = farmsTable.columnArray.find((col: any) => col.name === 'user_id');
    expect(userIdColumn?.isIndexed).toBe(true);

    const cropsTable = schema.tables['crops'];
    const farmIdColumn = cropsTable.columnArray.find((col: any) => col.name === 'farm_id');
    expect(farmIdColumn?.isIndexed).toBe(true);
  });
});
