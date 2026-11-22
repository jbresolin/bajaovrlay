// @vitest-environment node
/**
 * The OGraf manifest, image.ograf.json (packages/graphics/image)
 *
 * What this module is for:
 *   A renderer finds and drives an OGraf graphic through its manifest: the id, the module
 *   to load, the render modes it supports, how long its animations take and the JSON
 *   Schema of its data, which the control page also builds the item form from.
 *
 * What these tests prove:
 *   - The manifest passes the official OGraf v1 manifest JSON Schema (vendored in the kit,
 *     so this runs offline).
 *   - The settings: id, name "Imagem", main, real-time only, one step; the "Imagem" layer
 *     as its default layer, in the brand category.
 *   - The play and stop durations are the theme's `--motion-in` and `--motion-out`, read
 *     from the text of packages/theme/ardosia/tokens.css.
 *   - The image is required and is the one image field (`v_baja.role: "imageUrl"`, the
 *     media picker); every field has the pt-BR title the brief names, in the form's order.
 *   - "Posição" offers the model's nine anchors as a select, each named in pt-BR as the
 *     preview's buttons name it; "Entrada" offers fade and none.
 *   - Every number field starts at the model's default, within the model's limits; the
 *     height has no default, so a new item leaves it to the file.
 *   - "Fundo" is an optional "#rrggbb" text with the model's own pattern, marked
 *     `gddType: "color-rrggbb"`, with no default (no background).
 *
 * What these tests deliberately do not cover:
 *   - That the data schema and the Zod validation accept and refuse the same payloads;
 *     imageManifestDataAgreement.test.ts covers that.
 *   - That a real renderer can load the module named in "main"; e2e/imageLifecycle.e2e.ts.
 *   - The page: this file runs in plain Node (the pragma on line 1).
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import {
  createOGrafSchemaValidator,
  ografManifestSchema,
} from '@bajaovrlay/graphics-kit/ografSchemaValidator.testSupport';
import { describe, expect, it } from 'vitest';

import imageManifest from '../image.ograf.json';
import { imageAnchors } from './imageBoxPosition.js';
import {
  backgroundColorPattern,
  imageDefaults,
  imageEntrances,
  imageLimits,
} from './imageModel.js';
import { ptBR } from './ptBR.js';

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

const fieldsOfTheSchema = imageManifest.schema.properties;

describe('image.ograf.json', () => {
  it('passes the official OGraf v1 manifest schema', () => {
    // Arrange: a validator built from the vendored OGraf v1 schemas.
    const validator = createOGrafSchemaValidator();
    const validateManifest = validator.compile(ografManifestSchema);

    // Act: validate the manifest exactly as it is on disk.
    const isManifestValid = validateManifest(imageManifest);

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
      id: imageManifest.id,
      name: imageManifest.name,
      main: imageManifest.main,
      supportsRealTime: imageManifest.supportsRealTime,
      supportsNonRealTime: imageManifest.supportsNonRealTime,
      stepCount: imageManifest.stepCount,
      v_baja: imageManifest.v_baja,
    };

    // Assert: "main" names the built module, and the server offers it on its own layer.
    expect(fixedSettings, 'the manifest must declare its fixed settings').toEqual({
      id: 'baja-image',
      name: 'Imagem',
      main: 'image.js',
      supportsRealTime: true,
      supportsNonRealTime: false,
      stepCount: 1,
      v_baja: { defaultLayerId: 'image', category: 'brand' },
    });
  });

  it('declares the play and stop lengths the theme sets in --motion-in and --motion-out', () => {
    // Arrange: the two durations as packages/theme/ardosia/tokens.css writes them.
    const motionInMs = readDurationTokenInMilliseconds('--motion-in');
    const motionOutMs = readDurationTokenInMilliseconds('--motion-out');

    // Act: read what the manifest promises a renderer.
    const declaredDurations = imageManifest.actionDurations;

    // Assert: the manifest says exactly what the theme's tokens say.
    expect(declaredDurations, 'the manifest durations must be the theme’s motion tokens').toEqual([
      { type: 'playAction', duration: motionInMs },
      { type: 'stopAction', duration: motionOutMs },
    ]);
  });

  it('titles every field in pt-BR, in the order the form shows them', () => {
    // Arrange: nothing to set up; the manifest is read from disk.

    // Act: list each field's key and title.
    const keysAndTitles = Object.entries(fieldsOfTheSchema).map(([key, field]) => [
      key,
      field.title,
    ]);

    // Assert: the brief's names, the image first.
    expect(keysAndTitles, 'every field must carry the brief’s pt-BR title').toEqual([
      ['imageUrl', 'Imagem'],
      ['widthPx', 'Largura (px)'],
      ['heightPx', 'Altura (px)'],
      ['position', 'Posição'],
      ['offsetXPx', 'Deslocamento X (px)'],
      ['offsetYPx', 'Deslocamento Y (px)'],
      ['opacityPercent', 'Opacidade (%)'],
      ['entrance', 'Entrada'],
      ['backgroundColor', 'Fundo'],
      ['marginPx', 'Margem (px)'],
    ]);
  });

  it('requires the image, the one image field, and refuses fields it does not know', () => {
    // Arrange: the image field as the manifest describes it.
    const imageField = fieldsOfTheSchema.imageUrl;

    // Act: read the required list, the image's role and whether unknown fields pass.
    const requiredFields = imageManifest.schema.required;
    const allowsUnknownFields = imageManifest.schema.additionalProperties;

    // Assert: a take with no image is refused by the form; the picker is the media one.
    expect(requiredFields, 'the image, and only it, must be required').toEqual(['imageUrl']);
    expect(
      { type: imageField.type, role: imageField.v_baja.role, minLength: imageField.minLength },
      'the image must be a non-empty text field with the media picker',
    ).toEqual({ type: 'string', role: 'imageUrl', minLength: 1 });
    expect(allowsUnknownFields, 'a field the graphic does not know must be refused').toBe(false);
  });

  it('offers the nine positions as a select, named as the preview names them, centred by default', () => {
    // Arrange: the position field as the manifest describes it.
    const positionField = fieldsOfTheSchema.position;

    // Act: read its options, how the form draws them and their names.
    const positionOptions = {
      values: positionField.enum,
      formControl: positionField.gddType,
      names: positionField.gddOptions.labels,
    };

    // Assert: the model's nine anchors, in its order, named in pt-BR, default the centre.
    expect(positionOptions, 'the form must offer the nine positions in a select').toEqual({
      values: [...imageAnchors],
      formControl: 'select',
      names: ptBR.preview.anchorNames,
    });
    expect(positionField.default, 'a new item starts centred').toBe(imageDefaults.position);
  });

  it('offers a fade or no entrance, a fade by default', () => {
    // Arrange: the entrance field as the manifest describes it.
    const entranceField = fieldsOfTheSchema.entrance;

    // Act: read its options and default.
    const entranceOptions = {
      values: entranceField.enum,
      formControl: entranceField.gddType,
      defaultValue: entranceField.default,
    };

    // Assert: the model's two entrances, the fade first and by default.
    expect(entranceOptions, 'the form must offer the two entrances, fade by default').toEqual({
      values: [...imageEntrances],
      formControl: 'select',
      defaultValue: imageDefaults.entrance,
    });
  });

  it('starts every number at the model’s default, within its limits, and leaves the height empty', () => {
    // Arrange: the number fields as the manifest describes them.
    const numberFieldsAsWritten = {
      width: fieldsOfTheSchema.widthPx,
      offsetX: fieldsOfTheSchema.offsetXPx,
      offsetY: fieldsOfTheSchema.offsetYPx,
      opacity: fieldsOfTheSchema.opacityPercent,
      margin: fieldsOfTheSchema.marginPx,
    };
    const heightField = fieldsOfTheSchema.heightPx;

    // Act: read each one's type, limits and default.
    const numberFields = Object.fromEntries(
      Object.entries(numberFieldsAsWritten).map(([name, field]) => [
        name,
        [field.type, field.minimum, field.maximum, field.default],
      ]),
    );
    const height = [heightField.type, heightField.minimum, heightField.maximum];

    // Assert: whole numbers, the limits and defaults the graphic checks with.
    expect(numberFields, 'the form must offer the limits and defaults the graphic uses').toEqual({
      width: ['integer', imageLimits.smallestSizePx, imageLimits.largestWidthPx, 480],
      offsetX: ['integer', -imageLimits.largestOffsetXPx, imageLimits.largestOffsetXPx, 0],
      offsetY: ['integer', -imageLimits.largestOffsetYPx, imageLimits.largestOffsetYPx, 0],
      opacity: [
        'integer',
        imageLimits.faintestOpacityPercent,
        imageLimits.fullOpacityPercent,
        imageDefaults.opacityPercent,
      ],
      margin: ['integer', 0, imageLimits.largestMarginPx, imageDefaults.marginPx],
    });
    expect(height, 'the height has the model’s limits').toEqual([
      'integer',
      imageLimits.smallestSizePx,
      imageLimits.largestHeightPx,
    ]);
    expect(
      Object.hasOwn(heightField, 'default'),
      'the height must have no default: a new item leaves it to the file',
    ).toBe(false);
  });

  it('declares the background as an optional #rrggbb colour with no default', () => {
    // Arrange: the background field as the manifest describes it.
    const backgroundField = fieldsOfTheSchema.backgroundColor;

    // Act: read its type, pattern, GDD type and whether it has a default.
    const backgroundAsWritten = {
      type: backgroundField.type,
      pattern: backgroundField.pattern,
      formControl: backgroundField.gddType,
      hasDefault: Object.hasOwn(backgroundField, 'default'),
    };

    // Assert: the model's own pattern, the GDD colour type, and no background by default.
    expect(backgroundAsWritten, 'the background must be an optional #rrggbb colour').toEqual({
      type: 'string',
      pattern: backgroundColorPattern.source,
      formControl: 'color-rrggbb',
      hasDefault: false,
    });
  });
});
