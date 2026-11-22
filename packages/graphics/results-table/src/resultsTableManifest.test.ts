// @vitest-environment node
/**
 * The OGraf manifest, results-table.ograf.json (packages/graphics/results-table)
 *
 * What this module is for:
 *   A renderer finds and drives an OGraf graphic through its manifest: the id, the module
 *   to load, the render modes, how long its animations take and the JSON Schema of its
 *   data (which the control page turns into the item form, "Colunas mostradas",
 *   "Ordenar por" and "Sentido" among its fields).
 *
 * What these tests prove:
 *   - The manifest passes the official OGraf v1 schema (vendored in the kit, so offline),
 *     and a copy without "main" fails it, so the check has teeth.
 *   - The settings the brief fixes: id `baja-results-table`, name "Tabela de resultado",
 *     main `results-table.js`, real-time only, one step, the fullscreen layer.
 *   - The rows, the column heads and the table's name suggest their live bindings to the
 *     results table shape; no other field carries a hint.
 *   - The play and stop durations are the theme's, as on the standings' table: play is
 *     `--motion-in` + `--motion-lead` + 20 × `--motion-row-stagger`, stop `--motion-out`.
 *   - Every field has a pt-BR title, the rows and heads alone are required, "Sentido" is
 *     Crescente or Decrescente (ascending by default), and an unknown field is refused.
 *
 * What these tests deliberately do not cover:
 *   - That the data schema and the graphic's Zod model agree;
 *     resultsTableManifestDataAgreement.test.ts runs the same payloads through both.
 *   - The page: this file runs in plain Node (line 1) since it reads the token file from disk.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import {
  createOGrafSchemaValidator,
  ografManifestSchema,
} from '@bajaovrlay/graphics-kit/ografSchemaValidator.testSupport';
import { describe, expect, it } from 'vitest';

import resultsTableManifest from '../results-table.ograf.json';
import { rowsPerPage } from './resultsTableLayout.js';

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

describe('results-table.ograf.json against the OGraf v1 manifest schema', () => {
  it('passes the official schema', () => {
    // Arrange: a validator built from the vendored OGraf v1 schemas.
    const validator = createOGrafSchemaValidator();
    const validateManifest = validator.compile(ografManifestSchema);

    // Act: validate the manifest exactly as it is on disk.
    const isManifestValid = validateManifest(resultsTableManifest);

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
    const manifestWithoutMain: Record<string, unknown> = { ...resultsTableManifest };
    delete manifestWithoutMain.main;

    // Act: validate the broken copy.
    const isManifestValid = validateManifest(manifestWithoutMain);

    // Assert: the schema rejects it.
    expect(isManifestValid, 'a manifest without "main" must fail the OGraf schema').toBe(false);
  });
});

describe('results-table.ograf.json settings', () => {
  it('declares the id, name, main, render modes and step count the brief fixes', () => {
    // Arrange: nothing to set up; the manifest is read from disk.

    // Act: pick out the fixed settings.
    const fixedSettings = {
      id: resultsTableManifest.id,
      name: resultsTableManifest.name,
      main: resultsTableManifest.main,
      supportsRealTime: resultsTableManifest.supportsRealTime,
      supportsNonRealTime: resultsTableManifest.supportsNonRealTime,
      stepCount: resultsTableManifest.stepCount,
    };

    // Assert: they match the brief, and "main" names the built module in dist/.
    expect(fixedSettings, 'the manifest must declare the fixed settings').toEqual({
      id: 'baja-results-table',
      name: 'Tabela de resultado',
      main: 'results-table.js',
      supportsRealTime: true,
      supportsNonRealTime: false,
      stepCount: 1,
    });
  });

  it('declares the fullscreen layer and the standings category in v_baja', () => {
    // Arrange: nothing to set up.

    // Act: read BajaOvrLay's own field.
    const bajaVendorFields = resultsTableManifest.v_baja;

    // Assert: the layer and category the server reads, and no update rule.
    expect(bajaVendorFields, 'the board goes on the fullscreen layer, standings category').toEqual({
      defaultLayerId: 'fullscreen',
      category: 'standings',
    });
  });

  it('suggests the live bindings of the rows, the heads and the name, and hints nothing else', () => {
    // Arrange: the data fields as the manifest describes them.
    const dataFields = Object.entries(resultsTableManifest.schema.properties);

    // Act: collect the v_baja hint of every field that has one.
    const hintsByField: Record<string, unknown> = {};
    for (const [fieldName, field] of dataFields) {
      if ('v_baja' in field) {
        hintsByField[fieldName] = field.v_baja;
      }
    }

    // Assert: the three fields of the results table shape, read live.
    expect(hintsByField, 'the rows, heads and name bind live to the results table').toEqual({
      entries: { suggestedBinding: { shapeKey: 'resultsTable', path: 'entries', isLive: true } },
      columnHeads: {
        suggestedBinding: { shapeKey: 'resultsTable', path: 'columnHeads', isLive: true },
      },
      tableName: {
        suggestedBinding: { shapeKey: 'resultsTable', path: 'tableName', isLive: true },
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
    const declaredDurations = resultsTableManifest.actionDurations;

    // Assert: exactly what the tokens add up to (1100 and 250 in Ardósia).
    expect(declaredDurations, 'the manifest durations must be the theme’s motion tokens').toEqual([
      {
        type: 'playAction',
        duration: motionInMs + motionLeadMs + rowsPerPage * rowStaggerMs,
      },
      { type: 'stopAction', duration: motionOutMs },
    ]);
  });

  it('gives every field a pt-BR title, requires the rows and heads, and offers two directions', () => {
    // Arrange: the data fields.
    const properties = resultsTableManifest.schema.properties;

    // Act: collect each field's title.
    const titlesByField = Object.fromEntries(
      Object.entries(properties).map(([fieldName, field]) => [fieldName, field.title]),
    );

    // Assert: the pt-BR titles, the two required fields, "Sentido", strict top.
    expect(titlesByField, 'every field must carry a pt-BR title').toEqual({
      entries: 'Linhas',
      columnHeads: 'Colunas da tabela',
      tableName: 'Nome da tabela',
      title: 'Título',
      eventLine: 'Evento',
      columnsShown: 'Colunas mostradas',
      sortByColumn: 'Ordenar por',
      sortDirection: 'Sentido',
    });
    expect(resultsTableManifest.schema.required, 'the rows and heads are required').toEqual([
      'entries',
      'columnHeads',
    ]);
    expect(
      {
        values: properties.sortDirection.enum,
        labels: properties.sortDirection.gddOptions.labels,
        default: properties.sortDirection.default,
      },
      '"Sentido" is Crescente or Decrescente, Crescente by default',
    ).toEqual({
      values: ['ascending', 'descending'],
      labels: { ascending: 'Crescente', descending: 'Decrescente' },
      default: 'ascending',
    });
    expect(
      resultsTableManifest.schema.additionalProperties,
      'a field the table does not know is refused at the top level',
    ).toBe(false);
  });

  it('describes each row as the results table shape does, with any extra field allowed', () => {
    // Arrange: the rows' items.
    const entryItems = resultsTableManifest.schema.properties.entries.items;

    // Act: read what a row must and may carry.
    const entriesAsDescribed = {
      requiredFields: entryItems.required,
      allowsExtraFields: entryItems.additionalProperties,
      fields: Object.keys(entryItems.properties),
    };

    // Assert: the shape's fields, the rank optional (the site may give none).
    expect(entriesAsDescribed, 'the rows bind to the shape’s list as is').toEqual({
      requiredFields: ['carNumber', 'teamName', 'schoolName', 'cells'],
      allowsExtraFields: true,
      fields: ['rank', 'carNumber', 'teamName', 'schoolName', 'cells'],
    });
  });
});
