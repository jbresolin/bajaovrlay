// @vitest-environment node
/**
 * The OGraf manifest, logo-bug.ograf.json (packages/graphics/logo-bug)
 *
 * What this module is for:
 *   A renderer finds and drives an OGraf graphic through its manifest: the id, the module
 *   to load, the render modes it supports, how long its animations take and the JSON
 *   Schema of its data, which the control page also builds the item form from.
 *
 * What these tests prove:
 *   - The manifest passes the official OGraf v1 manifest JSON Schema (vendored in the kit,
 *     so this runs offline).
 *   - The settings: id, name, main, real-time only, one step; the "Logo do canal" layer
 *     as its default layer, in the brand category.
 *   - The play and stop durations are the theme's `--motion-in` and `--motion-out`, read
 *     from the text of packages/theme/ardosia/tokens.css.
 *   - The image is required, so the item form refuses a take with no image, in pt-BR; it
 *     is the one image field (`v_baja.role: "imageUrl"`, the media picker).
 *   - The corner is a select of the kit's four corners with pt-BR names; the corner, the
 *     height and the opacity start at the model's defaults, within the model's limits.
 *
 * What these tests deliberately do not cover:
 *   - That the data schema and the Zod validation accept and refuse the same payloads;
 *     logoBugManifestDataAgreement.test.ts covers that.
 *   - That a real renderer can load the module named in "main"; e2e/logoBugLifecycle.e2e.ts.
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

import logoBugManifest from '../logo-bug.ograf.json';
import { logoBugDefaults, logoBugLimits } from './logoBugModel.js';

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

describe('logo-bug.ograf.json', () => {
  it('passes the official OGraf v1 manifest schema', () => {
    // Arrange: a validator built from the vendored OGraf v1 schemas.
    const validator = createOGrafSchemaValidator();
    const validateManifest = validator.compile(ografManifestSchema);

    // Act: validate the manifest exactly as it is on disk.
    const isManifestValid = validateManifest(logoBugManifest);

    // Assert: it passes; on failure, the schema errors are shown in the message.
    expect(
      isManifestValid,
      `the manifest must pass the OGraf v1 schema: ${validator.errorsText(validateManifest.errors)}`,
    ).toBe(true);
  });

  it('declares its id, name, render modes, one step, its layer and its category', () => {
    // Arrange: nothing to set up; the manifest is read from disk.

    // Act: pick out the fixed settings.
    const fixedSettings = {
      id: logoBugManifest.id,
      name: logoBugManifest.name,
      main: logoBugManifest.main,
      supportsRealTime: logoBugManifest.supportsRealTime,
      supportsNonRealTime: logoBugManifest.supportsNonRealTime,
      stepCount: logoBugManifest.stepCount,
      v_baja: logoBugManifest.v_baja,
    };

    // Assert: "main" names the built module, and the server offers it on its own layer.
    expect(fixedSettings, 'the manifest must declare its fixed settings').toEqual({
      id: 'baja-logo-bug',
      name: 'Logo do canal',
      main: 'logo-bug.js',
      supportsRealTime: true,
      supportsNonRealTime: false,
      stepCount: 1,
      v_baja: { defaultLayerId: 'channel-logo', category: 'brand' },
    });
  });

  it('declares the play and stop lengths the theme sets in --motion-in and --motion-out', () => {
    // Arrange: the two durations as packages/theme/ardosia/tokens.css writes them.
    const motionInMs = readDurationTokenInMilliseconds('--motion-in');
    const motionOutMs = readDurationTokenInMilliseconds('--motion-out');

    // Act: read what the manifest promises a renderer.
    const declaredDurations = logoBugManifest.actionDurations;

    // Assert: the manifest says exactly what the theme's tokens say.
    expect(declaredDurations, 'the manifest durations must be the theme’s motion tokens').toEqual([
      { type: 'playAction', duration: motionInMs },
      { type: 'stopAction', duration: motionOutMs },
    ]);
  });

  it('requires the image, the one image field, and refuses fields it does not know', () => {
    // Arrange: the image field as the manifest describes it.
    const imageField = logoBugManifest.schema.properties.logoUrl;

    // Act: read the required list, the image's role and whether unknown fields pass.
    const requiredFields = logoBugManifest.schema.required;
    const imageRole = imageField.v_baja.role;
    const allowsUnknownFields = logoBugManifest.schema.additionalProperties;

    // Assert: a take with no image is refused by the form; the picker is the media one.
    expect(requiredFields, 'the image, and only it, must be required').toEqual(['logoUrl']);
    expect(
      { title: imageField.title, type: imageField.type, role: imageRole },
      'the image must be a text field with the media picker, titled in pt-BR',
    ).toEqual({ title: 'Imagem', type: 'string', role: 'imageUrl' });
    expect(allowsUnknownFields, 'a field the graphic does not know must be refused').toBe(false);
  });

  it('offers the kit’s four corners with pt-BR names, starting at the model’s default', () => {
    // Arrange: the corner field as the manifest describes it.
    const cornerField = logoBugManifest.schema.properties.corner;

    // Act: read its options, their names and its default.
    const cornerOptions = { values: cornerField.enum, names: cornerField.gddOptions.labels };

    // Assert: the same four corners as the kit, in the same order, each named in pt-BR.
    expect(cornerOptions, 'the form must offer the four corners by name').toEqual({
      values: [...screenCorners],
      names: {
        'top-left': 'Superior esquerdo',
        'top-right': 'Superior direito',
        'bottom-left': 'Inferior esquerdo',
        'bottom-right': 'Inferior direito',
      },
    });
    expect(cornerField.default, 'a new item starts in the model’s default corner').toBe(
      logoBugDefaults.corner,
    );
  });

  it('starts the height and the opacity at the model’s defaults, within its limits', () => {
    // Arrange: the two number fields as the manifest describes them.
    const heightField = logoBugManifest.schema.properties.heightPx;
    const opacityField = logoBugManifest.schema.properties.opacityPercent;

    // Act: read their types, limits and defaults.
    const numberFields = {
      height: [heightField.type, heightField.minimum, heightField.maximum, heightField.default],
      opacity: [
        opacityField.type,
        opacityField.minimum,
        opacityField.maximum,
        opacityField.default,
      ],
    };

    // Assert: whole numbers, the same limits and defaults the graphic checks with.
    expect(numberFields, 'the form must offer the limits and defaults the graphic uses').toEqual({
      height: [
        'integer',
        logoBugLimits.smallestHeightPx,
        logoBugLimits.largestHeightPx,
        logoBugDefaults.heightPx,
      ],
      opacity: [
        'integer',
        logoBugLimits.faintestOpacityPercent,
        logoBugLimits.fullOpacityPercent,
        logoBugDefaults.opacityPercent,
      ],
    });
  });
});
