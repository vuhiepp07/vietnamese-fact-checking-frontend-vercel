// Vercel Function: Endpoint for frontend to poll for messages
const { getRedisClient } = require('./redis-client');

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { sessionId } = req.query;

        if (!sessionId) {
            return res.status(400).json({ error: 'sessionId is required' });
        }

        const redis = getRedisClient();
        const kvKey = `session:${sessionId}`;
        let sessionData = null;

        if (redis) {
            try {
                const data = await redis.get(kvKey);
                if (!data) {
                    return res.status(200).json({
                        success: true,
                        hasMessage: false
                    });
                }
                sessionData = typeof data === 'string' ? JSON.parse(data) : data;
            } catch (redisError) {
                console.error('Redis error:', redisError);
                // Fallback to in-memory
                if (!global.messageStore || !global.messageStore[sessionId]) {
                    return res.status(200).json({
                        success: true,
                        hasMessage: false
                    });
                }
                sessionData = global.messageStore[sessionId];
            }
        } else {
            // Fallback to in-memory (local development)
            if (!global.messageStore || !global.messageStore[sessionId]) {
                return res.status(200).json({
                    success: true,
                    hasMessage: false
                });
            }
            sessionData = global.messageStore[sessionId];
        }

        console.log('Getting message for session:', sessionId, 'Messages in queue:', sessionData.messages.length);

        if (sessionData.messages.length > 0) {
            const message = sessionData.messages.shift();
            console.log('Returning message:', message);
            
            if (redis) {
                try {
                    await redis.set(kvKey, JSON.stringify(sessionData), { ex: 3600 });
                } catch (redisError) {
                    console.error('Redis error when saving:', redisError);
                }
            }

            return res.status(200).json({
                success: true,
                hasMessage: true,
                message: {
                    type: message.type,
                    header: message.header,
                    content: message.content
                },
                isComplete: sessionData.isComplete
            });
        }

        return res.status(200).json({
            success: true,
            hasMessage: false,
            isComplete: sessionData.isComplete
        });
    } catch (error) {
        console.error('Error in get-message:', error);
        return res.status(500).json({ error: error.message });
    }
};
