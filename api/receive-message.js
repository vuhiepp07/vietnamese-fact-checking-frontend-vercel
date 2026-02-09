// Vercel Function: Endpoint for backend to send messages
const { getRedisClient } = require('./redis-client');

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { sessionId, type, header, content } = req.body;

        console.log('Received message:', { sessionId, type, header, content });

        if (!sessionId) {
            return res.status(400).json({ error: 'sessionId is required' });
        }

        if (!type || !header || !content) {
            return res.status(400).json({ error: 'type, header, and content are required' });
        }

        const redis = getRedisClient();
        const kvKey = `session:${sessionId}`;

        if (redis) {
            try {
                const existingData = await redis.get(kvKey);
                let sessionData;
                
                if (existingData) {
                    sessionData = typeof existingData === 'string' ? JSON.parse(existingData) : existingData;
                } else {
                    sessionData = { messages: [], isComplete: false };
                }
                
                sessionData.messages.push({
                    type,
                    header,
                    content,
                    timestamp: new Date().toISOString()
                });
                
                if (type === 'END') {
                    sessionData.isComplete = true;
                }
                
                await redis.set(kvKey, JSON.stringify(sessionData), { ex: 3600 });
                
                console.log('Message stored in Redis. Total messages for session:', sessionData.messages.length);
            } catch (redisError) {
                console.error('Redis error:', redisError);
                // Fallback to in-memory if Redis fails
                if (!global.messageStore) {
                    global.messageStore = {};
                }
                if (!global.messageStore[sessionId]) {
                    global.messageStore[sessionId] = {
                        messages: [],
                        isComplete: false
                    };
                }
                global.messageStore[sessionId].messages.push({
                    type,
                    header,
                    content,
                    timestamp: new Date().toISOString()
                });
                if (type === 'END') {
                    global.messageStore[sessionId].isComplete = true;
                }
            }
        } else {
            // Fallback to in-memory (local development)
            if (!global.messageStore) {
                global.messageStore = {};
            }
            if (!global.messageStore[sessionId]) {
                global.messageStore[sessionId] = {
                    messages: [],
                    isComplete: false
                };
            }
            global.messageStore[sessionId].messages.push({
                type,
                header,
                content,
                timestamp: new Date().toISOString()
            });
            if (type === 'END') {
                global.messageStore[sessionId].isComplete = true;
            }
            console.log('Message stored in memory. Total messages for session:', global.messageStore[sessionId].messages.length);
        }

        return res.status(200).json({
            success: true,
            message: 'Message received'
        });
    } catch (error) {
        console.error('Error in receive-message:', error);
        return res.status(500).json({ error: error.message });
    }
};
