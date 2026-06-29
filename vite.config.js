import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Pin the dev port so the preview tooling and Vite always agree on where the server
// lives. strictPort makes Vite fail loudly rather than silently hopping to another
// port (which previously left the preview pointed at an empty page).
export default defineConfig({
  plugins: [react()],
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  server: {
    port: 5191,
    strictPort: true,
    host: true,
  },
})
