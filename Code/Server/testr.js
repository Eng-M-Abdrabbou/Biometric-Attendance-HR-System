const redis = require('redis');

async function testRedisConnection() {
  const client = redis.createClient({
    url: 'redis://127.0.0.1:6379'
  });

  client.on('error', (err) => console.log('Redis Client Error', err));

  try {
    await client.connect();
    console.log('Connected to Redis successfully');
    await client.set('test_key', 'Hello from Node.js');
    const value = await client.get('test_key');
    console.log('Retrieved value:', value);
  } catch (err) {
    console.error('Error connecting to Redis:', err);
  } finally {
    await client.quit();
  }
}

testRedisConnection();