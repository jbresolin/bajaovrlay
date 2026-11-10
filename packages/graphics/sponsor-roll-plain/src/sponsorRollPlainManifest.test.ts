// @vitest-environment node
/**
 * The OGraf manifest, sponsor-roll-plain.ograf.json (packages/graphics/sponsor-roll-plain)
 *
 * What this module is for:
 *   A renderer finds and drives an OGraf graphic through its manifest: the id, the module to
 *   load, the render modes, how long its animations take and the JSON Schema of its data,
 *   which the control page builds the item form from. The server reads `v_baja` too: the
 *   layer a take uses, and the auto-out rule that takes the roll off when its pass ends.
 *
 * What these tests prove:
 *   - The manifest passes the official OGraf v1 manifest JSON Schema (vendored in the kit).
 *   - The settings: id, name, main, real-time only, one step; the bug's layer by default, in
 *     the sponsor category, with the auto-out rule `onePlainSponsorRollPass`.
 *   - The play length is shared's entrance, the pass's first 0,4 s, and the theme's
 *     `--motion-in`; the stop length is `--motion-out`.
 *   - The sponsors are required, and a sponsor needs only its name and level (a sponsor
 *     with no logo is skipped, never refused); the corner is the kit's four as a select,
 *     top-left by default. The corners' pt-BR names are checked once for every graphic, in
 *     the kit's screenCornerNamesInEveryManifest.test.ts.
 *
 * What these tests deliberately do not cover:
 *   - That the data schema and the Zod validation agree; the agreement test.
 *   - That a real renderer can load the module named in "main"; the e2e tests.
 *   - The page: this file runs in plain Node (the pragma on line 1).
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import {
  createOGrafSchemaValidator,
  ografManifestSchema,
} from '@bajaovrlay/graphics-kit/ografSchemaValidator.testSupport';
import { screenCorners } from '@bajaovrlay/graphics-kit/screenCornerPosition';
import { plainSponsorRollEntranceMs } from '@bajaovrlay/shared/sponsorRollPass';
import { describe, expect, it } from 'vitest';

import plainRollManifest from '../sponsor-roll-plain.ograf.json';
import { sponsorRollPlainDefaultCorner } from './sponsorRollPlainModel.js';

/**
 * Reads a duration token (`--motion-in: 400ms;`) from the text of the theme's tokens.css.
 * Throws when the token is not there: a manifest checked against a missing token would pass
 * for the wrong reason.
 */
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

describe('sponsor-roll-plain.ograf.json', () => {
  it('passes the official OGraf v1 manifest schema', () => {
    // Arrange: a validator built from the vendored OGraf v1 schemas.
    const validator = createOGrafSchemaValidator();
    const validateManifest = validator.compile(ografManifestSchema);

    // Act: validate the manifest exactly as it is on disk.
    const isManifestValid = validateManifest(plainRollManifest);

    // Assert: it passes; on failure, the schema errors are shown in the message.
    expect(
      isManifestValid,
      `the manifest must pass the OGraf v1 schema: ${validator.errorsText(validateManifest.errors)}`,
    ).toBe(true);
  });

  it('declares its id, name, render modes, one step, its layer, category and auto-out rule', () => {
    // Arrange: nothing to set up; the manifest is read from disk.

    // Act: pick out the fixed settings.
    const fixedSettings = {
      id: plainRollManifest.id,
      name: plainRollManifest.name,
      main: plainRollManifest.main,
      supportsRealTime: plainRollManifest.supportsRealTime,
      supportsNonRealTime: plainRollManifest.supportsNonRealTime,
      stepCount: plainRollManifest.stepCount,
      v_baja: plainRollManifest.v_baja,
    };

    // Assert: on the bug's layer, and taken off by the server when its pass ends.
    expect(fixedSettings, 'the manifest must declare its fixed settings').toEqual({
      id: 'baja-sponsor-roll-plain',
      name: 'Patrocinadores (simples)',
      main: 'sponsor-roll-plain.js',
      supportsRealTime: true,
      supportsNonRealTime: false,
      stepCount: 1,
      v_baja: {
        defaultLayerId: 'bug',
        category: 'sponsor',
        autoOutRule: 'onePlainSponsorRollPass',
      },
    });
  });

  it('plays in for shared’s entrance, the theme’s --motion-in, and out for --motion-out', () => {
    // Arrange: the two durations as the theme writes them.
    const motionInMs = readDurationTokenInMilliseconds('--motion-in');
    const motionOutMs = readDurationTokenInMilliseconds('--motion-out');

    // Act: read what the manifest promises a renderer.
    const declaredDurations = plainRollManifest.actionDurations;

    // Assert: the entrance the server counts the pass from is the fade the graphic plays.
    expect(motionInMs, 'the pass’s entrance must be the theme’s fade in').toBe(
      plainSponsorRollEntranceMs,
    );
    expect(declaredDurations, 'the manifest durations must be the theme’s motion tokens').toEqual([
      { type: 'playAction', duration: motionInMs },
      { type: 'stopAction', duration: motionOutMs },
    ]);
  });

  it('requires the sponsors, each by its name and level only, and refuses unknown fields', () => {
    // Arrange: the sponsors field as the manifest describes it.
    const sponsorsField = plainRollManifest.schema.properties.sponsors;

    // Act: read what is required of the data and of one sponsor.
    const requirements = {
      ofTheData: plainRollManifest.schema.required,
      ofOneSponsor: sponsorsField.items.required,
      allowsUnknownFields: plainRollManifest.schema.additionalProperties,
    };

    // Assert: a sponsor with no logo is accepted (and skipped); a typo is refused.
    expect(requirements, 'the sponsors, each with its name and level').toEqual({
      ofTheData: ['sponsors'],
      ofOneSponsor: ['name', 'level'],
      allowsUnknownFields: false,
    });
  });

  it('offers the kit’s four corners as a select, top-left by default', () => {
    // Arrange: the corner field as the manifest describes it.
    const cornerField = plainRollManifest.schema.properties.corner;

    // Act: read its options, how the form draws them, and the default.
    const cornerOptions = {
      values: cornerField.enum,
      formControl: cornerField.gddType,
      default: cornerField.default,
    };

    // Assert: the same four corners as the kit, in a select, the model's default first.
    expect(cornerOptions, 'the form must offer the four corners, top-left first').toEqual({
      values: [...screenCorners],
      formControl: 'select',
      default: sponsorRollPlainDefaultCorner,
    });
  });
});
