// @vitest-environment node
/**
 * Every graphic's manifest against the official OGraf v1 schema (packages/graphics/kit)
 *
 * What this module is for:
 *   The kit holds the one vendored copy of the OGraf v1 schemas and the validator every
 *   graphic's manifest test builds from them. A validator that only worked for the graphic
 *   it was first written for would let the next graphic's manifest through unchecked.
 *
 * What these tests prove:
 *   - The validator finds every graphic folder's `*.ograf.json` under packages/graphics,
 *     and the list is exactly the graphics the product ships (a new graphic is added here).
 *   - Each of those manifests passes the official manifest schema, and its data schema
 *     compiles on its own (as each graphic's ManifestDataAgreement test compiles it).
 *   - A manifest with a required field removed fails, so the check has teeth.
 *
 * What these tests deliberately do not cover:
 *   - What each manifest says (ids, layers, titles, durations): each graphic's own
 *     `<graphic>Manifest.test.ts` checks that.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { createOGrafSchemaValidator, ografManifestSchema } from './ografSchemaValidator.js';

const graphicsFolder = fileURLToPath(new URL('../../', import.meta.url));

/** Every `<folder>/<name>.ograf.json` under packages/graphics, as folder-relative paths. */
function listEveryGraphicManifestPath(): string[] {
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
function readManifest(manifestPath: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(graphicsFolder, manifestPath), 'utf8')) as Record<
    string,
    unknown
  >;
}

describe('the manifests under packages/graphics', () => {
  it('finds the manifest of every graphic the product ships', () => {
    // Arrange: the graphics shipped today, one manifest each.
    const shippedManifests = [
      join('notice', 'notice.ograf.json'),
      join('positions-tower', 'positions-tower.ograf.json'),
      join('race-clock', 'race-clock.ograf.json'),
    ];

    // Act: list the manifests on disk.
    const manifestsFound = listEveryGraphicManifestPath();

    // Assert: exactly those, so a new graphic's manifest is checked once it is listed here.
    expect(manifestsFound, 'every shipped graphic must have its manifest found').toEqual(
      shippedManifests,
    );
  });

  it.each(listEveryGraphicManifestPath())('%s passes the official OGraf v1 schema', (path) => {
    // Arrange: the validator every graphic's manifest test builds, and the manifest on disk.
    const validateManifest = createOGrafSchemaValidator().compile(ografManifestSchema);
    const manifest = readManifest(path);

    // Act: validate the manifest exactly as it is on disk.
    const isManifestValid = validateManifest(manifest);

    // Assert: it passes, and nothing was reported.
    expect(validateManifest.errors ?? [], `${path} must report no schema errors`).toEqual([]);
    expect(isManifestValid, `${path} must pass the OGraf v1 manifest schema`).toBe(true);
  });

  it.each(listEveryGraphicManifestPath())('%s has a data schema that compiles alone', (path) => {
    // Arrange: the validator and the manifest's data schema.
    const validator = createOGrafSchemaValidator();
    const dataSchema = readManifest(path).schema;

    // Act: compile the data schema on its own, as the agreement tests do.
    const compileTheDataSchema = () => validator.compile(dataSchema as object);

    // Assert: strict mode accepts it (v_baja and the GDD hints are known annotations).
    expect(compileTheDataSchema, `${path}'s data schema must compile on its own`).not.toThrow();
  });

  it('refuses a manifest with a required field removed', () => {
    // Arrange: the race clock's manifest without its "main" (the module a renderer loads).
    const validateManifest = createOGrafSchemaValidator().compile(ografManifestSchema);
    const manifestWithoutMain = readManifest(join('race-clock', 'race-clock.ograf.json'));
    delete manifestWithoutMain.main;

    // Act: validate the broken manifest.
    const isManifestValid = validateManifest(manifestWithoutMain);

    // Assert: it fails, so a pass above means something.
    expect(isManifestValid, 'a manifest without "main" must fail the schema').toBe(false);
  });
});
