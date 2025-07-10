// netlify/functions/job-manager.js

// Shared job management for serverless functions
// In production, you would use a database instead of in-memory storage

const jobs = new Map();

// Clean up old jobs periodically
const cleanupInterval = 5 * 60 * 1000; // 5 minutes
const maxJobAge = 10 * 60 * 1000; // 10 minutes

function cleanup() {
    const now = Date.now();
    const jobsToDelete = [];
    
    for (const [jobId, job] of jobs.entries()) {
        const jobAge = now - job.startTime;
        const completedAge = job.completedAt ? now - job.completedAt : 0;
        
        // Delete jobs that are older than 10 minutes or completed more than 5 minutes ago
        if (jobAge > maxJobAge || (job.completedAt && completedAge > cleanupInterval)) {
            jobsToDelete.push(jobId);
        }
    }
    
    jobsToDelete.forEach(jobId => jobs.delete(jobId));
}

// Run cleanup every 5 minutes
setInterval(cleanup, cleanupInterval);

module.exports = {
    jobs,
    cleanup
};