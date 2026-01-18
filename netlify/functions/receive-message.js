// Netlify Function: Endpoint for backend to send messages
const { getRedisClient } = require('./redis-client');

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: {
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const data = JSON.parse(event.body);
        const { sessionId, type, header, content } = data;

        console.log('Received message:', { sessionId, type, header, content });

        if (!sessionId) {
            return {
                statusCode: 400,
                headers: {
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ error: 'sessionId is required' })
            };
        }

        if (!type || !header || !content) {
            return {
                statusCode: 400,
                headers: {
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ error: 'type, header, and content are required' })
            };
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

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: true,
                message: 'Message received'
            })
        };
    } catch (error) {
        console.error('Error in receive-message:', error);
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ error: error.message })
        };
    }
};
