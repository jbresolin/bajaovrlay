/**
 * Test support for the kit's checks across every graphic: finds each graphic folder's
 * `*.ograf.json` under packages/graphics and reads it. Shared by
 * everyManifestPassesTheOGrafSchema.test.ts and screenCornerNamesInEveryManifest.test.ts,
 * so both walk exactly the same manifests.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const graphicsFolder = fileURLToPath(new URL('../../', import.meta.url));

/** Every `<folder>/<name>.ograf.json` under packages/graphics, as folder-relative paths. */
export function listEveryGraphicManifestPath(): string[] {
  const manifestPaths: string[] = [];
  for (const folderEntry of readdirSync(graphicsFolder, { withFileTypes: true })) {
    if (!folderEntry.isDirectory()) {
      continue;
    }
    const folderPath = join(graphicsFolder, folderEntry.name);
    for (const fileName of readdirSync(folderPath)) {
      if (fileName.endsWith('.ograf.json')) {
        manifestPaths.push(join(folderEntry.name, fileName));
      }
    }
  }
  return manifestPaths.sort();
}

/** Reads one manifest from packages/graphics as parsed JSON. */
export function readManifest(manifestPath: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(graphicsFolder, manifestPath), 'utf8')) as Record<
    string,
    unknown
  >;
}
