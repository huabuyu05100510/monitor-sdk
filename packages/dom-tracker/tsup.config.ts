import { defineConfig } from 'tsup';

export default defineConfig([
  // 库模式：CJS + ESM，axios/react 作为 peer dependency
  {
    entry: ['src/index.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    clean: true,
    minify: false,
    sourcemap: true,
    target: 'esnext',
    external: ['react', 'axios'],
  },
  // 浏览器 IIFE 包：打包进 axios，挂到 window.DomTracker，供 demo.html 直接使用
  {
    entry: { 'index.browser': 'src/index.ts' },
    format: ['iife'],
    globalName: 'DomTracker',
    outDir: 'dist',
    minify: false,
    sourcemap: true,
    target: 'es2017',
    external: ['react'],
    // axios 直接 bundle 进去，demo 无需单独引入
    noExternal: ['axios'],
  },
]);
