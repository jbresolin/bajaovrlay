// @vitest-environment node
/**
 * The OGraf manifest, positions-tower.ograf.json (packages/graphics/positions-tower)
 *
 * What this module is for:
 *   A renderer finds and drives an OGraf graphic through its manifest: the id, the
 *   module to load, the render modes it supports, how long its animations take and
 *   the JSON Schema of its data (which the control page uses to build the item form).
 *
 * What these tests prove:
 *   - The manifest passes the official OGraf v1 manifest JSON Schema (vendored in
 *     ograf-schema/, so this runs offline), and a manifest with a required field
 *     removed fails it, so the check has teeth.
 *   - The settings the context pack fixes: id, main, real-time only, one step.
 *   - The manifest tells the BajaOvrLay server, in its vendor field `v_baja`, that the
 *     tower goes on the tower layer and in the positions category, with no update rule.
 *   - The `entries` field suggests its binding to the control page: the positions shape's
 *     whole list (`entries`), live; no other field carries a hint.
 *   - The play and stop durations are the theme's: play is `--motion-in` plus
 *     `--tower-rows-per-page` × `--motion-row-stagger` (the head, then one row after
 *     another), stop is `--motion-out`, both read from packages/theme/ardosia/tokens.css.
 *   - Every data field has a pt-BR title; the entries are the one required field; the
 *     layout and paging selects carry their labels and defaults; every column switch says
 *     it belongs to the detailed layout and has its default (the refuels off).
 *
 * What these tests deliberately do not cover:
 *   - That the data schema and the graphic's Zod validation accept and refuse the same
 *     payloads; positionsTowerManifestDataAgreement.test.ts runs the same payloads through both.
 *   - That a real renderer can load the module named in "main"; the Playwright test
 *     e2e/positionsTowerLifecycle.e2e.ts loads it from dist/ the way a renderer does.
 *   - The page: this file runs in plain Node (the pragma on line 1) since it draws
 *     nothing and reads the token file from disk.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import {
  createOGrafSchemaValidator,
  ografManifestSchema,
} from '@bajaovrlay/graphics-kit/ografSchemaValidator';
import { describe, expect, it } from 'vitest';

import positionsTowerManifest from '../positions-tower.ograf.json';

/**
 * The text of packages/theme/ardosia/tokens.css, found through the theme package's own
 * exports (never by a path into another package's folder).
 */
function readArdosiaTokensCssText(): string {
  const resolveLikeNode = createRequire(import.meta.url);
  return readFileSync(resolveLikeNode.resolve('@bajaovrlay/theme/ardosia/tokens.css'), 'utf8');
}

/**
 * Reads a number token (`--motion-in: 400ms;`, `--tower-rows-per-page: 20;`) from the
 * text of tokens.css. Throws when the token is not there: a manifest checked against a
 * missing token would pass for the wrong reason.
 */
function readNumberToken(tokenName: string): number {
  const tokensCssText = readArdosiaTokensCssText();
  const tokenDeclaration = new RegExp(`${tokenName}:\\s*(\\d+)(?:ms)?;`).exec(tokensCssText);
  if (tokenDeclaration === null) {
    throw new Error(`${tokenName} is not declared in packages/theme/ardosia/tokens.css`);
  }
  return Number(tokenDeclaration[1]);
}

describe('positions-tower.ograf.json against the OGraf v1 manifest schema', () => {
  it('passes the official schema', () => {
    // Arrange: a validator built from the vendored OGraf v1 schemas.
    const validator = createOGrafSchemaValidator();
    const validateManifest = validator.compile(ografManifestSchema);

    // Act: validate the manifest exactly as it is on disk.
    const isManifestValid = validateManifest(positionsTowerManifest);

    // Assert: it passes; on failure, the schema errors are shown in the message.
    expect(
      isManifestValid,
      `the manifest must pass the OGraf v1 schema: ${validator.errorsText(validateManifest.errors)}`,
    ).toBe(true);
  });

  it('fails the official schema when a required field is missing, so the check has teeth', () => {
    // Arrange: the same validator, and a copy of the manifest without "main".
    const validator = createOGrafSchemaValidator();
    const validateManifest = validator.compile(ografManifestSchema);
    const manifestWithoutMain: Record<string, unknown> = { ...positionsTowerManifest };
    delete manifestWithoutMain.main;

    // Act: validate the broken copy.
    const isManifestValid = validateManifest(manifestWithoutMain);

    // Assert: the schema rejects it.
    expect(isManifestValid, 'a manifest without "main" must fail the OGraf schema').toBe(false);
  });
});

describe('positions-tower.ograf.json settings', () => {
  it('declares the id, main, render modes and step count the context pack fixes', () => {
    // Arrange: nothing to set up; the manifest is read from disk.

    // Act: pick out the fixed settings.
    const fixedSettings = {
      id: positionsTowerManifest.id,
      name: positionsTowerManifest.name,
      main: positionsTowerManifest.main,
      supportsRealTime: positionsTowerManifest.supportsRealTime,
      supportsNonRealTime: positionsTowerManifest.supportsNonRealTime,
      stepCount: positionsTowerManifest.stepCount,
    };

    // Assert: they match the context pack, and "main" names the built module in dist/.
    expect(fixedSettings, 'the manifest must declare the fixed settings').toEqual({
      id: 'baja-positions-tower',
      name: 'Torre de posições',
      main: 'positions-tower.js',
      supportsRealTime: true,
      supportsNonRealTime: false,
      stepCount: 1,
    });
  });

  it('declares the tower layer and the positions category, and no update rule, in v_baja', () => {
    // Arrange: nothing to set up; the manifest is read from disk.

    // Act: read BajaOvrLay's own field, which OGraf allows because its name starts with v_.
    const bajaVendorFields = positionsTowerManifest.v_baja;

    // Assert: the server reads the default layer and the category; no rule runs on an
    // update (the list is replaced as the source sends it).
    expect(
      bajaVendorFields,
      'the tower must ask for the tower layer and the positions category, with no update rule',
    ).toEqual({ defaultLayerId: 'tower', category: 'positions' });
  });

  it('suggests the live binding of the entries to the positions list, and hints nothing else', () => {
    // Arrange: the data fields as the manifest describes them.
    const dataFields = Object.entries(positionsTowerManifest.schema.properties);

    // Act: collect the v_baja hint of every field that has one.
    const hintsByField: Record<string, unknown> = {};
    for (const [fieldName, field] of dataFields) {
      if ('v_baja' in field) {
        hintsByField[fieldName] = field.v_baja;
      }
    }

    // Assert: the control page pre-fills the entries with the positions shape's whole
    // list, read live, when exactly one enabled source produces positions.
    expect(hintsByField, 'only the entries carry a hint: the suggested live binding').toEqual({
      entries: { suggestedBinding: { shapeKey: 'positions', path: 'entries', isLive: true } },
    });
  });

  it('declares the play length as the head plus one row stagger per row, and the stop length as --motion-out', () => {
    // Arrange: the tokens as packages/theme/ardosia/tokens.css writes them. The play-in
    // is the head's --motion-in, then each of the page's rows one --motion-row-stagger
    // after the previous (positionsTowerAnimations.ts), so the last row is in at
    // --motion-in + rows × stagger; the out is everything together over --motion-out.
    const motionInMs = readNumberToken('--motion-in');
    const rowStaggerMs = readNumberToken('--motion-row-stagger');
    const rowsPerPage = readNumberToken('--tower-rows-per-page');
    const motionOutMs = readNumberToken('--motion-out');

    // Act: read what the manifest promises a renderer.
    const declaredDurations = positionsTowerManifest.actionDurations;

    // Assert: the manifest says exactly what the theme's tokens add up to.
    expect(declaredDurations, 'the manifest durations must be the theme’s motion tokens').toEqual([
      { type: 'playAction', duration: motionInMs + rowsPerPage * rowStaggerMs },
      { type: 'stopAction', duration: motionOutMs },
    ]);
  });

  it('gives every data field a pt-BR title and requires the entries alone', () => {
    // Arrange: the data fields as the manifest describes them.
    const dataFields = Object.entries(positionsTowerManifest.schema.properties);

    // Act: collect each field's title.
    const titlesByField = Object.fromEntries(
      dataFields.map(([fieldName, field]) => [fieldName, field.title]),
    );

    // Assert: each field has the pt-BR title an operator form will show, and only the
    // entries cannot be left blank.
    expect(titlesByField, 'every data field must carry a pt-BR title').toEqual({
      entries: 'Carros',
      layout: 'Leiaute',
      showGap: 'Diferença para o líder',
      showInterval: 'Intervalo',
      showLastLap: 'Última volta',
      showBestLap: 'Melhor volta',
      showPitStops: 'Paradas',
      showFuelStops: 'Abastecimentos',
      showStatus: 'Situação',
      paging: 'Páginas',
    });
    expect(positionsTowerManifest.schema.required, 'only the entries are required').toEqual([
      'entries',
    ]);
    expect(
      positionsTowerManifest.schema.additionalProperties,
      'a field the tower does not know is refused at the top level',
    ).toBe(false);
  });

  it('describes the entries as the list read from the source, with any item field allowed', () => {
    // Arrange: the entries field.
    const entriesField = positionsTowerManifest.schema.properties.entries;

    // Act: read what the form shows and what an item may carry.
    const entriesAsDescribed = {
      type: entriesField.type,
      description: entriesField.description,
      itemsAllowExtraFields: entriesField.items.additionalProperties,
      itemRequiredFields: entriesField.items.required,
    };

    // Assert: an array whose description points at the source path, and whose items take
    // a canonical entry as is (a field the shape gains later must not break the binding).
    expect(entriesAsDescribed, 'the entries must bind to the source list as is').toEqual({
      type: 'array',
      description: 'A lista de posições, normalmente lida da fonte (Posições › Lista completa).',
      itemsAllowExtraFields: true,
      itemRequiredFields: ['position', 'carNumber', 'teamName', 'schoolName', 'laps', 'status'],
    });
  });

  it('offers the layout and the paging as selects with pt-BR labels and the defaults', () => {
    // Arrange: the two select fields.
    const layoutField = positionsTowerManifest.schema.properties.layout;
    const pagingField = positionsTowerManifest.schema.properties.paging;

    // Act: read what the form shows for each.
    const selectsAsShown = {
      layout: {
        options: layoutField.enum,
        labels: layoutField.gddOptions.labels,
        default: layoutField.default,
      },
      paging: {
        options: pagingField.enum,
        labels: pagingField.gddOptions.labels,
        default: pagingField.default,
      },
    };

    // Assert: compact by default, pages cycling by default, each option labelled.
    expect(selectsAsShown, 'the selects must carry their labels and defaults').toEqual({
      layout: {
        options: ['compact', 'detailed'],
        labels: { compact: 'Compacta', detailed: 'Detalhada' },
        default: 'compact',
      },
      paging: {
        options: ['cycle', 'firstPageOnly'],
        labels: { cycle: 'Alternar páginas', firstPageOnly: 'Só os 20 primeiros' },
        default: 'cycle',
      },
    });
  });

  it('describes every column switch as a column of the detailed layout, with the design’s default', () => {
    // Arrange: the seven column switches.
    const properties = positionsTowerManifest.schema.properties;
    const columnSwitches = {
      showGap: properties.showGap,
      showInterval: properties.showInterval,
      showLastLap: properties.showLastLap,
      showBestLap: properties.showBestLap,
      showPitStops: properties.showPitStops,
      showFuelStops: properties.showFuelStops,
      showStatus: properties.showStatus,
    };

    // Act: read each switch's type, default and whether its description names the layout.
    const switchesAsShown = Object.fromEntries(
      Object.entries(columnSwitches).map(([fieldName, field]) => [
        fieldName,
        {
          type: field.type,
          default: field.default,
          saysDetailedLayout: field.description.includes('leiaute detalhado'),
        },
      ]),
    );

    // Assert: booleans, every one on by default except the refuels (the real scoring app
    // may not count them), every description saying where the column shows.
    const switchedOn = { type: 'boolean', default: true, saysDetailedLayout: true };
    expect(switchesAsShown, 'each switch is a detailed column with the design’s default').toEqual({
      showGap: switchedOn,
      showInterval: switchedOn,
      showLastLap: switchedOn,
      showBestLap: switchedOn,
      showPitStops: switchedOn,
      showFuelStops: { type: 'boolean', default: false, saysDetailedLayout: true },
      showStatus: switchedOn,
    });
  });
});
