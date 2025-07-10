// netlify/functions/get-result.js

// Use global variable to persist between function calls
if (!global.results) {
    global.results = new Map();
}
const results = global.results;

exports.handler = async (event) => {
    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const requestId = event.queryStringParameters?.requestId;
        
        if (!requestId) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Request ID is required' }) };
        }

        const result = results.get(requestId);
        
        if (!result) {
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'pending' })
            };
        }

        // Clean up completed results after retrieval
        if (result.status === 'completed' || result.status === 'error') {
            results.delete(requestId);
        }

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(result)
        };

    } catch (error) {
        console.error('Error retrieving result:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to retrieve result' })
        };
    }
};