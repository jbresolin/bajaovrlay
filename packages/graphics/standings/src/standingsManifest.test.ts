// @vitest-environment node
/**
 * The OGraf manifest, standings.ograf.json (packages/graphics/standings)
 *
 * What this module is for:
 *   A renderer finds and drives an OGraf graphic through its manifest: the id, the module
 *   to load, the render modes, how long its animations take and the JSON Schema of its
 *   data (which the control page turns into the item form).
 *
 * What these tests prove:
 *   - The manifest passes the official OGraf v1 schema (vendored in the kit, so offline),
 *     and a copy without "main" fails it, so the check has teeth.
 *   - The settings the brief fixes: id `baja-standings`, main `standings.js`, real-time
 *     only, one step; `v_baja` puts it on the fullscreen layer in the standings category.
 *   - The entries and the score parts suggest their live bindings to the standings shape
 *     (`entries`, `scoreParts`); no other field carries a hint.
 *   - The play and stop durations are the theme's: play is `--motion-in` + `--motion-lead`
 *     + 20 × `--motion-row-stagger` (the head card, then the column head and 20 rows),
 *     stop is `--motion-out`, both read from packages/theme/ardosia/tokens.css.
 *   - Every field has a pt-BR title, the entries alone are required, the title defaults to
 *     "CLASSIFICAÇÃO GERAL", and an unknown field is refused at the top.
 *
 * What these tests deliberately do not cover:
 *   - That the data schema and the graphic's Zod model agree;
 *     standingsManifestDataAgreement.test.ts runs the same payloads through both.
 *   - That a renderer can load "main"; e2e/standingsLifecycle.e2e.ts does it from dist/.
 *   - The page: this file runs in plain Node (line 1) since it reads the token file from disk.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import {
  createOGrafSchemaValidator,
  ografManifestSchema,
} from '@bajaovrlay/graphics-kit/ografSchemaValidator';
import { describe, expect, it } from 'vitest';

import standingsManifest from '../standings.ograf.json';
import { rowsPerTablePage } from './standingsLayout.js';

/** The text of packages/theme/ardosia/tokens.css, found through the theme package's exports. */
function readArdosiaTokensCssText(): string {
  const resolveLikeNode = createRequire(import.meta.url);
  return readFileSync(resolveLikeNode.resolve('@bajaovrlay/theme/ardosia/tokens.css'), 'utf8');
}

/**
 * Reads a duration token (`--motion-in: 400ms;`) from tokens.css. Throws when the token is
 * not there: a manifest checked against a missing token would pass for the wrong reason.
 */
function readDurationTokenMs(tokenName: string): number {
  const tokenDeclaration = new RegExp(`${tokenName}:\\s*(\\d+)ms;`).exec(
    readArdosiaTokensCssText(),
  );
  if (tokenDeclaration === null) {
    throw new Error(`${tokenName} is not declared in packages/theme/ardosia/tokens.css`);
  }
  return Number(tokenDeclaration[1]);
}

describe('standings.ograf.json against the OGraf v1 manifest schema', () => {
  it('passes the official schema', () => {
    // Arrange: a validator built from the vendored OGraf v1 schemas.
    const validator = createOGrafSchemaValidator();
    const validateManifest = validator.compile(ografManifestSchema);

    // Act: validate the manifest exactly as it is on disk.
    const isManifestValid = validateManifest(standingsManifest);

    // Assert: it passes; on failure the schema's errors are in the message.
    expect(
      isManifestValid,
      `the manifest must pass the OGraf v1 schema: ${validator.errorsText(validateManifest.errors)}`,
    ).toBe(true);
  });

  it('fails the official schema when a required field is missing, so the check has teeth', () => {
    // Arrange: the same validator, and a copy of the manifest without "main".
    const validator = createOGrafSchemaValidator();
    const validateManifest = validator.compile(ografManifestSchema);
    const manifestWithoutMain: Record<string, unknown> = { ...standingsManifest };
    delete manifestWithoutMain.main;

    // Act: validate the broken copy.
    const isManifestValid = validateManifest(manifestWithoutMain);

    // Assert: the schema rejects it.
    expect(isManifestValid, 'a manifest without "main" must fail the OGraf schema').toBe(false);
  });
});

describe('standings.ograf.json settings', () => {
  it('declares the id, name, main, render modes and step count the brief fixes', () => {
    // Arrange: nothing to set up; the manifest is read from disk.

    // Act: pick out the fixed settings.
    const fixedSettings = {
      id: standingsManifest.id,
      name: standingsManifest.name,
      main: standingsManifest.main,
      supportsRealTime: standingsManifest.supportsRealTime,
      supportsNonRealTime: standingsManifest.supportsNonRealTime,
      stepCount: standingsManifest.stepCount,
    };

    // Assert: they match the brief, and "main" names the built module in dist/.
    expect(fixedSettings, 'the manifest must declare the fixed settings').toEqual({
      id: 'baja-standings',
      name: 'Classificação',
      main: 'standings.js',
      supportsRealTime: true,
      supportsNonRealTime: false,
      stepCount: 1,
    });
  });

  it('declares the fullscreen layer and the standings category in v_baja', () => {
    // Arrange: nothing to set up.

    // Act: read BajaOvrLay's own field.
    const bajaVendorFields = standingsManifest.v_baja;

    // Assert: the layer and category the server reads, and no update rule.
    expect(bajaVendorFields, 'the board goes on the fullscreen layer, standings category').toEqual({
      defaultLayerId: 'fullscreen',
      category: 'standings',
    });
  });

  it('suggests the live bindings of the entries and the score parts, and hints nothing else', () => {
    // Arrange: the data fields as the manifest describes them.
    const dataFields = Object.entries(standingsManifest.schema.properties);

    // Act: collect the v_baja hint of every field that has one.
    const hintsByField: Record<string, unknown> = {};
    for (const [fieldName, field] of dataFields) {
      if ('v_baja' in field) {
        hintsByField[fieldName] = field.v_baja;
      }
    }

    // Assert: both lists of the standings shape, read live.
    expect(hintsByField, 'the entries and the parts bind live to the standings shape').toEqual({
      entries: { suggestedBinding: { shapeKey: 'standings', path: 'entries', isLive: true } },
      scoreParts: {
        suggestedBinding: { shapeKey: 'standings', path: 'scoreParts', isLive: true },
      },
    });
  });

  it('declares play as in + lead + 20 row staggers, and stop as --motion-out', () => {
    // Arrange: the tokens as tokens.css writes them, and the 20 rows of a page.
    const motionInMs = readDurationTokenMs('--motion-in');
    const motionLeadMs = readDurationTokenMs('--motion-lead');
    const rowStaggerMs = readDurationTokenMs('--motion-row-stagger');
    const motionOutMs = readDurationTokenMs('--motion-out');

    // Act: read what the manifest promises a renderer.
    const declaredDurations = standingsManifest.actionDurations;

    // Assert: exactly what the tokens add up to (1100 and 250 in Ardósia).
    expect(declaredDurations, 'the manifest durations must be the theme’s motion tokens').toEqual([
      {
        type: 'playAction',
        duration: motionInMs + motionLeadMs + rowsPerTablePage * rowStaggerMs,
      },
      { type: 'stopAction', duration: motionOutMs },
    ]);
  });

  it('gives every field a pt-BR title, requires the entries alone and defaults the title', () => {
    // Arrange: the data fields.
    const properties = standingsManifest.schema.properties;

    // Act: collect each field's title.
    const titlesByField = Object.fromEntries(
      Object.entries(properties).map(([fieldName, field]) => [fieldName, field.title]),
    );

    // Assert: the pt-BR titles, the one required field, the default title, strict top.
    expect(titlesByField, 'every field must carry a pt-BR title').toEqual({
      entries: 'Equipes',
      scoreParts: 'Partes da pontuação',
      title: 'Título',
      eventLine: 'Evento',
    });
    expect(standingsManifest.schema.required, 'only the entries are required').toEqual(['entries']);
    expect(properties.title.default, 'the title defaults to the overall standings').toBe(
      'CLASSIFICAÇÃO GERAL',
    );
    expect(
      standingsManifest.schema.additionalProperties,
      'a field the standings do not know is refused at the top level',
    ).toBe(false);
  });

  it('describes each entry as the standings shape does, with any extra field allowed', () => {
    // Arrange: the entries' items.
    const entryItems = standingsManifest.schema.properties.entries.items;

    // Act: read what an entry must and may carry.
    const entriesAsDescribed = {
      requiredFields: entryItems.required,
      allowsExtraFields: entryItems.additionalProperties,
      fields: Object.keys(entryItems.properties),
    };

    // Assert: the shape's fields, rank optional (a disqualified team has none).
    expect(entriesAsDescribed, 'the entries bind to the canonical standings list as is').toEqual({
      requiredFields: ['carNumber', 'teamName', 'schoolName', 'points'],
      allowsExtraFields: true,
      fields: [
        'rank',
        'carNumber',
        'teamName',
        'schoolName',
        'points',
        'pointsByPart',
        'isDisqualified',
      ],
    });
  });
});
