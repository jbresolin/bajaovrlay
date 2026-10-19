import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defaultClientConditions, defineConfig, loadEnv, type Plugin } from 'vite';

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

/**
 * Embeds the id in the repo-root build-id.json (written first by `pnpm build`,
 * scripts/writeBuildId.js) as `import.meta.env.BAJAOVRLAY_BUILD_ID`, in built pages only:
 * the server sends the same id in its hello, and a page from another build reloads itself
 * (packages/shared/src/build). The dev server and Vitest embed nothing, so no comparison
 * happens there; nor does a build that finds no usable file (`vite build` run by hand).
 * The renderer's vite.config.ts carries the same plugin.
 */
function embedTheBuildIdInBuiltPages(): Plugin {
  return {
    name: 'bajaovrlay-build-id',
    apply: 'build',
    config: () => {
      const buildId = readTheBuildIdOfThisBuild();
      if (buildId === undefined) {
        return {};
      }
      return { define: { 'import.meta.env.BAJAOVRLAY_BUILD_ID': JSON.stringify(buildId) } };
    },
  };
}

/** The `buildId` text of build-id.json, or undefined when the file is missing or unusable. */
function readTheBuildIdOfThisBuild(): string | undefined {
  let fileJson: unknown;
  try {
    fileJson = JSON.parse(readFileSync(new URL('../../build-id.json', import.meta.url), 'utf8'));
  } catch {
    return undefined;
  }
  if (typeof fileJson !== 'object' || fileJson === null || !('buildId' in fileJson)) {
    return undefined;
  }
  const buildId = fileJson.buildId;
  if (typeof buildId !== 'string' || buildId === '') {
    return undefined;
  }
  return buildId;
}

export default defineConfig({
  plugins: [react(), tailwindcss(), embedTheBuildIdInBuiltPages()],
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
      // The program monitor frames /render/?monitor=1, which loads graphics from /graphics/. Both
      // come from the server, exactly as OBS gets them: the BUILT renderer and graphics
      // (`pnpm build`), not the renderer's own dev server on port 5174.
      '/render': serverAddress,
      '/graphics': serverAddress,
    },
  },
});
