import { defineConfig, loadEnv } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendUrl = env.VITE_API_URL || 'http://localhost:3001';

  // ---------------------------------------------------------------------------
  // Operating modes:
  //
  // 1. WITH Nginx (recommended, multi-machine):
  //    Set VITE_API_URL=http://<backend-nginx-ip> in .env.
  //    The frontend code calls relative paths (/api/..., /uploads/...) and the
  //    browser resolves them against the Nginx server — no Vite proxy involved.
  //    Nginx on the backend machine forwards these requests to Express :3001.
  //
  // 2. LOCAL dev only (single machine, no Nginx):
  //    Set VITE_API_URL=http://localhost:3001 in .env.
  //    The Vite dev-server proxy below intercepts /api, /uploads, and /receipts
  //    requests and forwards them to the local Express instance.
  // ---------------------------------------------------------------------------

  return {
    plugins: [
      react(),
      babel({ presets: [reactCompilerPreset()] }),
      tailwindcss(),
    ],
    server: {
      proxy: {
        '/api': {
          target: backendUrl,
          changeOrigin: true,
          secure: false,
        },
        '/uploads': {
          target: backendUrl,
          changeOrigin: true,
          secure: false,
        },
        '/receipts': {
          target: backendUrl,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
})
