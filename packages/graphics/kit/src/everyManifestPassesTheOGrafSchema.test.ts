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
 *   - No field of a manifest is titled like one of the item editor's own fields
 *     ("Gráfico", "Camada", "Rótulo", "Cor", "Observações", "Onde"); a manifest that did
 *     would be caught. The editor tells them apart anyway (its "Campos do gráfico" group),
 *     but an operator reading two "Rótulo" boxes would not.
 *
 * What these tests deliberately do not cover:
 *   - What each manifest says (ids, layers, titles, durations): each graphic's own
 *     `<graphic>Manifest.test.ts` checks that.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  createOGrafSchemaValidator,
  ografManifestSchema,
} from './ografSchemaValidator.testSupport.js';

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

/**
 * The item editor's own field names (apps/control's ptBR.itemEditor.fields). A graphic's field
 * with one of these titles reads as two boxes of the same name to the operator.
 */
const itemEditorOwnFieldNames = ['Gráfico', 'Camada', 'Rótulo', 'Cor', 'Observações', 'Onde'];

/**
 * The titles of a data schema's fields that equal an editor field name, ignoring case and
 * the spaces around them, as an operator reads them.
 */
function listFieldTitlesNamedLikeTheEditors(dataSchema: unknown): string[] {
  const properties = (dataSchema as { properties?: Record<string, { title?: unknown }> })
    .properties;
  const clashingTitles: string[] = [];
  for (const property of Object.values(properties ?? {})) {
    if (typeof property.title !== 'string') {
      continue;
    }
    const titleAsRead = property.title.trim().toLocaleLowerCase('pt-BR');
    const isAnEditorFieldName = itemEditorOwnFieldNames.some(
      (editorFieldName) => editorFieldName.toLocaleLowerCase('pt-BR') === titleAsRead,
    );
    if (isAnEditorFieldName) {
      clashingTitles.push(property.title);
    }
  }
  return clashingTitles;
}

describe('the manifests under packages/graphics', () => {
  it('finds the manifest of every graphic the product ships', () => {
    // Arrange: the graphics shipped today, one manifest each.
    const shippedManifests = [
      join('lower-strip', 'lower-strip.ograf.json'),
      join('lower-third', 'lower-third.ograf.json'),
      join('message-ticker', 'message-ticker.ograf.json'),
      join('notice', 'notice.ograf.json'),
      join('positions-tower', 'positions-tower.ograf.json'),
      join('race-clock', 'race-clock.ograf.json'),
      join('sponsor-bug', 'sponsor-bug.ograf.json'),
      join('standings', 'standings.ograf.json'),
      join('team-card', 'team-card.ograf.json'),
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

  it.each(listEveryGraphicManifestPath())(
    '%s titles no field like one of the item editor’s own',
    (path) => {
      // Arrange: the manifest's data schema.
      const dataSchema = readManifest(path).schema;

      // Act: find the field titles that equal an editor field name.
      const clashingTitles = listFieldTitlesNamedLikeTheEditors(dataSchema);

      // Assert: none, so the operator never sees two boxes of the same name.
      expect(clashingTitles, `${path} must not title a field like the editor's own`).toEqual([]);
    },
  );

  it('catches a field titled like one of the item editor’s own', () => {
    // Arrange: the ticker's data schema with its label field titled plainly "Rótulo", as
    // it was before the walk caught the clash, and a colour field titled " cor ".
    const tickerSchema = readManifest(join('message-ticker', 'message-ticker.ograf.json'))
      .schema as { properties: Record<string, Record<string, unknown>> };
    tickerSchema.properties.label = { ...tickerSchema.properties.label, title: 'Rótulo' };
    tickerSchema.properties.pillColor = { type: 'string', title: ' cor ' };

    // Act: find the field titles that equal an editor field name.
    const clashingTitles = listFieldTitlesNamedLikeTheEditors(tickerSchema);

    // Assert: both are caught, so a pass above means something.
    expect(clashingTitles, 'both titles must be caught, whatever their case').toEqual([
      'Rótulo',
      ' cor ',
    ]);
  });
});
