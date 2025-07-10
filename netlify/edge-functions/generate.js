// netlify/edge-functions/generate.js

import { GoogleGenAI } from "https://esm.sh/@google/genai@1.9.0/web";

// Import style context - we'll need to inline this since edge functions can't import local files
const styleContext = `
You are an expert motion graphics designer who writes clean, executable JavaScript for the Scene.js library.
Your task is to generate a complete animation scene based on a user's prompt.
You must return a single JSON object with three keys: "html", "css", and "js".
Avoid using scene.stagger and scene.add for now

**Instructions:**
1.  **HTML:** Create the necessary HTML structure for the elements.
2.  **JavaScript (js):**
    *   Write the complete JavaScript code required to run the animation using Scene.js.
    *   This code will be executed directly.
    *   It **MUST** create a new Scene.js instance (e.g., \`const scene = new Scene(...)\`).
    *   The script **MUST** end with \`return scene;\` so the application can capture and control the animation.
    *   **CRITICAL:** All content within the JSON string values, especially the 'js' field, MUST be properly escaped. All literal newline characters must be escaped as a two-character sequence: \\n. All double quotes must be escaped as \\".
**Example User Prompt:** "Create a hanging tag that swings and shows a percentage."

**Example JSON Output Structure:**
{
  "html": "<div class=\\"tag-container\\">\\n    <svg class=\\"tag\\" width=\\"150\\" height=\\"220\\" viewBox=\\"0 0 150 220\\">\\n      <defs>\\n        <filter id=\\"shadow\\" x=\\"-20%\\" y=\\"-20%\\" width=\\"140%\\" height=\\"140%\\">\\n          <feGaussianBlur in=\\"SourceAlpha\\" stdDeviation=\\"3\\" result=\\"blur\\"/>\\n          <feOffset in=\\"blur\\" dx=\\"2\\" dy=\\"2\\" result=\\"offsetBlur\\"/>\\n          <feMerge>\\n            <feMergeNode in=\\"offsetBlur\\"/>\\n            <feMergeNode in=\\"SourceGraphic\\"/>\\n          </feMerge>\\n        </filter>\\n      </defs>\\n      <g class=\\"tag-group\\">\\n        <!-- The string -->\\n        <line x1=\\"75\\" y1=\\"0\\" x2=\\"75\\" y2=\\"40\\" stroke=\\"black\\" stroke-width=\\"2\\" />\\n        <!-- The main tag body -->\\n        <rect x=\\"5\\" y=\\"40\\" width=\\"140\\" height=\\"120\\" rx=\\"15\\" fill=\\"#FF8C00\\" filter=\\"url(#shadow)\\"/>\\n        <!-- The group for text and its box, for the fade/zoom animation -->\\n        <g class=\\"text-group\\">\\n          <!-- Text background -->\\n          <rect x=\\"25\\" y=\\"75\\" width=\\"100\\" height=\\"50\\" rx=\\"10\\" fill=\\"rgba(255,255,255,0.8)\\"/>\\n          <!-- The percentage text -->\\n          <text id=\\"percentage\\" x=\\"75\\" y=\\"110\\" font-family=\\"Arial\\" font-weight=\\"bold\\" font-size=\\"30\\" fill=\\"#000\\" text-anchor=\\"middle\\">0%</text>\\n        </g>\\n      </g>\\n    </svg>\\n  </div>",
  "css": ".tag-container {\\n  position: absolute;\\n  top: 50px;\\n  left: 50%;\\n  transform: translateX(-50%);\\n}",
  "js": "const percentageElement = document.getElementById(\\"percentage\\");\\n\\nconst scene = new Scene({\\n  // Waving animation for the whole tag group\\n  \\".tag-group\\": {\\n    0: { transform: \\"rotate(0deg)\\" },\\n    1: { transform: \\"rotate(15deg)\\" },\\n    2: { transform: \\"rotate(-15deg)\\" },\\n    3: { transform: \\"rotate(10deg)\\" },\\n    4: { transform: \\"rotate(-10deg)\\" },\\n    5: { transform: \\"rotate(5deg)\\" },\\n    6: { transform: \\"rotate(0deg)\\" },\\n    options: {\\n      duration: 6,\\n      easing: \\"ease-in-out\\",\\n    }\\n  },\\n  // Fade in and zoom for the text and its box\\n  \\".text-group\\": {\\n    0: {\\n      transform: \\"scale(0)\\",\\n      opacity: 0,\\n    },\\n    1: {\\n      transform: \\"scale(1)\\",\\n      opacity: 1,\\n    },\\n    // Keep it visible after 1s\\n    6: {\\n      transform: \\"scale(1)\\",\\n      opacity: 1,\\n    },\\n    options: {\\n      duration: 6, // Animation occurs within the parent 6s duration\\n    }\\n  }\\n}, {\\n  selector: true,\\n  // Set transform origins for the animations\\n  \\".tag-group\\": {\\n    transformOrigin: \\"75px 0px\\" // Top of the string\\n  },\\n  \\".text-group\\": {\\n    transformOrigin: \\"75px 100px\\" // Center of the text area\\n  }\\n}).on(\\"animate\\", e => {\\n  // Update percentage text based on overall animation time\\n  const totalDuration = e.currentTarget.getDuration();\\n  if (e.time > 0) {\\n    const percentage = Math.min(70, Math.floor(e.time / totalDuration * 70));\\n    percentageElement.innerHTML = percentage + \\"%\\";\\n  } else {\\n    percentageElement.innerHTML = \\"0%\\";\\n  }\\n});\\n\\nreturn scene;"
}
`;

export default async (request) => {
    // Only handle POST requests
    if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    try {
        const { prompt, history, styleImage } = await request.json();
        const apiKey = Deno.env.get('GEMINI_API_KEY');

        if (!apiKey) {
            return new Response(JSON.stringify({ 
                error: 'GEMINI_API_KEY is not set in environment variables' 
            }), { 
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (!prompt) {
            return new Response(JSON.stringify({ 
                error: 'Prompt is required' 
            }), { 
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Create a readable stream for the response
        const encoder = new TextEncoder();
        
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    // Send initial status
                    controller.enqueue(encoder.encode(JSON.stringify({ 
                        status: 'processing', 
                        message: 'Starting generation...' 
                    }) + '\n'));

                    // Initialize GoogleGenAI with explicit API key
                    const ai = new GoogleGenAI(apiKey);
                    
                    // Validate API key is working
                    if (!ai) {
                        controller.enqueue(encoder.encode(JSON.stringify({ 
                            status: 'error', 
                            error: 'Failed to initialize Google GenAI client' 
                        }) + '\n'));
                        controller.close();
                        return;
                    }

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
                            controller.enqueue(encoder.encode(JSON.stringify({ 
                                status: 'error', 
                                error: 'Invalid image format.' 
                            }) + '\n'));
                            controller.close();
                            return;
                        }
                        contents = [{ text: fullPrompt }, { inlineData: { mimeType: match[1], data: match[2] } }];
                    } else {
                        contents = [{ text: fullPrompt }];
                    }

                    controller.enqueue(encoder.encode(JSON.stringify({ 
                        status: 'processing', 
                        message: 'Calling AI model...' 
                    }) + '\n'));

                    const systemInstructionWithImage = styleContext + "\nIf an image is provided, use it as the primary style reference.";

                    const model = ai.getGenerativeModel({ 
                        model: "gemini-2.5-flash-preview-04-17",
                        systemInstruction: styleImage ? systemInstructionWithImage : styleContext,
                        generationConfig: {
                            responseMimeType: "application/json",
                            temperature: 0.0,
                        },
                    });

                    const response = await model.generateContent(contents);

                    controller.enqueue(encoder.encode(JSON.stringify({ 
                        status: 'processing', 
                        message: 'Processing AI response...' 
                    }) + '\n'));

                    // Process response
                    const geminiRawText = response.text;
                    const startIndex = geminiRawText.indexOf('{');
                    const endIndex = geminiRawText.lastIndexOf('}');

                    if (startIndex === -1 || endIndex === -1) {
                        controller.enqueue(encoder.encode(JSON.stringify({ 
                            status: 'error', 
                            error: 'LLM response did not contain a valid JSON object.' 
                        }) + '\n'));
                        controller.close();
                        return;
                    }

                    const jsonBlock = geminiRawText.substring(startIndex, endIndex + 1);
                    const geminiJsObject = JSON.parse(jsonBlock);

                    // Send final result
                    controller.enqueue(encoder.encode(JSON.stringify({ 
                        status: 'completed', 
                        result: geminiJsObject 
                    }) + '\n'));
                    
                    controller.close();

                } catch (error) {
                    console.error('Error in edge function:', error);
                    controller.enqueue(encoder.encode(JSON.stringify({ 
                        status: 'error', 
                        error: error.message || 'An unknown error occurred during generation.' 
                    }) + '\n'));
                    controller.close();
                }
            }
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/plain',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            }
        });

    } catch (error) {
        console.error('Error in edge function:', error);
        return new Response(JSON.stringify({ 
            error: 'Failed to process request',
            details: error.message 
        }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
