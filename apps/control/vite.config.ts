import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defaultClientConditions, defineConfig, loadEnv } from 'vite';

// The dev server forwards server addresses to the BajaOvrLay server, so the control
// page talks to the same origin in development as it does in production. PORT and HOST
// come from the repo-root `.env`, the same file the server reads, so the two cannot
// disagree. Vite never puts `.env` values into `process.env` by itself, hence loadEnv.
// The empty prefix loads every variable, not only `VITE_*`; none of them reach the page.
const repoRootFolder = fileURLToPath(new URL('../..', import.meta.url));
const rootEnvironment = loadEnv('development', repoRootFolder, '');
const serverPort = rootEnvironment.PORT ?? '3000';
const serverHost = chooseHostToReachTheServer(rootEnvironment.HOST);
const serverAddress = `http://${serverHost}:${serverPort}`;

/**
 * Returns the address the proxy should dial. A server listening on every interface
 * (0.0.0.0 or ::) is reached on 127.0.0.1; a server bound to one address only answers there.
 */
function chooseHostToReachTheServer(serverListenHost: string | undefined): string {
  if (serverListenHost === undefined || serverListenHost === '') {
    return '127.0.0.1';
  }
  const isListeningOnEveryInterface = serverListenHost === '0.0.0.0' || serverListenHost === '::';
  if (isListeningOnEveryInterface) {
    return '127.0.0.1';
  }
  return serverListenHost;
}

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
