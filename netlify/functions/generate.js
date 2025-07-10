// This file replaces server.js for deployment.
// We use the 'dotenv' package to load environment variables.
const { GoogleGenAI } = require("@google/genai");
const { styleContext } = require('../../style-base/default.js');

// The handler function is the entry point for the serverless function.
export const handler = async (event) => {
    // We only accept POST requests.
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { prompt, history, styleImage } = JSON.parse(event.body);
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            throw new Error("GEMINI_API_KEY is not set.");
        }
        if (!prompt) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Prompt is required' }) };
        }

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
            if (!match) return { statusCode: 400, body: JSON.stringify({ error: 'Invalid image format.' }) };
            contents = [{ text: fullPrompt }, { inlineData: { mimeType: match[1], data: match[2] } }];
        } else {
            contents = [{ text: fullPrompt }];
        }

        const systemInstructionWithImage = styleContext + "\nIf an image is provided, use it as reference for creating the animation";

        const response = await ai.models.generateContent({
            model: "gemini-2.5-pro",
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

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: response.text,
        };

    } catch (error) {
        console.error('Error in serverless function:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: "Failed to generate animation from API.",
                details: error.message || "An unknown error occurred."
            })
        };
    }
};