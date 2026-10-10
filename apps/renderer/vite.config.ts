import { fileURLToPath } from 'node:url';

import { defaultClientConditions, defineConfig, loadEnv } from 'vite';

// In production the server itself serves this page, so /ws, /api and /graphics are on the
// page's own origin. The dev server forwards those three to the BajaOvrLay server so the
// page works the same way in development. PORT and HOST come from the repo-root `.env`,
// the same file the server reads (a PORT or HOST already in the environment wins, which
// is how the Playwright run points this at its own server). Same rule as the control
// page's vite.config.ts; the empty prefix loads every variable, none reach the page.
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
  // The server serves the built renderer at /render/, and OBS loads it from there.
  // The dev server uses the same path so URLs are identical in both.
  base: '/render/',
  resolve: {
    // Import @bajaovrlay/shared from its TypeScript source; see packages/shared/README.md.
    conditions: ['@bajaovrlay/source', ...defaultClientConditions],
  },
  server: {
    port: 5174,
    strictPort: true,
    proxy: {
      '/api': serverAddress,
      '/graphics': serverAddress,
      '/ws': { target: serverAddress, ws: true },
    },
  },
});
