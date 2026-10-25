// @vitest-environment node
/**
 * The OGraf manifest, intermission-board.ograf.json (packages/graphics/intermission-board)
 *
 * What this module is for:
 *   A renderer drives the graphic through its manifest, and the control page builds the
 *   item form from its data schema: the next session from Cadastros or typed, the top five
 *   from the standings source, the sponsors as a list of Cadastros.
 *
 * What these tests prove:
 *   - The manifest passes the official OGraf v1 schema, and fails it without "main".
 *   - The settings: id, name, main, real-time only, one step, the fullscreen layer.
 *   - The play length is 2 × `--motion-lead` + 5 × `--motion-row-stagger` + `--motion-in`, the
 *     stop length `--motion-out`, from the theme's token file.
 *   - Only the next session and its start are required; the start is a moment in ms; the
 *     short texts are single-line; every field is titled in pt-BR.
 *   - The top five accept the standings' entries (the same items, the binding suggested);
 *     the sponsors accept every sponsor of Cadastros.
 *
 * What these tests deliberately do not cover:
 *   - Agreement with the graphic's Zod check; intermissionBoardManifestDataAgreement.test.ts.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import {
  createOGrafSchemaValidator,
  ografManifestSchema,
} from '@bajaovrlay/graphics-kit/ografSchemaValidator.testSupport';
import { listEntityListTypesThatFitDataSchemaField } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import intermissionBoardManifest from '../intermission-board.ograf.json';

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

describe('intermission-board.ograf.json against the OGraf v1 manifest schema', () => {
  it('passes the official schema, and fails it without "main"', () => {
    // Arrange: a validator, and a copy without "main".
    const validator = createOGrafSchemaValidator();
    const validateManifest = validator.compile(ografManifestSchema);
    const manifestWithoutMain: Record<string, unknown> = { ...intermissionBoardManifest };
    delete manifestWithoutMain.main;

    // Act: validate both.
    const isManifestValid = validateManifest(intermissionBoardManifest);
    const isBrokenCopyValid = validateManifest(manifestWithoutMain);

    // Assert: the real one passes, the broken one does not.
    expect(isManifestValid, `the manifest must pass: ${validator.errorsText()}`).toBe(true);
    expect(isBrokenCopyValid, 'a manifest without "main" must fail').toBe(false);
  });
});

describe('intermission-board.ograf.json settings', () => {
  it('declares the id, name, render modes, step count and the fullscreen layer', () => {
    // Arrange: nothing to set up.

    // Act: pick out the fixed settings.
    const settings = {
      id: intermissionBoardManifest.id,
      name: intermissionBoardManifest.name,
      main: intermissionBoardManifest.main,
      supportsRealTime: intermissionBoardManifest.supportsRealTime,
      supportsNonRealTime: intermissionBoardManifest.supportsNonRealTime,
      stepCount: intermissionBoardManifest.stepCount,
      vBaja: intermissionBoardManifest.v_baja,
    };

    // Assert: the board's settings.
    expect(settings, 'the board’s settings').toEqual({
      id: 'baja-intermission-board',
      name: 'Quadro do intervalo',
      main: 'intermission-board.js',
      supportsRealTime: true,
      supportsNonRealTime: false,
      stepCount: 1,
      vBaja: { defaultLayerId: 'fullscreen', category: 'break' },
    });
  });

  it('promises the play-in’s length and --motion-out', () => {
    // Arrange: the tokens as the theme writes them.
    const playInMs =
      2 * readDurationTokenInMilliseconds('--motion-lead') +
      5 * readDurationTokenInMilliseconds('--motion-row-stagger') +
      readDurationTokenInMilliseconds('--motion-in');
    const stopOutMs = readDurationTokenInMilliseconds('--motion-out');

    // Act: read what the manifest promises.
    const declaredDurations = intermissionBoardManifest.actionDurations;

    // Assert: the theme's numbers.
    expect(declaredDurations, 'the durations are the theme’s').toEqual([
      { type: 'playAction', duration: playInMs },
      { type: 'stopAction', duration: stopOutMs },
    ]);
  });

  it('requires only the next session and its start, a moment in ms', () => {
    // Arrange: the data fields.
    const properties: Record<string, Record<string, unknown>> = intermissionBoardManifest.schema
      .properties;

    // Act: read the required list, the titles, the start and the single-line texts.
    const titles = Object.fromEntries(
      Object.entries(properties).map(([key, field]) => [key, field.title]),
    );
    const singleLineTexts = Object.entries(properties)
      .filter(([, field]) => field.gddType === 'single-line')
      .map(([key]) => key);
    const start = intermissionBoardManifest.schema.properties.nextStartsAtMs;

    // Assert: as the brief asks.
    expect(intermissionBoardManifest.schema.required, 'the required fields').toEqual([
      'nextSessionName',
      'nextStartsAtMs',
    ]);
    expect(titles, 'every field titled in pt-BR').toEqual({
      eventLine: 'Linha do evento',
      dateLine: 'Linha da data',
      nextSessionName: 'Próxima sessão',
      nextStartsAtMs: 'Largada da próxima sessão',
      topFive: 'Cinco primeiros',
      sponsors: 'Patrocinadores',
    });
    expect({ type: start.type, unit: start.v_baja.unit }, 'a moment in ms').toEqual({
      type: 'integer',
      unit: 'epochMs',
    });
    expect(singleLineTexts, 'the short texts').toEqual([
      'eventLine',
      'dateLine',
      'nextSessionName',
    ]);
  });

  it('takes the standings’ entries for the top five and every sponsor of Cadastros', () => {
    // Arrange: nothing to set up.

    // Act: read the top five's suggested binding and the lists that fit the sponsors.
    const suggestedBinding =
      intermissionBoardManifest.schema.properties.topFive.v_baja.suggestedBinding;
    const sponsorLists = listEntityListTypesThatFitDataSchemaField(
      intermissionBoardManifest.schema,
      'sponsors',
    );

    // Assert: the standings' list, and the sponsors.
    expect(suggestedBinding, 'the standings’ entries, live').toEqual({
      shapeKey: 'standings',
      path: 'entries',
      isLive: true,
    });
    expect(sponsorLists, 'every sponsor fits').toEqual(['sponsor']);
  });
});
