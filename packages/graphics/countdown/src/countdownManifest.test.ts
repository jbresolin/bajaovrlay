// @vitest-environment node
/**
 * The OGraf manifest, countdown.ograf.json (packages/graphics/countdown)
 *
 * What this module is for:
 *   A renderer finds and drives an OGraf graphic through its manifest, and the control page
 *   builds the item form from its data schema.
 *
 * What these tests prove:
 *   - The manifest passes the official OGraf v1 manifest JSON Schema, and fails it without
 *     "main", so the check has teeth.
 *   - The settings: id, name, main, real-time only, one step; the clock layer and the clock
 *     category by default (the waiting board's item picks the fullscreen layer).
 *   - The play length is the longest play-in, the board's `--motion-lead` + `--motion-in`,
 *     and the stop length `--motion-out`, read from the theme's token file.
 *   - The layout, the session and the start are required; unknown fields are refused.
 *   - The start is a whole number marked `v_baja.unit: "epochMs"`, so the form shows the
 *     date-and-time input and a schedule slot's start fits it; the short texts are
 *     single-line; every field has a pt-BR title.
 *
 * What these tests deliberately do not cover:
 *   - Agreement with the graphic's Zod check; countdownManifestDataAgreement.test.ts.
 *   - The page: this file runs in plain Node (the pragma on line 1).
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import {
  createOGrafSchemaValidator,
  ografManifestSchema,
} from '@bajaovrlay/graphics-kit/ografSchemaValidator.testSupport';
import { describe, expect, it } from 'vitest';

import countdownManifest from '../countdown.ograf.json';

/** Reads a duration token (`--motion-in: 400ms;`) from the theme's tokens.css, in ms. */
function readDurationTokenInMilliseconds(tokenName: string): number {
  const resolveLikeNode = createRequire(import.meta.url);
  const tokensCssText = readFileSync(
    resolveLikeNode.resolve('@bajaovrlay/theme/ardosia/tokens.css'),
    'utf8',
  );
  const tokenDeclaration = new RegExp(`${tokenName}:\\s*(\\d+)ms;`).exec(tokensCssText);
  if (tokenDeclaration === null) {
    throw new Error(`${tokenName} is not declared in packages/theme/ardosia/tokens.css`);
  }
  return Number(tokenDeclaration[1]);
}

describe('countdown.ograf.json against the OGraf v1 manifest schema', () => {
  it('passes the official schema, and fails it without "main"', () => {
    // Arrange: a validator built from the vendored OGraf v1 schemas, and a broken copy.
    const validator = createOGrafSchemaValidator();
    const validateManifest = validator.compile(ografManifestSchema);
    const manifestWithoutMain: Record<string, unknown> = { ...countdownManifest };
    delete manifestWithoutMain.main;

    // Act: validate both.
    const isManifestValid = validateManifest(countdownManifest);
    const isBrokenCopyValid = validateManifest(manifestWithoutMain);

    // Assert: the real one passes, the broken one does not.
    expect(isManifestValid, `the manifest must pass: ${validator.errorsText()}`).toBe(true);
    expect(isBrokenCopyValid, 'a manifest without "main" must fail').toBe(false);
  });
});

describe('countdown.ograf.json settings', () => {
  it('declares the id, name, render modes, step count, layer and category', () => {
    // Arrange: nothing to set up; the manifest is read from disk.

    // Act: pick out the fixed settings.
    const settings = {
      id: countdownManifest.id,
      name: countdownManifest.name,
      main: countdownManifest.main,
      supportsRealTime: countdownManifest.supportsRealTime,
      supportsNonRealTime: countdownManifest.supportsNonRealTime,
      stepCount: countdownManifest.stepCount,
      vBaja: countdownManifest.v_baja,
    };

    // Assert: the clock layer by default, no update rule.
    expect(settings, 'the countdown’s settings').toEqual({
      id: 'baja-countdown',
      name: 'Contagem regressiva',
      main: 'countdown.js',
      supportsRealTime: true,
      supportsNonRealTime: false,
      stepCount: 1,
      vBaja: { defaultLayerId: 'clock', category: 'clock' },
    });
  });

  it('promises the board’s play-in (--motion-lead + --motion-in) and --motion-out', () => {
    // Arrange: the three durations as the theme writes them.
    const playInMs =
      readDurationTokenInMilliseconds('--motion-lead') +
      readDurationTokenInMilliseconds('--motion-in');
    const stopOutMs = readDurationTokenInMilliseconds('--motion-out');

    // Act: read what the manifest promises.
    const declaredDurations = countdownManifest.actionDurations;

    // Assert: the theme's numbers.
    expect(declaredDurations, 'the manifest durations are the theme’s').toEqual([
      { type: 'playAction', duration: playInMs },
      { type: 'stopAction', duration: stopOutMs },
    ]);
  });

  it('requires the layout, the session and the start, and refuses unknown fields', () => {
    // Arrange: nothing to set up.

    // Act: read the required list and the unknown-field rule.
    const { required, additionalProperties } = countdownManifest.schema;

    // Assert: the three the count cannot do without.
    expect(required, 'the required fields').toEqual(['layout', 'sessionName', 'startsAtMs']);
    expect(additionalProperties, 'a typo must be refused').toBe(false);
  });

  it('marks the start as a moment in ms and the short texts single-line, all titled in pt-BR', () => {
    // Arrange: the data fields as the manifest describes them.
    const properties: Record<string, Record<string, unknown>> = countdownManifest.schema.properties;

    // Act: read each field's title, the start's type and unit, and the single-line texts.
    const titles = Object.fromEntries(
      Object.entries(properties).map(([key, field]) => [key, field.title]),
    );
    const start = countdownManifest.schema.properties.startsAtMs;
    const singleLineTexts = Object.entries(properties)
      .filter(([, field]) => field.gddType === 'single-line')
      .map(([key]) => key);

    // Assert: the form's labels, the start a date-and-time of a whole number.
    expect(titles, 'every field titled in pt-BR').toEqual({
      layout: 'Formato',
      sessionName: 'Sessão',
      startsAtMs: 'Largada',
      eventLine: 'Linha do evento',
      dateLine: 'Linha da data',
    });
    expect({ type: start.type, unit: start.v_baja.unit }, 'the start in ms since 1970').toEqual({
      type: 'integer',
      unit: 'epochMs',
    });
    expect(singleLineTexts, 'the short texts are single-line').toEqual([
      'sessionName',
      'eventLine',
      'dateLine',
    ]);
  });
});
