const { Pool } = require('pg');
const Redis = require('ioredis');

// Database configuration
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'krishiai_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: 20,
});

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
});

// Seed configuration
const SEED_CONFIG = {
  users: 10000,
  farms: 10000,
  crops: 15000,
  diseaseDetections: 20000,
  marketPrices: 50000,
  weatherForecasts: 30000,
  governmentSchemes: 500,
};

const SAMPLE_DATA = {
  crops: ['rice', 'wheat', 'cotton', 'tomato', 'onion', 'sugarcane', 'soybean', 'maize', 'potato', 'chili'],
  soilTypes: ['Alluvial', 'Black', 'Red', 'Laterite', 'Desert', 'Mountain'],
  irrigationTypes: ['Rainfed', 'Borewell', 'Canal', 'Drip', 'Sprinkler'],
  diseases: ['Leaf Blight', 'Powdery Mildew', 'Rust', 'Bacterial Wilt', 'Mosaic Virus'],
  states: ['Maharashtra', 'Madhya Pradesh', 'Uttar Pradesh', 'Punjab', 'Karnataka'],
  mandis: ['Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Aurangabad', 'Solapur', 'Kolhapur'],
};

function randomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function randomFloat(min, max) {
  return Math.random() * (max - min) + min;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

async function seedUsers() {
  console.log(`Seeding ${SEED_CONFIG.users} users...`);
  const batchSize = 1000;
  
  for (let i = 0; i < SEED_CONFIG.users; i += batchSize) {
    const values = [];
    const placeholders = [];
    
    for (let j = 0; j < batchSize && (i + j) < SEED_CONFIG.users; j++) {
      const idx = i + j;
      const offset = j * 3;
      placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3})`);
      values.push(
        `+9198765${String(idx).padStart(5, '0')}`,
        `Farmer ${idx}`,
        randomItem(['hi', 'mr'])
      );
    }
    
    const query = `
      INSERT INTO users (phone, name, language)
      VALUES ${placeholders.join(', ')}
      ON CONFLICT (phone) DO NOTHING
    `;
    
    await pool.query(query, values);
    
    if ((i + batchSize) % 5000 === 0) {
      console.log(`  Seeded ${Math.min(i + batchSize, SEED_CONFIG.users)} users`);
    }
  }
  
  console.log('✓ Users seeded');
}

async function seedFarms() {
  console.log(`Seeding ${SEED_CONFIG.farms} farms...`);
  
  const users = await pool.query('SELECT id FROM users LIMIT $1', [SEED_CONFIG.users]);
  const batchSize = 1000;
  
  for (let i = 0; i < SEED_CONFIG.farms; i += batchSize) {
    const values = [];
    const placeholders = [];
    
    for (let j = 0; j < batchSize && (i + j) < SEED_CONFIG.farms; j++) {
      const idx = i + j;
      const offset = j * 5;
      const user = users.rows[idx % users.rows.length];
      
      placeholders.push(`($${offset + 1}, ST_SetSRID(ST_MakePoint($${offset + 2}, $${offset + 3}), 4326), $${offset + 4}, $${offset + 5})`);
      values.push(
        user.id,
        randomFloat(72.5, 77.5), // longitude (Maharashtra region)
        randomFloat(16.0, 21.0), // latitude (Maharashtra region)
        randomFloat(0.5, 5.0).toFixed(2), // size_hectares
        randomItem(SAMPLE_DATA.soilTypes)
      );
    }
    
    const query = `
      INSERT INTO farms (user_id, location, size_hectares, soil_type)
      VALUES ${placeholders.join(', ')}
    `;
    
    await pool.query(query, values);
    
    if ((i + batchSize) % 5000 === 0) {
      console.log(`  Seeded ${Math.min(i + batchSize, SEED_CONFIG.farms)} farms`);
    }
  }
  
  console.log('✓ Farms seeded');
}

async function seedCrops() {
  console.log(`Seeding ${SEED_CONFIG.crops} crops...`);
  
  const farms = await pool.query('SELECT id FROM farms LIMIT $1', [SEED_CONFIG.farms]);
  const batchSize = 1000;
  
  for (let i = 0; i < SEED_CONFIG.crops; i += batchSize) {
    const values = [];
    const placeholders = [];
    
    for (let j = 0; j < batchSize && (i + j) < SEED_CONFIG.crops; j++) {
      const idx = i + j;
      const offset = j * 5;
      const farm = farms.rows[idx % farms.rows.length];
      const sowingDate = randomDate(new Date(2023, 0, 1), new Date(2024, 11, 31));
      const harvestDate = new Date(sowingDate.getTime() + 90 * 24 * 60 * 60 * 1000); // 90 days later
      
      placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`);
      values.push(
        farm.id,
        randomItem(SAMPLE_DATA.crops),
        `Variety ${randomInt(1, 10)}`,
        sowingDate.toISOString().split('T')[0],
        harvestDate.toISOString().split('T')[0]
      );
    }
    
    const query = `
      INSERT INTO crops (farm_id, crop_name, variety, sowing_date, expected_harvest)
      VALUES ${placeholders.join(', ')}
    `;
    
    await pool.query(query, values);
    
    if ((i + batchSize) % 5000 === 0) {
      console.log(`  Seeded ${Math.min(i + batchSize, SEED_CONFIG.crops)} crops`);
    }
  }
  
  console.log('✓ Crops seeded');
}

async function seedDiseaseDetections() {
  console.log(`Seeding ${SEED_CONFIG.diseaseDetections} disease detections...`);
  
  const crops = await pool.query('SELECT id FROM crops LIMIT $1', [SEED_CONFIG.crops]);
  const batchSize = 1000;
  
  for (let i = 0; i < SEED_CONFIG.diseaseDetections; i += batchSize) {
    const values = [];
    const placeholders = [];
    
    for (let j = 0; j < batchSize && (i + j) < SEED_CONFIG.diseaseDetections; j++) {
      const idx = i + j;
      const offset = j * 5;
      const crop = crops.rows[idx % crops.rows.length];
      
      placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`);
      values.push(
        crop.id,
        `https://storage.example.com/images/${idx}.jpg`,
        randomItem(SAMPLE_DATA.diseases),
        randomFloat(0.85, 0.99).toFixed(4),
        randomItem(['Early', 'Moderate', 'Severe'])
      );
    }
    
    const query = `
      INSERT INTO disease_detections (crop_id, image_url, disease_name, confidence, severity)
      VALUES ${placeholders.join(', ')}
    `;
    
    await pool.query(query, values);
    
    if ((i + batchSize) % 5000 === 0) {
      console.log(`  Seeded ${Math.min(i + batchSize, SEED_CONFIG.diseaseDetections)} disease detections`);
    }
  }
  
  console.log('✓ Disease detections seeded');
}

async function seedMarketPrices() {
  console.log(`Seeding ${SEED_CONFIG.marketPrices} market prices...`);
  
  const batchSize = 1000;
  const startDate = new Date(2023, 0, 1);
  const endDate = new Date(2024, 11, 31);
  
  for (let i = 0; i < SEED_CONFIG.marketPrices; i += batchSize) {
    const values = [];
    const placeholders = [];
    
    for (let j = 0; j < batchSize && (i + j) < SEED_CONFIG.marketPrices; j++) {
      const idx = i + j;
      const offset = j * 6;
      const date = randomDate(startDate, endDate);
      
      placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, ST_SetSRID(ST_MakePoint($${offset + 4}, $${offset + 5}), 4326), $${offset + 6})`);
      values.push(
        date.toISOString(),
        randomItem(SAMPLE_DATA.crops),
        randomItem(SAMPLE_DATA.mandis),
        randomFloat(72.5, 77.5), // longitude
        randomFloat(16.0, 21.0), // latitude
        randomFloat(10.0, 50.0).toFixed(2) // price_per_kg
      );
    }
    
    const query = `
      INSERT INTO market_prices (time, crop_name, market_name, location, price_per_kg)
      VALUES ${placeholders.join(', ')}
      ON CONFLICT (time, crop_name, market_name) DO NOTHING
    `;
    
    await pool.query(query, values);
    
    if ((i + batchSize) % 10000 === 0) {
      console.log(`  Seeded ${Math.min(i + batchSize, SEED_CONFIG.marketPrices)} market prices`);
    }
  }
  
  console.log('✓ Market prices seeded');
}

async function seedWeatherForecasts() {
  console.log(`Seeding ${SEED_CONFIG.weatherForecasts} weather forecasts...`);
  
  const batchSize = 1000;
  const startDate = new Date(2024, 0, 1);
  const endDate = new Date(2024, 11, 31);
  
  for (let i = 0; i < SEED_CONFIG.weatherForecasts; i += batchSize) {
    const values = [];
    const placeholders = [];
    
    for (let j = 0; j < batchSize && (i + j) < SEED_CONFIG.weatherForecasts; j++) {
      const idx = i + j;
      const offset = j * 7;
      const date = randomDate(startDate, endDate);
      
      placeholders.push(`($${offset + 1}, ST_SetSRID(ST_MakePoint($${offset + 2}, $${offset + 3}), 4326), $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7})`);
      values.push(
        date.toISOString(),
        randomFloat(72.5, 77.5), // longitude
        randomFloat(16.0, 21.0), // latitude
        randomFloat(15.0, 45.0).toFixed(2), // temperature
        randomFloat(0, 100).toFixed(2), // rainfall
        randomFloat(30, 90).toFixed(2), // humidity
        randomFloat(0, 30).toFixed(2) // wind_speed
      );
    }
    
    const query = `
      INSERT INTO weather_forecasts (time, location, temperature, rainfall, humidity, wind_speed)
      VALUES ${placeholders.join(', ')}
      ON CONFLICT (time, location) DO NOTHING
    `;
    
    await pool.query(query, values);
    
    if ((i + batchSize) % 10000 === 0) {
      console.log(`  Seeded ${Math.min(i + batchSize, SEED_CONFIG.weatherForecasts)} weather forecasts`);
    }
  }
  
  console.log('✓ Weather forecasts seeded');
}

async function seedGovernmentSchemes() {
  console.log(`Seeding ${SEED_CONFIG.governmentSchemes} government schemes...`);
  
  const schemes = [];
  for (let i = 0; i < SEED_CONFIG.governmentSchemes; i++) {
    schemes.push({
      scheme_name: `Scheme ${i + 1}`,
      scheme_name_hi: `योजना ${i + 1}`,
      scheme_name_mr: `योजना ${i + 1}`,
      description: `Description for scheme ${i + 1}`,
      benefits_amount: randomFloat(5000, 100000).toFixed(2),
      scheme_type: randomItem(['subsidy', 'insurance', 'loan', 'training']),
      state: randomItem(SAMPLE_DATA.states),
      application_deadline: randomDate(new Date(), new Date(2025, 11, 31)).toISOString().split('T')[0],
    });
  }
  
  const batchSize = 100;
  for (let i = 0; i < schemes.length; i += batchSize) {
    const batch = schemes.slice(i, i + batchSize);
    const values = [];
    const placeholders = [];
    
    batch.forEach((scheme, j) => {
      const offset = j * 8;
      placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8})`);
      values.push(
        scheme.scheme_name,
        scheme.scheme_name_hi,
        scheme.scheme_name_mr,
        scheme.description,
        scheme.benefits_amount,
        scheme.scheme_type,
        scheme.state,
        scheme.application_deadline
      );
    });
    
    const query = `
      INSERT INTO government_schemes (scheme_name, scheme_name_hi, scheme_name_mr, description, benefits_amount, scheme_type, state, application_deadline)
      VALUES ${placeholders.join(', ')}
    `;
    
    await pool.query(query, values);
  }
  
  console.log('✓ Government schemes seeded');
}

async function verifySeeding() {
  console.log('\n📊 Verifying seeded data...\n');
  
  const tables = [
    'users',
    'farms',
    'crops',
    'disease_detections',
    'market_prices',
    'weather_forecasts',
    'government_schemes',
  ];
  
  for (const table of tables) {
    const result = await pool.query(`SELECT COUNT(*) FROM ${table}`);
    console.log(`  ${table}: ${result.rows[0].count} records`);
  }
  
  console.log('\n✅ Database seeding complete!\n');
}

async function main() {
  try {
    console.log('🌱 Starting database seeding for load testing...\n');
    console.log(`Target: 100K+ total records\n`);
    
    await seedUsers();
    await seedFarms();
    await seedCrops();
    await seedDiseaseDetections();
    await seedMarketPrices();
    await seedWeatherForecasts();
    await seedGovernmentSchemes();
    await verifySeeding();
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  } finally {
    await pool.end();
    redis.disconnect();
  }
}

main();
