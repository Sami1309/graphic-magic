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

        // 2. Find the start and end of the JSON object within the raw response.
        //    This handles cases where the LLM wraps the JSON in ```json ... ``` or other text.
        const startIndex = geminiRawText.indexOf('{');
        const endIndex = geminiRawText.lastIndexOf('}');

        if (startIndex === -1 || endIndex === -1) {
            throw new Error("LLM response did not contain a valid JSON object. Raw response: " + geminiRawText);
        }

        // 3. Extract the JSON block as a string.
        const jsonBlock = geminiRawText.substring(startIndex, endIndex + 1);

        // 4. Parse the extracted block. If this fails, the catch block will now have a more informative error.
        const geminiJsObject = JSON.parse(jsonBlock);

        // 5. Re-stringify the parsed object to ensure it's perfectly clean
        //    for the browser, escaping all control characters correctly.
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