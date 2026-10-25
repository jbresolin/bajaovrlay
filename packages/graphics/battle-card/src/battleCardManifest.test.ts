// @vitest-environment node
/**
 * The OGraf manifest, battle-card.ograf.json (packages/graphics/battle-card)
 *
 * What this module is for:
 *   A renderer finds and drives an OGraf graphic through its manifest: the id, the
 *   module to load, the render modes it supports, how long its animations take and the
 *   JSON Schema of its data (which the control page also uses to build the item form).
 *
 * What these tests prove:
 *   - The manifest passes the official OGraf v1 manifest JSON Schema (vendored in the
 *     kit, so this runs offline), and a copy without "main" fails it, so the check has teeth.
 *   - The fixed settings: id, name, main, real-time only, one step; the lower-third layer
 *     and the positions category in `v_baja`, with no update rule.
 *   - The play length is `--motion-in` + 2 × `--motion-lead` (the car behind starts two
 *     leads after the car ahead) and the stop length `--motion-out`, read from the text of
 *     packages/theme/ardosia/tokens.css.
 *   - Both cars' five fields and the gap are required, the trend set by hand and its change
 *     are not; every field has a pt-BR title; every text field is a single line.
 *   - The trend set by hand is a select of the three trends with pt-BR labels, and the
 *     whole numbers (positions, car numbers, laps, gap, change) can never be negative.
 *
 * What these tests deliberately do not cover:
 *   - That the data schema and the graphic's Zod validation agree;
 *     battleCardManifestDataAgreement.test.ts.
 *   - That the field titles stay clear of the item editor's own; the kit's
 *     everyManifestPassesTheOGrafSchema.test.ts checks every manifest for that.
 *   - The page: this file runs in plain Node (the pragma on line 1).
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import {
  createOGrafSchemaValidator,
  ografManifestSchema,
} from '@bajaovrlay/graphics-kit/ografSchemaValidator.testSupport';
import { describe, expect, it } from 'vitest';

import battleCardManifest from '../battle-card.ograf.json';

/** The text of packages/theme/ardosia/tokens.css, found through the theme package's exports. */
function readArdosiaTokensCssText(): string {
  const resolveLikeNode = createRequire(import.meta.url);
  return readFileSync(resolveLikeNode.resolve('@bajaovrlay/theme/ardosia/tokens.css'), 'utf8');
}

/**
 * Reads a duration token (`--motion-in: 400ms;`) from the text of tokens.css, in
 * milliseconds. Throws when the token is not there: a manifest checked against a missing
 * token would pass for the wrong reason.
 */
function readDurationTokenInMilliseconds(tokenName: string): number {
  const tokensCssText = readArdosiaTokensCssText();
  const tokenDeclaration = new RegExp(`${tokenName}:\\s*(\\d+)ms;`).exec(tokensCssText);
  if (tokenDeclaration === null) {
    throw new Error(`${tokenName} is not declared in packages/theme/ardosia/tokens.css`);
  }
  return Number(tokenDeclaration[1]);
}

/** The data fields as the manifest describes them, each read through one loose shape. */
function listManifestDataFields(): Array<[string, Record<string, unknown>]> {
  return Object.entries(battleCardManifest.schema.properties);
}

describe('battle-card.ograf.json against the OGraf v1 manifest schema', () => {
  it('passes the official schema', () => {
    // Arrange: a validator built from the vendored OGraf v1 schemas.
    const validator = createOGrafSchemaValidator();
    const validateManifest = validator.compile(ografManifestSchema);

    // Act: validate the manifest exactly as it is on disk.
    const isManifestValid = validateManifest(battleCardManifest);

    // Assert: it passes; on failure, the schema errors are shown in the message.
    expect(
      isManifestValid,
      `the manifest must pass the OGraf v1 schema: ${validator.errorsText(validateManifest.errors)}`,
    ).toBe(true);
  });

  it('fails the official schema without "main", so the check has teeth', () => {
    // Arrange: the same validator, and a copy of the manifest without "main".
    const validator = createOGrafSchemaValidator();
    const validateManifest = validator.compile(ografManifestSchema);
    const manifestWithoutMain: Record<string, unknown> = { ...battleCardManifest };
    delete manifestWithoutMain.main;

    // Act: validate the broken copy.
    const isManifestValid = validateManifest(manifestWithoutMain);

    // Assert: the schema rejects it.
    expect(isManifestValid, 'a manifest without "main" must fail the OGraf schema').toBe(false);
  });
});

describe('battle-card.ograf.json settings', () => {
  it('declares the id, name, render modes, step count, layer and category', () => {
    // Arrange: nothing to set up; the manifest is read from disk.

    // Act: pick out the fixed settings.
    const fixedSettings = {
      id: battleCardManifest.id,
      name: battleCardManifest.name,
      main: battleCardManifest.main,
      supportsRealTime: battleCardManifest.supportsRealTime,
      supportsNonRealTime: battleCardManifest.supportsNonRealTime,
      stepCount: battleCardManifest.stepCount,
      v_baja: battleCardManifest.v_baja,
    };

    // Assert: "main" names the built module, the card asks for the lower-third layer.
    expect(fixedSettings, 'the manifest must declare the fixed settings').toEqual({
      id: 'baja-battle-card',
      name: 'Disputa de posição',
      main: 'battle-card.js',
      supportsRealTime: true,
      supportsNonRealTime: false,
      stepCount: 1,
      v_baja: { defaultLayerId: 'lower-third', category: 'positions' },
    });
  });

  it('declares the play length as --motion-in + 2 × --motion-lead and the stop as --motion-out', () => {
    // Arrange: the three durations as tokens.css writes them.
    const motionInMs = readDurationTokenInMilliseconds('--motion-in');
    const motionLeadMs = readDurationTokenInMilliseconds('--motion-lead');
    const motionOutMs = readDurationTokenInMilliseconds('--motion-out');

    // Act: read what the manifest promises a renderer.
    const declaredDurations = battleCardManifest.actionDurations;

    // Assert: the car behind is in two leads after the car ahead starts.
    expect(declaredDurations, 'the manifest durations must be the theme’s motion tokens').toEqual([
      { type: 'playAction', duration: motionInMs + 2 * motionLeadMs },
      { type: 'stopAction', duration: motionOutMs },
    ]);
  });
});

describe('battle-card.ograf.json data fields', () => {
  it('requires both cars and the gap, and refuses fields it does not know', () => {
    // Arrange: nothing to set up; the manifest is read from disk.

    // Act: read the required list and whether unknown fields are allowed.
    const requiredFields = battleCardManifest.schema.required;
    const allowsUnknownFields = battleCardManifest.schema.additionalProperties;

    // Assert: the trend set by hand and its change are the only optional fields.
    expect(requiredFields, 'both cars’ five fields and the gap must be required').toEqual([
      'aheadPosition',
      'aheadCarNumber',
      'aheadTeamName',
      'aheadSchoolName',
      'aheadLaps',
      'behindPosition',
      'behindCarNumber',
      'behindTeamName',
      'behindSchoolName',
      'behindLaps',
      'gapMs',
    ]);
    expect(allowsUnknownFields, 'a field the graphic does not know must be refused').toBe(false);
  });

  it('titles every field in pt-BR, saying which car it belongs to', () => {
    // Arrange: the data fields as the manifest describes them.
    const dataFields = listManifestDataFields();

    // Act: collect each field's title, by field name.
    const titlesByField = Object.fromEntries(
      dataFields.map(([fieldName, field]) => [fieldName, field.title]),
    );

    // Assert: the form's labels.
    expect(titlesByField, 'every field must have its pt-BR title').toEqual({
      aheadPosition: 'Posição do carro da frente',
      aheadCarNumber: 'Número do carro da frente',
      aheadTeamName: 'Equipe do carro da frente',
      aheadSchoolName: 'Escola do carro da frente',
      aheadLaps: 'Voltas do carro da frente',
      behindPosition: 'Posição do carro de trás',
      behindCarNumber: 'Número do carro de trás',
      behindTeamName: 'Equipe do carro de trás',
      behindSchoolName: 'Escola do carro de trás',
      behindLaps: 'Voltas do carro de trás',
      gapMs: 'Diferença entre os carros (ms)',
      manualTrend: 'Tendência à mão',
      manualTrendChangeMs: 'Variação à mão (ms)',
    });
  });

  it('makes every text field a single line and every whole number never negative', () => {
    // Arrange: the data fields as the manifest describes them.
    const dataFields = listManifestDataFields();

    // Act: the gddType of each free text, and the minimum of each whole number.
    const freeTextFields = dataFields.filter(
      ([, field]) => field.type === 'string' && field.enum === undefined,
    );
    const wholeNumberFields = dataFields.filter(([, field]) => field.type === 'integer');

    // Assert: one line for a name, a minimum on every count.
    expect(
      freeTextFields.map(([fieldName, field]) => [fieldName, field.gddType]),
      'every name must be typed on one line',
    ).toEqual([
      ['aheadTeamName', 'single-line'],
      ['aheadSchoolName', 'single-line'],
      ['behindTeamName', 'single-line'],
      ['behindSchoolName', 'single-line'],
    ]);
    expect(
      wholeNumberFields.every(
        ([, field]) => typeof field.minimum === 'number' && field.minimum >= 0,
      ),
      'no position, car, lap, gap or change may be negative',
    ).toBe(true);
  });

  it('offers the trend set by hand as a select of the three trends, labelled in pt-BR', () => {
    // Arrange: nothing to set up; the manifest is read from disk.

    // Act: read the trend's field.
    const trendField = battleCardManifest.schema.properties.manualTrend;

    // Assert: the three trends the design draws, with their pt-BR labels and no default.
    expect(
      { enum: trendField.enum, gddType: trendField.gddType, labels: trendField.gddOptions.labels },
      'the trend set by hand must be a select of the three trends',
    ).toEqual({
      enum: ['closing', 'opening', 'steady'],
      gddType: 'select',
      labels: { closing: 'Fechando', opening: 'Abrindo', steady: 'Estável' },
    });
    expect('default' in trendField, 'a new item must leave the trend to the gap').toBe(false);
  });
});
