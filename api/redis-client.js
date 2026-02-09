// Redis client helper for Vercel Functions
const { Redis } = require('@upstash/redis');

let redisClient = null;

function getRedisClient() {
    if (!redisClient) {
        const url = process.env.UPSTASH_REDIS_REST_URL;
        const token = process.env.UPSTASH_REDIS_REST_TOKEN;
        
        if (!url || !token) {
            console.warn('Upstash Redis credentials not found. Falling back to in-memory storage.');
            return null;
        }
        
        try {
            redisClient = new Redis({
                url: url,
                token: token,
            });
        } catch (error) {
            console.error('Failed to initialize Redis client:', error);
            return null;
        }
    }
    
    return redisClient;
}

module.exports = { getRedisClient };
