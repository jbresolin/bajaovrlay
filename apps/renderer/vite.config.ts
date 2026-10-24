import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { defaultClientConditions, defineConfig, loadEnv, type Plugin } from 'vite';

// In production the server itself serves this page, so /ws, /api, /graphics and /theme are
// on the page's own origin. The dev server forwards those four to the BajaOvrLay server so
// the page works the same way in development. PORT and HOST come from the repo-root `.env`,
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

/**
 * Embeds the id in the repo-root build-id.building.json (written first by `pnpm build`,
 * scripts/writeBuildId.js) as `import.meta.env.BAJAOVRLAY_BUILD_ID`, in built pages only.
 * Once every package has built, the same id is copied to build-id.json, which the server
 * reads at boot and sends in its hello; a page from another build reloads itself
 * (packages/shared/src/build). The dev server and Vitest embed nothing, so no comparison
 * happens there; nor does a build that finds no usable file (`vite build` run by hand).
 * The control page's vite.config.ts carries the same plugin.
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

/** The `buildId` of build-id.building.json, or undefined when it is missing or unusable. */
function readTheBuildIdOfThisBuild(): string | undefined {
  let fileJson: unknown;
  try {
    fileJson = JSON.parse(
      readFileSync(new URL('../../build-id.building.json', import.meta.url), 'utf8'),
    );
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
  // The server serves the built renderer at /render/, and OBS loads it from there.
  // The dev server uses the same path so URLs are identical in both.
  base: '/render/',
  plugins: [embedTheBuildIdInBuiltPages()],
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
      // The theme's tokens, font CSS and font file, linked by index.html.
      '/theme': serverAddress,
      // The images a resolved field names (/media/<mediaId>), drawn by a graphic's <img>.
      '/media': serverAddress,
      '/ws': { target: serverAddress, ws: true },
    },
  },
});
