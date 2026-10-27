import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The app calls the API via relative paths (e.g. '/payees') so the built frontend works
// unmodified behind any origin — in production the backend serves this build from the same
// origin, so no API base URL needs to be baked in at build time. In dev, the frontend (5173)
// and backend (3999) are separate servers, so relative calls are proxied to the backend here.
const DEV_API_PROXY_TARGET = process.env.VITE_DEV_API_PROXY_TARGET ?? 'http://localhost:3999'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/payees': DEV_API_PROXY_TARGET,
      '/transactions': DEV_API_PROXY_TARGET,
    },
  },
})
