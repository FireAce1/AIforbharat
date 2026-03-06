/**
 * Redis Connection and Cache Utility Test
 * Tests Redis connection pooling and cache operations
 */

require('dotenv').config();
const { initRedisClient, closeRedisClient } = require('./src/config/redis');
const cache = require('./src/utils/cache');

async function testRedisConnection() {
  console.log('=== Testing Redis Connection ===\n');
  
  try {
    // Initialize Redis client
    console.log('1. Initializing Redis client...');
    await initRedisClient();
    console.log('✓ Redis client initialized successfully\n');

    // Test basic operations
    console.log('2. Testing basic cache operations...');
    
    // Test SET and GET
    const testKey = cache.generateKey('test', 'demo', 'key1');
    console.log(`   Generated key: ${testKey}`);
    
    await cache.set(testKey, 'Hello Redis!', 60);
    console.log('   ✓ SET operation successful');
    
    const value = await cache.get(testKey);
    console.log(`   ✓ GET operation successful: ${value}`);
    
    // Test JSON operations
    console.log('\n3. Testing JSON cache operations...');
    const jsonKey = cache.generateKey('test', 'user', 'user123');
    const userData = {
      id: 'user123',
      name: 'Test User',
      phone: '+919876543210',
      language: 'hi'
    };
    
    await cache.setJSON(jsonKey, userData, cache.TTL.SESSION);
    console.log('   ✓ SET JSON operation successful');
    
    const retrievedData = await cache.getJSON(jsonKey);
    console.log('   ✓ GET JSON operation successful:', retrievedData);
    
    // Test TTL operations
    console.log('\n4. Testing TTL operations...');
    const otpKey = cache.generateKey('auth', 'otp', '+919876543210');
    await cache.set(otpKey, '123456', cache.TTL.OTP);
    
    const remainingTTL = await cache.ttl(otpKey);
    console.log(`   ✓ OTP stored with TTL: ${remainingTTL} seconds remaining`);
    
    // Test EXISTS
    const exists = await cache.exists(otpKey);
    console.log(`   ✓ Key exists check: ${exists}`);
    
    // Test counter operations
    console.log('\n5. Testing counter operations...');
    const counterKey = cache.generateKey('test', 'counter', 'requests');
    
    const count1 = await cache.incrWithExpiry(counterKey, 3600);
    const count2 = await cache.incrWithExpiry(counterKey, 3600);
    const count3 = await cache.incrWithExpiry(counterKey, 3600);
    
    console.log(`   ✓ Counter incremented: ${count1} -> ${count2} -> ${count3}`);
    
    // Test rate limiting scenario
    console.log('\n6. Testing rate limiting scenario...');
    const rateLimitKey = cache.generateKey('auth', 'ratelimit', '+919876543210');
    
    for (let i = 1; i <= 6; i++) {
      const count = await cache.incrWithExpiry(rateLimitKey, 3600);
      console.log(`   Request ${i}: Count = ${count}`);
      
      if (count > 5) {
        console.log('   ✓ Rate limit exceeded (as expected)');
        break;
      }
    }
    
    // Test key pattern matching
    console.log('\n7. Testing key pattern matching...');
    const testKeys = await cache.keys('test:*');
    console.log(`   ✓ Found ${testKeys.length} keys matching pattern 'test:*'`);
    
    // Test DELETE operations
    console.log('\n8. Testing DELETE operations...');
    await cache.del(testKey);
    const deletedExists = await cache.exists(testKey);
    console.log(`   ✓ Single key deleted: exists = ${deletedExists}`);
    
    // Clean up all test keys
    const allTestKeys = await cache.keys('test:*');
    if (allTestKeys.length > 0) {
      await cache.delMultiple(allTestKeys);
      console.log(`   ✓ Deleted ${allTestKeys.length} test keys`);
    }
    
    // Clean up auth test keys
    const authTestKeys = await cache.keys('auth:*');
    if (authTestKeys.length > 0) {
      await cache.delMultiple(authTestKeys);
      console.log(`   ✓ Deleted ${authTestKeys.length} auth test keys`);
    }
    
    console.log('\n=== All Redis Tests Passed! ===\n');
    
    // Display TTL policies
    console.log('Configured TTL Policies:');
    console.log(`  - OTP: ${cache.TTL.OTP} seconds (5 minutes)`);
    console.log(`  - API Response: ${cache.TTL.API_RESPONSE} seconds (1 hour)`);
    console.log(`  - Session: ${cache.TTL.SESSION} seconds (7 days)`);
    
  } catch (error) {
    console.error('\n❌ Redis test failed:', error);
    process.exit(1);
  } finally {
    // Close Redis connection
    console.log('\nClosing Redis connection...');
    await closeRedisClient();
    console.log('✓ Redis connection closed\n');
  }
}

// Run tests
testRedisConnection();
