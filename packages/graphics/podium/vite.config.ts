import { readFileSync } from 'node:fs';

import { defineConfig, type Plugin } from 'vite';

const manifestFileName = 'podium.ograf.json';

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
  // Relative URLs everywhere: the server serves dist/ under /graphics/podium/ and the
  // graphic must work there (and under any other folder) without being rebuilt.
  base: './',
  plugins: [copyOGrafManifestIntoDist()],
  server: {
    port: 5210,
    strictPort: true,
  },
  preview: {
    port: 5211,
    strictPort: true,
  },
  build: {
    rolldownOptions: {
      input: {
        // The graphic itself: podium.js, the file the manifest's "main" points at.
        podium: 'src/podium.ts',
        // The preview page, kept in dist/ so the control page can embed it later.
        preview: 'preview.html',
      },
      // An app build normally drops an entry's exports; the OGraf renderer needs the
      // default export of podium.js, so keep it.
      preserveEntrySignatures: 'exports-only',
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
