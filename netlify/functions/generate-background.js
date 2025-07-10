// netlify/functions/generate-background.js

const { GoogleGenAI } = require("@google/genai");
const { styleContext } = require('../../style-base/default.js');

exports.handler = async (event) => {
    console.log('Background function started');
    
    try {
        const { prompt, history, styleImage, requestId } = JSON.parse(event.body);
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            throw new Error("GEMINI_API_KEY is not set in the Netlify UI.");
        }
        if (!prompt) {
            throw new Error('Prompt is required');
        }
        if (!requestId) {
            throw new Error('Request ID is required');
        }

        console.log(`Processing request ${requestId} with prompt: ${prompt}`);

        // Process the generation
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
                throw new Error('Invalid image format.');
            }
            contents = [{ text: fullPrompt }, { inlineData: { mimeType: match[1], data: match[2] } }];
        } else {
            contents = [{ text: fullPrompt }];
        }

        const systemInstructionWithImage = styleContext + "\nIf an image is provided, use it as the primary style reference.";

        console.log(`Calling Gemini AI for request ${requestId}`);
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

        console.log(`Successfully generated animation for request ${requestId}`);

        // Store the result in Netlify's key-value store or send to external service
        // For now, we'll use a simple POST to a result endpoint
        await fetch(`${process.env.URL}/.netlify/functions/store-result`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                requestId,
                status: 'completed',
                result: geminiJsObject,
                timestamp: new Date().toISOString()
            })
        });

        console.log(`Background function completed for request ${requestId}`);

    } catch (error) {
        console.error('Error in background function:', error);
        
        // Store error result
        const requestId = JSON.parse(event.body).requestId;
        if (requestId) {
            try {
                await fetch(`${process.env.URL}/.netlify/functions/store-result`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        requestId,
                        status: 'error',
                        error: error.message || "An unknown error occurred.",
                        timestamp: new Date().toISOString()
                    })
                });
            } catch (storeError) {
                console.error('Failed to store error result:', storeError);
            }
        }
    }
};