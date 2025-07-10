# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## AI Motion Graphics Generator

This is a web-based AI-powered motion graphics generator that creates animated scenes using Scene.js library and Google's Gemini AI model.

## Architecture

The application consists of:

1. **Frontend (Vite + Vanilla JS)**: Interactive web interface for creating and controlling animations
   - `src/main.js`: Main application logic, DOM manipulation, and Scene.js integration
   - `src/style.css`: UI styling
   - `index.html`: Main HTML structure

2. **Backend Options**: 
   - **Local Development**: Express server (`server.js`) for local API endpoint
   - **Production**: Netlify serverless function (`netlify/functions/generate.js`) for deployment

3. **AI Context**: `style-base/default.js` contains the system prompt and examples for Gemini AI

## Key Components

### Scene.js Integration
- Uses Scene.js library for animation creation and control
- Recorder integration for exporting animations as MP4 files
- Interactive elements via interact.js for draggable components

### AI Generation Flow
1. User provides text prompt (optionally with style image)
2. Request sent to Gemini AI with conversation history
3. AI returns JSON with `html`, `css`, and `js` properties
4. Frontend dynamically creates scene and executes animation code

### Dual Server Setup
- **Development**: Uses Express server on port 3000 with proxy in Vite config
- **Production**: Uses Netlify serverless functions with special configuration for Google GenAI dependency

## Development Commands

```bash
# Install dependencies
npm install

# Start development (frontend only)
npm run dev

# Start local backend server
npm run start:backend

# Start backend with auto-reload
npm run dev:backend

# Build for production
npm run build

# Preview production build
npm run preview
```

## Development Setup

1. Set up environment variables:
   - `GEMINI_API_KEY`: Google GenAI API key (required for both local and production)

2. For local development:
   - Run `npm run dev:backend` in one terminal
   - Run `npm run dev` in another terminal
   - Frontend will proxy API calls to localhost:3000

## Deployment Configuration

### Netlify Setup
- Build command: `npm run build`
- Publish directory: `dist`
- Functions directory: `netlify/functions`
- Uses `zisi` bundler for better Node.js dependency handling
- `@google/genai` marked as external dependency

### Vite Configuration
- Includes Cross-Origin headers for FFmpeg support
- Proxy setup for local development API calls
- FFmpeg dependencies excluded from optimization

## Code Architecture Notes

### Animation Generation
- AI generates complete Scene.js animation code as strings
- Frontend uses `new Function()` to execute generated JavaScript
- CSS is scoped to `#scene-container` to prevent global conflicts
- All generated code must return a Scene.js instance

### State Management
- Conversation history tracked for context in subsequent requests
- Style images converted to base64 for AI processing
- Scene duration and timeline controls managed in frontend

### Error Handling
- JSON parsing includes extraction logic for AI responses wrapped in markdown
- Comprehensive error handling for both local and serverless environments
- User-friendly error messages displayed in chat interface

## Important Files

- `style-base/default.js`: Contains the complete AI system prompt and examples
- `netlify/functions/generate.js`: Production serverless function (CommonJS)
- `server.js`: Local development server (CommonJS)
- `src/main.js`: Main frontend application (ES modules)
- `vite.config.js`: Vite configuration with proxy and headers
- `netlify.toml`: Netlify deployment configuration