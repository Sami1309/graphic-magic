// src/main.js

// --- Import libraries directly ---
import Scene from "scenejs";
import Recorder from "@scenejs/recorder";
import interact from "interactjs";
import './style.css'; // Vite handles injecting the CSS

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element Selection ---
    const sceneContainer = document.getElementById('scene-container');
    const dynamicStyles = document.getElementById('dynamic-styles');
    const generateBtn = document.getElementById('generate-btn');
    const promptInput = document.getElementById('prompt-input');
    const chatHistory = document.getElementById('chat-history');
    const playPauseBtn = document.getElementById('play-pause-btn');
    const timelineSlider = document.getElementById('timeline-slider');
    const timeDisplay = document.getElementById('time-display');
    const durationSlider = document.getElementById('duration-slider');
    const durationDisplay = document.getElementById('duration-display');
    const styleUploadBtn = document.getElementById('style-upload-btn');
    const styleUploadInput = document.getElementById('style-upload-input');
    const styleThumbnailContainer = document.getElementById('style-thumbnail-container');
    const exportBtn = document.getElementById('export-btn');

    // --- State Management ---
    let scene = null;
    let conversationHistory = [];
    let styleImageBase64 = null;

    // --- Core Functions ---

    async function generateAnimation() {
        const prompt = promptInput.value;
        if (!prompt) return;

        const currentStyleImage = styleImageBase64;

        addMessageToChat(prompt, 'user');
        generateBtn.classList.add('loading');
        generateBtn.textContent = 'Generating...';
        promptInput.value = '';
        if (styleImageBase64) {
            styleImageBase64 = null;
            styleThumbnailContainer.innerHTML = '';
            styleUploadInput.value = '';
        }

        try {
            // Start the streaming generation process
            const response = await fetch('/.netlify/functions/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ prompt, history: conversationHistory.join('\n'), styleImage: currentStyleImage }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Handle streaming response
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                
                if (done) {
                    break;
                }

                // Decode the chunk and add to buffer
                buffer += decoder.decode(value, { stream: true });
                
                // Process complete lines
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // Keep incomplete line in buffer
                
                for (const line of lines) {
                    if (line.trim()) {
                        try {
                            const data = JSON.parse(line);
                            
                            if (data.status === 'processing') {
                                // Update UI with progress
                                generateBtn.textContent = data.message || 'Processing...';
                                console.log('Processing:', data.message);
                            } else if (data.status === 'completed' && data.result) {
                                // Generation complete - update scene
                                updateScene(data.result);
                                conversationHistory.push(`User: ${prompt}`);
                                conversationHistory.push(`AI: (Generated new animation script)`);
                                addMessageToChat('Animation updated.', 'ai');
                                return; // Exit the function successfully
                            } else if (data.status === 'error') {
                                // Error occurred
                                throw new Error(data.error || 'Generation failed');
                            }
                        } catch (parseError) {
                            console.warn('Failed to parse streaming response:', line, parseError);
                        }
                    }
                }
            }

            // If we get here without a completed result, something went wrong
            throw new Error('Stream ended without completion');

        } catch (error) {
            console.error('Error:', error);
            addMessageToChat(`Sorry, something went wrong: ${error.message}`, 'ai');
        } finally {
            generateBtn.classList.remove('loading');
            generateBtn.textContent = 'Generate';
        }
    }


    function updateScene({ html, css, js }) {
        if (scene && scene.destroy) scene.destroy();

        sceneContainer.innerHTML = '';
        dynamicStyles.innerHTML = scopeCSS(css, '#scene-container');
        sceneContainer.innerHTML = html;

        try {
            const sceneScript = new Function("Scene", js);
            scene = sceneScript(Scene);

            if (!scene || typeof scene.on !== 'function') {
                throw new Error("Generated script did not return a valid Scene.js instance.");
            }

            const newDuration = scene.getDuration();
            durationSlider.value = newDuration;
            durationDisplay.textContent = `${Math.round(newDuration)}s`;
            timelineSlider.max = newDuration;
            timelineSlider.value = 0;
            updateTimeUI(0);

            setupSceneEventListeners();
            scene.pause();
            playPauseBtn.textContent = '▶';
            makeElementsInteractive();

        } catch (e) {
            console.error("Error executing generated script:", e);
            addMessageToChat(`There was an error in the generated animation code: ${e.message}`, 'ai');
        }
    }

    function setupSceneEventListeners() {
        scene.on('play', () => playPauseBtn.textContent = '❚❚');
        scene.on('paused', () => playPauseBtn.textContent = '▶');
        scene.on('ended', () => playPauseBtn.textContent = '▶');
        scene.on('timeupdate', e => {
            timelineSlider.value = e.time;
            updateTimeUI(e.time);
        });
    }

    async function downloadAnimation() {
        if (!scene) {
            alert("Please generate an animation first.");
            return;
        }

        const originalText = exportBtn.textContent;
        exportBtn.textContent = 'Recording...';
        exportBtn.disabled = true;

        try {
            const recorder = new Recorder();
            recorder.setAnimator(scene);

            const videoBlob = await recorder.record({
                format: "mp4"
            });

            const url = URL.createObjectURL(videoBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'animation.mp4';
            document.body.appendChild(a);
a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

        } catch (error) {
            console.error("Recording failed:", error);
            alert("Sorry, the animation could not be recorded. Please check the console for errors.");
        } finally {
            exportBtn.textContent = originalText;
            exportBtn.disabled = false;
        }
    }

    function scopeCSS(cssString, scope) {
        if (!cssString) return '';
        return cssString.replace(/([^{]+)({[^{}]*})/g, (match, selector, body) => {
            if (selector.trim().startsWith('@')) return match;
            return selector.split(',').map(part => `${scope} ${part.trim()}`).join(', ') + body;
        });
    }

    function updateTimeUI(currentTime) {
        if (!scene) return;
        const totalDuration = scene.getDuration();
        timeDisplay.textContent = `${formatTime(currentTime)} / ${formatTime(totalDuration)}`;
    }

    function formatTime(seconds) {
        const roundSeconds = Math.floor(seconds);
        const minutes = Math.floor(roundSeconds / 60);
        const remainingSeconds = roundSeconds % 60;
        return `${minutes.toString().padStart(1, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    function addMessageToChat(message, sender) {
        const messageElement = document.createElement('div');
        messageElement.className = `chat-message ${sender}`;
        messageElement.textContent = message;
        chatHistory.appendChild(messageElement);
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }

    generateBtn.addEventListener('click', generateAnimation);
    promptInput.addEventListener('keyup', e => e.key === 'Enter' && generateAnimation());
    playPauseBtn.addEventListener('click', () => scene && (scene.isPaused() ? scene.play() : scene.pause()));
    timelineSlider.addEventListener('input', () => scene && scene.setTime(parseFloat(timelineSlider.value)));
    durationSlider.addEventListener('input', () => {
        const newDuration = parseInt(durationSlider.value, 10);
        durationDisplay.textContent = `${newDuration}s`;
        if (scene) {
            scene.setDuration(newDuration);
            timelineSlider.max = newDuration;
            updateTimeUI(scene.getTime());
        }
    });

    styleUploadBtn.addEventListener('click', () => styleUploadInput.click());
    styleUploadInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            styleImageBase64 = e.target.result;
            styleThumbnailContainer.innerHTML = `<img src="${styleImageBase64}" alt="Style Thumbnail" /><div class="remove-style-btn">×</div>`;
            styleThumbnailContainer.querySelector('.remove-style-btn').addEventListener('click', () => {
                styleImageBase64 = null;
                styleThumbnailContainer.innerHTML = '';
                styleUploadInput.value = '';
            });
        };
        reader.readAsDataURL(file);
    });

    exportBtn.addEventListener('click', downloadAnimation);

    function makeElementsInteractive() {
        interact('.interactive').draggable({
            listeners: {
                move(event) {
                    const target = event.target;
                    const x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx;
                    const y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;
                    target.style.transform = `translate(${x}px, ${y}px)`;
                    target.setAttribute('data-x', x);
                    target.setAttribute('data-y', y);
                }
            }
        });
    }

    durationDisplay.textContent = `${durationSlider.value}s`;
    timelineSlider.max = durationSlider.value;
    updateTimeUI(0);
});