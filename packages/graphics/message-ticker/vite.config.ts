import { readFileSync } from 'node:fs';

import { defaultClientConditions, defineConfig, type Plugin } from 'vite';

const manifestFileName = 'message-ticker.ograf.json';

/**
 * Copies the OGraf manifest into dist/ unchanged, next to the module it names in "main".
 * A renderer finds a graphic by its manifest, so dist/ is incomplete without it.
 */
function copyOGrafManifestIntoDist(): Plugin {
  return {
    name: 'copy-ograf-manifest-into-dist',
    apply: 'build',
    generateBundle() {
      const manifestText = readFileSync(new URL(`./${manifestFileName}`, import.meta.url), 'utf8');
      this.emitFile({ type: 'asset', fileName: manifestFileName, source: manifestText });
    },
  };
}

export default defineConfig({
  // Relative URLs everywhere: the server serves dist/ under /graphics/message-ticker/ and the
  // graphic must work there (and under any other folder) without being rebuilt.
  base: './',
  plugins: [copyOGrafManifestIntoDist()],
  resolve: {
    // Import @bajaovrlay/shared/clock from its TypeScript source, so this package builds
    // without a build of shared first; see packages/shared/README.md.
    conditions: ['@bajaovrlay/source', ...defaultClientConditions],
  },
  server: {
    port: 5200,
    strictPort: true,
  },
  preview: {
    port: 5201,
    strictPort: true,
  },
  build: {
    rolldownOptions: {
      input: {
        // The graphic itself: message-ticker.js, the file the manifest's "main" points at.
        'message-ticker': 'src/message-ticker.ts',
        // The preview page, kept in dist/ so the control page can embed it later.
        preview: 'preview.html',
      },
      // An app build normally drops an entry's exports; the OGraf renderer needs the
      // default export of message-ticker.js, so keep it.
      preserveEntrySignatures: 'exports-only',
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
