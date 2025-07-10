# Netlify Deployment Guide

This guide will help you deploy your AI Motion Graphics Generator to Netlify with proper background function support to avoid timeout issues.

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

[functions."generate"]
  # Enable background function to avoid 10-second timeout
  background = true
```

## Step 4: Deploy

1. Click "Deploy site" in Netlify
2. Wait for the build to complete
3. Check the **Functions** tab to verify your function deployed successfully

## Step 5: Test Your Deployment

1. Visit your deployed site URL
2. Try generating an animation with a prompt
3. The generation should work without timeout errors

## Background Function Behavior

- **Timeout**: Background functions can run up to 15 minutes (vs 10 seconds for regular functions)
- **Response**: The function returns the result directly when complete
- **Error Handling**: Errors are properly caught and returned to the frontend
- **Status**: The "Generating..." button will show while processing

## Troubleshooting

### Function Not Found Error
- Check that `netlify/functions/generate.js` exists
- Verify the functions directory is set correctly in netlify.toml

### API Key Issues
- Make sure `GEMINI_API_KEY` is set in Netlify environment variables
- Check that the key is valid and has proper permissions
- Verify the variable name matches exactly (case-sensitive)

### Bundle/Import Errors
- Ensure `@google/genai` is in `external_node_modules`
- Try clearing the deploy cache and redeploying
- Check that `node_bundler = "zisi"` is set

### Background Function Not Working
- Verify `background = true` is set for the generate function
- Check the function logs in Netlify dashboard
- Ensure the function is returning proper JSON responses

### Timeout Issues
- Background functions should handle long-running requests automatically
- If still timing out, check the function logs for specific errors
- Consider optimizing the AI prompt for faster responses

## Function Logs

To debug issues:
1. Go to your Netlify site dashboard
2. Click **Functions** → **generate**
3. Check the logs for error messages
4. Look for specific error details in the console

## Local Development

For local development with background functions:
1. Install Netlify CLI: `npm install -g netlify-cli`
2. Run: `netlify dev`
3. This will simulate the background function behavior locally

## Important Notes

- Background functions are only available on Netlify Pro plans and above
- The function will automatically handle timeouts up to 15 minutes
- Response times will vary based on the complexity of the animation request
- The frontend will wait for the complete response before updating the scene

## Support

If you encounter issues:
1. Check the Netlify function logs first
2. Verify all environment variables are set
3. Test the function locally with `netlify dev`
4. Check the browser console for client-side errors