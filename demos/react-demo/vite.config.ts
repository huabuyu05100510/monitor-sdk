import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: true, // generate .map files alongside bundles
  },
  server: {
    port: 3000,
    open: true,
  },
  preview: {
    port: 3001, // production preview — errors here have real production column numbers
  },
})
