import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3030,
    strictPort: false,
  },
  preview: {
    port: 3030,
  },
  build: {
    outDir: 'dist',
    target: 'es2022',
    // The drum samples are large enough that inlining them as base64 would
    // bloat the entry chunk, so always emit them as files.
    assetsInlineLimit: 0,
  },
});
