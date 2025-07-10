// netlify/functions/status.js

// This endpoint checks the status of a background generation job

const { jobs } = require('./job-manager.js');

exports.handler = async (event) => {
    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const jobId = event.queryStringParameters?.jobId;
        
        if (!jobId) {
            return { 
                statusCode: 400, 
                body: JSON.stringify({ error: 'jobId parameter is required' })
            };
        }

        const job = jobs.get(jobId);
        
        if (!job) {
            return { 
                statusCode: 404, 
                body: JSON.stringify({ error: 'Job not found' })
            };
        }

        // Clean up completed/errored jobs after 5 minutes
        const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
        if (job.completedAt && job.completedAt < fiveMinutesAgo) {
            jobs.delete(jobId);
            return { 
                statusCode: 404, 
                body: JSON.stringify({ error: 'Job expired' })
            };
        }

        // Return job status
        const response = {
            jobId: jobId,
            status: job.status,
            ...(job.result && { result: job.result }),
            ...(job.error && { error: job.error })
        };

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(response)
        };

    } catch (error) {
        console.error('Error in status function:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: "Failed to check job status.",
                details: error.message || "An unknown error occurred."
            })
        };
    }
};