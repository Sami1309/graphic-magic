// netlify/functions/store-result.js

// Use global variable to persist between function calls
if (!global.results) {
    global.results = new Map();
}
const results = global.results;

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { requestId, status, result, error, timestamp } = JSON.parse(event.body);
        
        if (!requestId) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Request ID is required' }) };
        }

        // Store the result
        results.set(requestId, {
            status,
            result,
            error,
            timestamp
        });

        console.log(`Stored result for request ${requestId} with status: ${status}`);

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ success: true })
        };

    } catch (error) {
        console.error('Error storing result:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to store result' })
        };
    }
};