// server.js
const express = require('express');
const { GoogleGenAI } = require("@google/genai");
const dotenv = require('dotenv');
const cors = require('cors');
const { styleContext } = require('./style-base/default.js');

dotenv.config();
const app = express();
const port = 3000;

app.use(express.json({ limit: '10mb' }));
app.use(cors());
app.use(express.static('public'));

const ai = new GoogleGenAI(process.env.GEMINI_API_KEY);

app.post('/api/generate', async (req, res) => {
    const { prompt, history, styleImage } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }

    try {
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
                return res.status(400).json({ error: 'Invalid image format. Must be a Base64 string.' });
            }
            const mimeType = match[1];
            const data = match[2];
            contents = [{ text: fullPrompt }, { inlineData: { mimeType, data } }];
        } else {
            contents = [{ text: fullPrompt }];
        }

        const systemInstructionWithImage = styleContext +
            "\nIf an image is provided, use it as reference for creating the animation";

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

        const data = JSON.parse(response.text);
        res.json(data);

    } catch (error) {
        console.error('Error during Gemini API call:', error);

        // --- BUG FIX: Create a safe, valid JSON error response ---
        // This ensures that even if the error message from Gemini contains special characters,
        // our server's response to the client will still be a valid JSON object.
        res.status(500).json({
            error: "Failed to generate animation from API.",
            // We send the raw error message in its own property.
            // res.json() will correctly escape any special characters.
            details: error.message || "An unknown error occurred."
        });
        // --- End of Bug Fix ---
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});