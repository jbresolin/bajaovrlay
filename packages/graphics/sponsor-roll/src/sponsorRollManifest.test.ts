// @vitest-environment node
/**
 * The OGraf manifest, sponsor-roll.ograf.json (packages/graphics/sponsor-roll)
 *
 * What this module is for:
 *   A renderer drives the graphic through its manifest, and the control page builds the
 *   item form from its data schema, offering "Lista dos cadastros" on the sponsors.
 *
 * What these tests prove:
 *   - The manifest passes the official OGraf v1 schema, and fails it without "main".
 *   - The settings: id, name, main, real-time only, one step, the fullscreen layer and the
 *     sponsor category.
 *   - The play length is six tiles' play-in (`--motion-lead` + 5 × `--motion-row-stagger` +
 *     `--motion-in`), the stop length `--motion-out`.
 *   - The layout and the sponsors are required; every field is titled in pt-BR; the word
 *     is single-line; the levels are shared's six in round order.
 *   - The sponsors' items ask for keys every sponsor of the entity list carries, so the
 *     item editor offers every sponsor on them.
 *
 * What these tests deliberately do not cover:
 *   - Agreement with the graphic's Zod check; sponsorRollManifestDataAgreement.test.ts.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import {
  createOGrafSchemaValidator,
  ografManifestSchema,
} from '@bajaovrlay/graphics-kit/ografSchemaValidator.testSupport';
import { listEntityListTypesThatFitDataSchemaField } from '@bajaovrlay/shared';
import { sponsorLevelsInRoundOrder } from '@bajaovrlay/shared/sponsorLevels';
import { describe, expect, it } from 'vitest';

import sponsorRollManifest from '../sponsor-roll.ograf.json';

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

describe('sponsor-roll.ograf.json against the OGraf v1 manifest schema', () => {
  it('passes the official schema, and fails it without "main"', () => {
    // Arrange: a validator, and a copy without "main".
    const validator = createOGrafSchemaValidator();
    const validateManifest = validator.compile(ografManifestSchema);
    const manifestWithoutMain: Record<string, unknown> = { ...sponsorRollManifest };
    delete manifestWithoutMain.main;

    // Act: validate both.
    const isManifestValid = validateManifest(sponsorRollManifest);
    const isBrokenCopyValid = validateManifest(manifestWithoutMain);

    // Assert: the real one passes, the broken one does not.
    expect(isManifestValid, `the manifest must pass: ${validator.errorsText()}`).toBe(true);
    expect(isBrokenCopyValid, 'a manifest without "main" must fail').toBe(false);
  });
});

describe('sponsor-roll.ograf.json settings', () => {
  it('declares the id, name, render modes, step count, layer and category', () => {
    // Arrange: nothing to set up.

    // Act: pick out the fixed settings.
    const settings = {
      id: sponsorRollManifest.id,
      name: sponsorRollManifest.name,
      main: sponsorRollManifest.main,
      supportsRealTime: sponsorRollManifest.supportsRealTime,
      supportsNonRealTime: sponsorRollManifest.supportsNonRealTime,
      stepCount: sponsorRollManifest.stepCount,
      vBaja: sponsorRollManifest.v_baja,
    };

    // Assert: the roll's settings.
    expect(settings, 'the roll’s settings').toEqual({
      id: 'baja-sponsor-roll',
      name: 'Rodízio de patrocinadores',
      main: 'sponsor-roll.js',
      supportsRealTime: true,
      supportsNonRealTime: false,
      stepCount: 1,
      vBaja: { defaultLayerId: 'fullscreen', category: 'sponsor' },
    });
  });

  it('promises six tiles’ play-in and --motion-out', () => {
    // Arrange: the tokens as the theme writes them.
    const playInMs =
      readDurationTokenInMilliseconds('--motion-lead') +
      5 * readDurationTokenInMilliseconds('--motion-row-stagger') +
      readDurationTokenInMilliseconds('--motion-in');
    const stopOutMs = readDurationTokenInMilliseconds('--motion-out');

    // Act: read what the manifest promises.
    const declaredDurations = sponsorRollManifest.actionDurations;

    // Assert: the theme's numbers.
    expect(declaredDurations, 'the durations are the theme’s').toEqual([
      { type: 'playAction', duration: playInMs },
      { type: 'stopAction', duration: stopOutMs },
    ]);
  });

  it('requires the layout and the sponsors, titles every field, and lists shared’s levels', () => {
    // Arrange: the data fields.
    const properties: Record<string, Record<string, unknown>> = sponsorRollManifest.schema
      .properties;

    // Act: read the required list, the titles and the levels the items take.
    const titles = Object.fromEntries(
      Object.entries(properties).map(([key, field]) => [key, field.title]),
    );
    const levels = sponsorRollManifest.schema.properties.sponsors.items.properties.level.enum;

    // Assert: as the brief asks.
    expect(sponsorRollManifest.schema.required, 'the required fields').toEqual([
      'layout',
      'sponsors',
    ]);
    expect(titles, 'every field titled in pt-BR').toEqual({
      layout: 'Formato',
      sponsors: 'Patrocinadores',
      eventWord: 'Palavra do evento',
    });
    expect(properties.eventWord?.gddType, 'the word is a short text').toBe('single-line');
    expect(levels, 'the six levels in round order').toEqual([...sponsorLevelsInRoundOrder]);
  });

  it('lets the item editor offer every sponsor from Cadastros on the sponsors', () => {
    // Arrange: nothing to set up.

    // Act: ask shared's rule which entity lists fit the field.
    const listTypes = listEntityListTypesThatFitDataSchemaField(
      sponsorRollManifest.schema,
      'sponsors',
    );

    // Assert: the sponsors.
    expect(listTypes, 'every sponsor fits').toEqual(['sponsor']);
  });
});
