import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // GitHub Pages serves under /monitor-sdk/ — override with VITE_BASE for local dev
  base: process.env.VITE_BASE ?? '/monitor-sdk/',
  build: {
    sourcemap: true,
  },
  server: {
    port: 3000,
    open: true,
  },
  preview: {
    port: 3001,
  },
})
