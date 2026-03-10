import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // GitHub Pages serves under /monitor-sdk/ — override with VITE_BASE for local dev
  base: process.env.VITE_BASE ?? '/monitor-sdk/',
  build: {
    // 'hidden' generates .map files for backend upload but omits the
    // sourceMappingURL comment in the bundle, so browsers won't expose them.
    sourcemap: 'hidden',
  },
  server: {
    port: 3000,
    open: true,
  },
  preview: {
    port: 3001,
  },
})
