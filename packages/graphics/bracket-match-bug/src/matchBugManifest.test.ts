// @vitest-environment node
/**
 * The OGraf manifest, bracket-match-bug.ograf.json (packages/graphics/bracket-match-bug)
 *
 * What this module is for:
 *   The manifest is what the server and the item editor read about the match bug: its id,
 *   its layer, how long its motions last, and its data schema, from which the item form is
 *   drawn and every take is checked (BAJAOVRLAY-65).
 *
 * What these tests prove:
 *   - It passes the official OGraf v1 manifest schema.
 *   - It declares its id, one step, its own seeded layer "Partida da chave" and its
 *     category; the play and stop lengths are the theme's --motion-in and --motion-out.
 *   - No field is required: an empty "agora" delivers nothing and the take must go on
 *     (the bug draws nothing); a field the graphic does not know is refused.
 *   - The corner is the kit's four corners in a select, starting top-left, the model's
 *     default.
 *
 * What these tests deliberately do not cover:
 *   - That the data schema and the Zod validation accept and refuse the same payloads;
 *     matchBugManifestDataAgreement.test.ts covers that.
 *   - The page: this file runs in plain Node (the pragma on line 1).
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import {
  createOGrafSchemaValidator,
  ografManifestSchema,
} from '@bajaovrlay/graphics-kit/ografSchemaValidator.testSupport';
import { screenCorners } from '@bajaovrlay/graphics-kit/screenCornerPosition';
import { describe, expect, it } from 'vitest';

import matchBugManifest from '../bracket-match-bug.ograf.json';
import { matchBugDefaultCorner } from './matchBugModel.js';

/**
 * Reads a duration token (`--motion-in: 400ms;`) from the text of the theme's tokens.css,
 * found through the theme package's exports. Throws when the token is not there: a
 * manifest checked against a missing token would pass for the wrong reason.
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

describe('bracket-match-bug.ograf.json', () => {
  it('passes the official OGraf v1 manifest schema', () => {
    // Arrange: a validator built from the vendored OGraf v1 schemas.
    const validator = createOGrafSchemaValidator();
    const validateManifest = validator.compile(ografManifestSchema);

    // Act: validate the manifest exactly as it is on disk.
    const isManifestValid = validateManifest(matchBugManifest);

    // Assert: it passes; on failure, the schema errors are shown in the message.
    expect(
      isManifestValid,
      `the manifest must pass the OGraf v1 schema: ${validator.errorsText(validateManifest.errors)}`,
    ).toBe(true);
  });

  it('declares its id, name, render modes, one step, its own layer and its category', () => {
    // Arrange: nothing to set up; the manifest is read from disk.

    // Act: pick out the fixed settings.
    const fixedSettings = {
      id: matchBugManifest.id,
      name: matchBugManifest.name,
      main: matchBugManifest.main,
      supportsRealTime: matchBugManifest.supportsRealTime,
      supportsNonRealTime: matchBugManifest.supportsNonRealTime,
      stepCount: matchBugManifest.stepCount,
      v_baja: matchBugManifest.v_baja,
    };

    // Assert: "main" names the built module, and the server offers it on its own layer.
    expect(fixedSettings, 'the manifest must declare its fixed settings').toEqual({
      id: 'baja-bracket-match-bug',
      name: 'Partida da chave',
      main: 'bracket-match-bug.js',
      supportsRealTime: true,
      supportsNonRealTime: false,
      stepCount: 1,
      v_baja: { defaultLayerId: 'bracket-match', category: 'standings' },
    });
  });

  it('declares the play and stop lengths the theme sets in --motion-in and --motion-out', () => {
    // Arrange: the two durations as packages/theme/ardosia/tokens.css writes them.
    const motionInMs = readDurationTokenInMilliseconds('--motion-in');
    const motionOutMs = readDurationTokenInMilliseconds('--motion-out');

    // Act: read what the manifest promises a renderer.
    const declaredDurations = matchBugManifest.actionDurations;

    // Assert: the manifest says exactly what the theme's tokens say.
    expect(declaredDurations, 'the manifest durations must be the theme’s motion tokens').toEqual([
      { type: 'playAction', duration: motionInMs },
      { type: 'stopAction', duration: motionOutMs },
    ]);
  });

  it('requires no field, and refuses fields it does not know', () => {
    // Arrange: nothing to set up; the manifest is read from disk.

    // Act: read the required list and whether unknown fields pass.
    const schema: { required?: unknown; additionalProperties: unknown } = matchBugManifest.schema;

    // Assert: an empty "agora" is a valid take that draws nothing.
    expect(schema.required, 'no field may be required: an empty slot sends none').toBeUndefined();
    expect(schema.additionalProperties, 'a field the graphic does not know must be refused').toBe(
      false,
    );
  });

  it('offers the kit’s four corners as a select, starting at the model’s default', () => {
    // Arrange: the corner field as the manifest describes it.
    const cornerField = matchBugManifest.schema.properties.corner;

    // Act: read its options and how the form draws them.
    const cornerOptions = { values: cornerField.enum, formControl: cornerField.gddType };

    // Assert: the same four corners as the kit, in the same order, in a select.
    expect(cornerOptions, 'the form must offer the four corners in a select').toEqual({
      values: [...screenCorners],
      formControl: 'select',
    });
    expect(cornerField.default, 'a new item starts in the model’s default corner').toBe(
      matchBugDefaultCorner,
    );
  });
});
