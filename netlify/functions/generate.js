// netlify/functions/generate.js

// This file is now using CommonJS syntax (require/exports) for maximum compatibility.
const { GoogleGenAI } = require("@google/genai");
const { styleContext } = require('../../style-base/default.js');

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

        // --- THIS IS THE FIX ---
        // 1. Get the raw text from Gemini, which might have unescaped newlines.
        const geminiRawText = response.text;

        // 2. Sanitize the raw text BEFORE parsing. This replaces any unescaped
        //    newline, carriage return, or tab characters with their proper escaped
        //    versions, which prevents the JSON.parse() from failing.
        const sanitizedText = geminiRawText
            .replace(/\n/g, "\\n")
            .replace(/\r/g, "\\r")
            .replace(/\t/g, "\\t");

        // 3. Parse the now-safe text into a true JavaScript object.
        const geminiJsObject = JSON.parse(sanitizedText);

        // 4. Re-stringify it to send a perfectly clean response to the browser.
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(geminiJsObject),
        };
        // --- END OF FIX ---

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