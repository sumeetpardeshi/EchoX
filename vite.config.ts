import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          '/api/xai': {
            target: 'https://api.x.ai',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api\/xai/, ''),
            secure: true,
          },
          // Note: /api/trending, /api/refresh, /api/cron are Vercel serverless functions
          // For local dev, use 'vercel dev' or they'll work in production on Vercel
          // The frontend will fall back to direct XAI calls if API is unavailable
        },
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.XAI_API_KEY': JSON.stringify(env.XAI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
