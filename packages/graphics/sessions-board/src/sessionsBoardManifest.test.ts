// @vitest-environment node
/**
 * The OGraf manifest, sessions-board.ograf.json (packages/graphics/sessions-board)
 *
 * What this module is for:
 *   A renderer drives the graphic through its manifest, and the control page builds the
 *   item form from its data schema, offering "Lista dos cadastros" on the slots.
 *
 * What these tests prove:
 *   - The manifest passes the official OGraf v1 schema, and fails it without "main".
 *   - The settings: id, name, main, real-time only, one step, the fullscreen layer.
 *   - The play length is twelve rows' play-in (`--motion-lead` + 11 × `--motion-row-stagger`
 *     + `--motion-in`) and the stop length `--motion-out`, from the theme's token file.
 *   - The title and the slots are required, the title "PROGRAMAÇÃO DO DIA" by default, the
 *     short texts single-line, every field titled in pt-BR.
 *   - Each slot asks for the keys every slot of the schedule's entity list carries (its id,
 *     session and start), so the item editor offers the schedule on it.
 *
 * What these tests deliberately do not cover:
 *   - Agreement with the graphic's Zod check; sessionsBoardManifestDataAgreement.test.ts.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import {
  createOGrafSchemaValidator,
  ografManifestSchema,
} from '@bajaovrlay/graphics-kit/ografSchemaValidator.testSupport';
import { listEntityListTypesThatFitDataSchemaField } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import sessionsBoardManifest from '../sessions-board.ograf.json';

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

describe('sessions-board.ograf.json against the OGraf v1 manifest schema', () => {
  it('passes the official schema, and fails it without "main"', () => {
    // Arrange: a validator, and a copy of the manifest without "main".
    const validator = createOGrafSchemaValidator();
    const validateManifest = validator.compile(ografManifestSchema);
    const manifestWithoutMain: Record<string, unknown> = { ...sessionsBoardManifest };
    delete manifestWithoutMain.main;

    // Act: validate both.
    const isManifestValid = validateManifest(sessionsBoardManifest);
    const isBrokenCopyValid = validateManifest(manifestWithoutMain);

    // Assert: the real one passes, the broken one does not.
    expect(isManifestValid, `the manifest must pass: ${validator.errorsText()}`).toBe(true);
    expect(isBrokenCopyValid, 'a manifest without "main" must fail').toBe(false);
  });
});

describe('sessions-board.ograf.json settings', () => {
  it('declares the id, name, render modes, step count and the fullscreen layer', () => {
    // Arrange: nothing to set up.

    // Act: pick out the fixed settings.
    const settings = {
      id: sessionsBoardManifest.id,
      name: sessionsBoardManifest.name,
      main: sessionsBoardManifest.main,
      supportsRealTime: sessionsBoardManifest.supportsRealTime,
      supportsNonRealTime: sessionsBoardManifest.supportsNonRealTime,
      stepCount: sessionsBoardManifest.stepCount,
      vBaja: sessionsBoardManifest.v_baja,
    };

    // Assert: the board's settings.
    expect(settings, 'the board’s settings').toEqual({
      id: 'baja-sessions-board',
      name: 'Programação do dia',
      main: 'sessions-board.js',
      supportsRealTime: true,
      supportsNonRealTime: false,
      stepCount: 1,
      vBaja: { defaultLayerId: 'fullscreen', category: 'schedule' },
    });
  });

  it('promises twelve rows’ play-in and --motion-out', () => {
    // Arrange: the tokens as the theme writes them.
    const playInMs =
      readDurationTokenInMilliseconds('--motion-lead') +
      11 * readDurationTokenInMilliseconds('--motion-row-stagger') +
      readDurationTokenInMilliseconds('--motion-in');
    const stopOutMs = readDurationTokenInMilliseconds('--motion-out');

    // Act: read what the manifest promises.
    const declaredDurations = sessionsBoardManifest.actionDurations;

    // Assert: the theme's numbers.
    expect(declaredDurations, 'the durations are the theme’s').toEqual([
      { type: 'playAction', duration: playInMs },
      { type: 'stopAction', duration: stopOutMs },
    ]);
  });

  it('requires the title and the slots, titles every field in pt-BR, and sets short texts single-line', () => {
    // Arrange: the data fields.
    const properties: Record<string, Record<string, unknown>> = sessionsBoardManifest.schema
      .properties;

    // Act: read the required list, the titles, the single-line texts and the title's default.
    const titles = Object.fromEntries(
      Object.entries(properties).map(([key, field]) => [key, field.title]),
    );
    const singleLineTexts = Object.entries(properties)
      .filter(([, field]) => field.gddType === 'single-line')
      .map(([key]) => key);

    // Assert: as the brief asks.
    expect(sessionsBoardManifest.schema.required, 'the required fields').toEqual([
      'title',
      'slots',
    ]);
    expect(titles, 'every field titled in pt-BR').toEqual({
      title: 'Título do quadro',
      eventLine: 'Linha do evento',
      dateLine: 'Linha da data',
      slots: 'Sessões',
    });
    expect(singleLineTexts, 'the short texts').toEqual(['title', 'eventLine', 'dateLine']);
    expect(properties.title?.default, 'the design’s title by default').toBe('PROGRAMAÇÃO DO DIA');
  });

  it('lets the item editor offer the schedule from Cadastros on the slots, and nothing else', () => {
    // Arrange: nothing to set up; the manifest's data schema is read from disk.

    // Act: ask shared's rule which entity lists fit the slots field.
    const listTypes = listEntityListTypesThatFitDataSchemaField(
      sessionsBoardManifest.schema,
      'slots',
    );

    // Assert: the schedule.
    expect(listTypes, 'the schedule fits the slots').toEqual(['scheduleSlot']);
  });
});
