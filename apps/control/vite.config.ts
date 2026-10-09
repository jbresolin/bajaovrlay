import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defaultClientConditions, defineConfig } from 'vite';

// The dev server forwards server addresses to the BajaOvrLay server, so the control
// page talks to the same origin in development as it does in production.
const serverPort = process.env.PORT ?? '3000';
const serverAddress = `http://127.0.0.1:${serverPort}`;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // `@/` is the shadcn/ui import alias for this app's src folder.
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    // Import @bajaovrlay/shared from its TypeScript source; see packages/shared/README.md.
    conditions: ['@bajaovrlay/source', ...defaultClientConditions],
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': serverAddress,
      '/health': serverAddress,
      '/ws': { target: serverAddress, ws: true },
    },
  },
});
