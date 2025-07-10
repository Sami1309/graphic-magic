// vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    // --- FIX: Add headers to enable Cross-Origin Isolation ---
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
    // --- End of Fix ---

    // Keep the existing proxy
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  // --- Add optimization to prevent Vite from breaking FFmpeg ---
//   optimizeDeps: {
//     exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
//   },
});