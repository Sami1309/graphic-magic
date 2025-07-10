// netlify/functions/generate.js

// This file is now using CommonJS syntax (require/exports) for maximum compatibility.
const { GoogleGenAI } = require("@google/genai");
const { styleContext } = require('../../style-base/default.js');
const { jobs } = require('./job-manager.js');

// Use 'exports.handler' instead of 'export const handler'
exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { prompt, history, styleImage } = JSON.parse(event.body);
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            throw new Error("GEMINI_API_KEY is not set in the Netlify UI.");
        }
        if (!prompt) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Prompt is required' }) };
        }

        // Generate unique job ID
        const jobId = Date.now().toString() + Math.random().toString(36).substring(2, 11);
        
        // Initialize job status
        jobs.set(jobId, {
            status: 'processing',
            startTime: Date.now(),
            prompt: prompt
        });

        // Start background processing (don't await)
        processGenerationInBackground(jobId, prompt, history, styleImage, apiKey);

        // Return job ID immediately
        return {
            statusCode: 202,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jobId: jobId, status: 'processing' })
        };

    } catch (error) {
        console.error('Error in serverless function:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: "Failed to start generation process.",
                details: error.message || "An unknown error occurred."
            })
        };
    }
};

// Background processing function
async function processGenerationInBackground(jobId, prompt, history, styleImage, apiKey) {
    try {
        const ai = new GoogleGenAI(apiKey);

        const fullPrompt = `
            **Previous Conversation History:**
            ${history || 'No history yet.'}
            **User's New Request:** "${prompt}"
            Generate the complete JSON object based on this new request, taking the history and any provided style image into account.
        `;

        let contents;
        if (styleImage) {
            const match = styleImage.match(/^data:(.+);base64,(.+)$/);
            if (!match) {
                jobs.set(jobId, {
                    status: 'error',
                    error: 'Invalid image format.',
                    completedAt: Date.now()
                });
                return;
            }
            contents = [{ text: fullPrompt }, { inlineData: { mimeType: match[1], data: match[2] } }];
        } else {
            contents = [{ text: fullPrompt }];
        }

        const systemInstructionWithImage = styleContext + "\nIf an image is provided, use it as the primary style reference.";

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-04-17",
            contents: contents,
            config: {
                systemInstruction: styleImage ? systemInstructionWithImage : styleContext,
                responseMimeType: "application/json",
                temperature: 0.0,
                thinkingConfig: {
                    thinkingBudget: -1,                  
                },
            },
        });

        // Process response
        const geminiRawText = response.text;
        const startIndex = geminiRawText.indexOf('{');
        const endIndex = geminiRawText.lastIndexOf('}');

        if (startIndex === -1 || endIndex === -1) {
            throw new Error("LLM response did not contain a valid JSON object. Raw response: " + geminiRawText);
        }

        const jsonBlock = geminiRawText.substring(startIndex, endIndex + 1);
        const geminiJsObject = JSON.parse(jsonBlock);

        // Update job status with result
        jobs.set(jobId, {
            status: 'completed',
            result: geminiJsObject,
            completedAt: Date.now()
        });

    } catch (error) {
        console.error('Error in background processing:', error);
        jobs.set(jobId, {
            status: 'error',
            error: error.message || "An unknown error occurred during generation.",
            completedAt: Date.now()
        });
    }
}