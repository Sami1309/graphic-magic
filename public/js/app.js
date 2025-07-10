// public/js/app.js
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
        promptInput.value = '';
        if (styleImageBase64) {
            styleImageBase64 = null;
            styleThumbnailContainer.innerHTML = '';
            styleUploadInput.value = '';
        }

        try {
            const response = await fetch('http://localhost:3000/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, history: conversationHistory.join('\n'), styleImage: currentStyleImage }),
            });

            if (!response.ok) throw new Error((await response.json()).error);

            const data = await response.json();
            updateScene(data);

            conversationHistory.push(`User: ${prompt}`);
            conversationHistory.push(`AI: (Generated new animation script)`);
            addMessageToChat('Animation updated.', 'ai');

        } catch (error) {
            console.error('Error:', error);
            addMessageToChat(`Sorry, something went wrong: ${error.message}`, 'ai');
        } finally {
            generateBtn.classList.remove('loading');
        }
    }

    function updateScene({ html, css, js }) {
        if (scene && scene.destroy) scene.destroy();

        sceneContainer.innerHTML = '';
        dynamicStyles.innerHTML = scopeCSS(css, '#scene-container');
        sceneContainer.innerHTML = html;

        try {
            const sceneScript = new Function(js);
            scene = sceneScript();

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

    // --- Corrected Download Function ---
    async function downloadAnimation() {
        if (!scene) {
            alert("Please generate an animation first.");
            return;
        }

        const originalText = exportBtn.textContent;
        exportBtn.textContent = 'Recording...';
        exportBtn.disabled = true;

        try {
            // ** THE FIX: Instantiate the recorder from the Scene object **
            // The recorder script attaches its class to the global Scene object.
            const recorder = new Scene.Recorder();

            // Set the scene instance for the recorder to capture
            recorder.setAnimator(scene);

            // Get the current dimensions of the scene container to maintain aspect ratio
            const width = sceneContainer.offsetWidth;
            const height = sceneContainer.offsetHeight;

            // Record the animation with the correct dimensions
            const videoBlob = await recorder.record({
                format: "mp4",
                width: width,
                height: height,
            });

            // Create a temporary URL and trigger the download
            const url = URL.createObjectURL(videoBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'animation.mp4';
            document.body.appendChild(a);
            a.click();

            // Clean up
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

    // --- UI Update and Helper Functions ---

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

    // --- Event Listeners for Controls ---

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

    // --- Interact.js (Placeholder) ---
    function makeElementsInteractive() {}

    // Initialize UI
    durationDisplay.textContent = `${durationSlider.value}s`;
    timelineSlider.max = durationSlider.value;
    updateTimeUI(0);
});