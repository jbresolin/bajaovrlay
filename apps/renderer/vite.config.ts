import { defineConfig } from 'vite';

export default defineConfig({
  // The server serves the built renderer at /render/, and OBS loads it from there.
  // The dev server uses the same path so URLs are identical in both.
  base: '/render/',
  server: {
    port: 5174,
    strictPort: true,
  },
});
