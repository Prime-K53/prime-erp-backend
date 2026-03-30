import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3003,
        host: '0.0.0.0',
        proxy: {
          '/api': {
            target: 'https://prime-erp-backend.onrender.com',
            changeOrigin: true,
            secure: true,
            // Prevent SPA HTML fallback for /api requests
            bypass: (req, res, options) => {
              if (req.headers.accept?.includes('text/html')) {
                return null; // Let Vite handle it if they explicitly want HTML
              }
            }
          }
        }
      },
      plugins: [react()],
      optimizeDeps: {
        include: ['recharts', 'lucide-react', 'react-router-dom', 'idb', 'date-fns']
      },
      define: {
        'process.env.API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY),
        'process.env.VITE_API_URL': JSON.stringify(env.VITE_API_URL || 'https://prime-erp-backend.onrender.com'),
        'process.env.API_BASE_URL': JSON.stringify(env.VITE_API_URL || 'https://prime-erp-backend.onrender.com'),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.')
        }
      }
    };
});
