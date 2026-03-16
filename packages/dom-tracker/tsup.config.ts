import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm', 'umd'],
  dts: true,
  clean: true,
  minify: false,
  sourcemap: true,
  target: 'esnext',
  external: ['react', 'axios'],
});
