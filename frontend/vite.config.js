import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Read VITE_API_URL from frontend/.env so the proxy target and the client
  // API base come from a single place. Strip a trailing /api for the proxy.
  const env = loadEnv(mode, process.cwd(), '')
  const apiBase = env.VITE_API_URL || 'http://localhost:5000/api'
  const proxyTarget = apiBase.replace(/\/api\/?$/, '')

  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port: 3000,
      cors: true,
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
