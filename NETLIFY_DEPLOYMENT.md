# Netlify Deployment Guide

This guide will help you deploy your AI Motion Graphics Generator to Netlify with streaming edge function support to avoid timeout issues.

## Prerequisites

1. **Netlify Account**: Sign up at [netlify.com](https://netlify.com)
2. **GitHub Repository**: Your code should be in a GitHub repository
3. **Google AI API Key**: Get your API key from [Google AI Studio](https://aistudio.google.com/)

## Step 1: Connect Your Repository

1. Log in to your Netlify dashboard
2. Click "New site from Git"
3. Choose GitHub and authorize access
4. Select your repository
5. Use these build settings:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
   - **Functions directory**: `netlify/functions`

## Step 2: Configure Environment Variables

1. In your Netlify site dashboard, go to **Site settings** → **Environment variables**
2. Add the following variable:
   - **Key**: `GEMINI_API_KEY`
   - **Value**: Your Google AI API key

## Step 3: Verify netlify.toml Configuration

Make sure your `netlify.toml` file contains:

```toml
[build]
  command = "npm run build"
  publish = "dist"
  functions = "netlify/functions"

[functions]
  # External dependencies that shouldn't be bundled
  external_node_modules = ["@google/genai"]
  
  # Use zisi bundler for better Node.js compatibility
  node_bundler = "zisi"

# Edge function configuration for streaming responses
[[edge_functions]]
  function = "generate"
  path = "/.netlify/functions/generate"
```

## Step 4: Deploy

1. Click "Deploy site" in Netlify
2. Wait for the build to complete
3. Check the **Edge Functions** tab to verify your function deployed successfully

## Step 5: Test Your Deployment

1. Visit your deployed site URL
2. Try generating an animation with a prompt
3. Watch the button text change to show progress ("Starting generation...", "Calling AI model...", etc.)
4. The generation should work without timeout errors

## Edge Function Streaming Behavior

- **No Timeout**: Edge functions can run indefinitely without timeout issues
- **Real-time Updates**: The frontend receives progress updates as the function processes
- **Streaming Response**: Data is sent as it becomes available, not all at once
- **Better UX**: Users see progress indicators and know the system is working

## How Streaming Works

1. **Frontend**: Sends request to edge function
2. **Edge Function**: Starts processing and immediately sends status updates
3. **Frontend**: Receives streaming updates and updates the UI
4. **Completion**: When AI generation is complete, the result is sent and the scene is updated

## Troubleshooting

### Edge Function Not Found Error
- Check that `netlify/edge-functions/generate.js` exists
- Verify the edge function is configured correctly in netlify.toml
- Make sure the path mapping is correct

### API Key Issues
- Make sure `GEMINI_API_KEY` is set in Netlify environment variables
- Check that the key is valid and has proper permissions
- Verify the variable name matches exactly (case-sensitive)

### Streaming Issues
- Check browser console for JavaScript errors
- Verify the response is being parsed correctly
- Make sure the fetch API supports streaming in your browser

### Import/Module Errors
- Edge functions use ES modules and ESM imports
- The `@google/genai` library is imported via esm.sh CDN with `/web` suffix for edge compatibility
- Environment variables are accessed via `Deno.env.get()` in edge functions
- No bundling issues since it's loaded at runtime

### CORS Issues
- Edge function includes proper CORS headers
- Make sure the request is coming from the same origin
- Check browser network tab for CORS errors

## Function Logs

To debug issues:
1. Go to your Netlify site dashboard
2. Click **Edge Functions** → **generate**
3. Check the logs for error messages
4. Look for specific error details in the console

## Local Development

For local development with edge functions:
1. Install Netlify CLI: `npm install -g netlify-cli`
2. Run: `netlify dev`
3. This will simulate the edge function behavior locally
4. Check the console for streaming updates

## Important Notes

- Edge functions are available on all Netlify plans (including free)
- Edge functions run on Netlify's global CDN for better performance
- Streaming responses provide real-time feedback to users
- The function uses ESM imports from esm.sh with `/web` suffix for edge compatibility
- Environment variables are accessed via `Deno.env.get()` in edge functions
- No timeout limitations - perfect for long-running AI requests

## Performance Benefits

- **Faster Response**: Edge functions run closer to users
- **Better Reliability**: No timeout issues with long AI generation
- **Real-time Feedback**: Users see progress as it happens
- **Global Distribution**: Runs on Netlify's global edge network

## Support

If you encounter issues:
1. Check the Netlify edge function logs first
2. Verify all environment variables are set
3. Test the function locally with `netlify dev`
4. Check the browser console for client-side errors
5. Verify streaming is working by watching network requests