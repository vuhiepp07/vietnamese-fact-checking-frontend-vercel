// Netlify Function: Endpoint for frontend to poll for messages
const { getRedisClient } = require('./redis-client');

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers: {
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const sessionId = event.queryStringParameters?.sessionId;

        if (!sessionId) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ error: 'sessionId is required' })
            };
        }

        const redis = getRedisClient();
        const kvKey = `session:${sessionId}`;
        let sessionData = null;

        if (redis) {
            try {
                const data = await redis.get(kvKey);
                if (!data) {
                    return {
                        statusCode: 200,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*'
                        },
                        body: JSON.stringify({
                            success: true,
                            hasMessage: false
                        })
                    };
                }
                sessionData = typeof data === 'string' ? JSON.parse(data) : data;
            } catch (redisError) {
                console.error('Redis error:', redisError);
                // Fallback to in-memory
                if (!global.messageStore || !global.messageStore[sessionId]) {
                    return {
                        statusCode: 200,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*'
                        },
                        body: JSON.stringify({
                            success: true,
                            hasMessage: false
                        })
                    };
                }
                sessionData = global.messageStore[sessionId];
            }
        } else {
            // Fallback to in-memory (local development)
            if (!global.messageStore || !global.messageStore[sessionId]) {
                return {
                    statusCode: 200,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: JSON.stringify({
                        success: true,
                        hasMessage: false
                    })
                };
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

            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    success: true,
                    hasMessage: true,
                    message: {
                        type: message.type,
                        header: message.header,
                        content: message.content
                    },
                    isComplete: sessionData.isComplete
                })
            };
        }

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: true,
                hasMessage: false,
                isComplete: sessionData.isComplete
            })
        };
    } catch (error) {
        console.error('Error in get-message:', error);
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ error: error.message })
        };
    }
};
