import { defineConfig } from 'tsup'

export default defineConfig([
  // ESM + CJS（npm 包）
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    treeshake: true,
  },
  // UMD（iife）供 script 标签引入
  {
    entry: ['src/index.ts'],
    format: ['iife'],
    globalName: 'Monitor',
    outExtension: () => ({ js: '.umd.js' }),
    sourcemap: true,
    minify: true,
  },
])
