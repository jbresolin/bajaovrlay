// @vitest-environment node
/**
 * The OGraf manifest, qr-card.ograf.json (packages/graphics/qr-card)
 *
 * What this module is for:
 *   A renderer finds and drives an OGraf graphic through its manifest: the id, the module
 *   to load, the render modes it supports, how long its animations take and the JSON Schema
 *   of its data (which the control page also uses to build the item form).
 *
 * What these tests prove:
 *   - The manifest passes the official OGraf v1 manifest JSON Schema (vendored in the kit,
 *     so this runs offline), and a manifest with a required field removed fails it.
 *   - The settings the brief fixes: id, name, main, real-time only, one step.
 *   - In its vendor field `v_baja` the card asks for the lower-third layer, in the lower
 *     third's category, with no update rule.
 *   - The play and stop durations are the theme's `--motion-in` and `--motion-out`, read
 *     from the text of packages/theme/ardosia/tokens.css.
 *   - Both fields are required single-line texts with pt-BR titles that no editor field
 *     uses; the address carries the item editor's limits: at least one character, at most
 *     106, printable ASCII with no space.
 *
 * What these tests deliberately do not cover:
 *   - Why 106; qrCodeEncoding.test.ts derives it from the encoder and the box.
 *   - That the data schema and the graphic's validation agree on payloads;
 *     qrCardManifestDataAgreement.test.ts runs the same payloads through both.
 *   - The page: this file runs in plain Node (the pragma on line 1) since it draws
 *     nothing and reads the token file from disk.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import {
  createOGrafSchemaValidator,
  ografManifestSchema,
} from '@bajaovrlay/graphics-kit/ografSchemaValidator.testSupport';
import { describe, expect, it } from 'vitest';

import qrCardManifest from '../qr-card.ograf.json';

/**
 * Reads a duration token (`--motion-in: 400ms;`) from the theme's tokens.css, found through
 * the theme package's own exports, in milliseconds. Throws when the token is not there: a
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

describe('qr-card.ograf.json against the OGraf v1 manifest schema', () => {
  it('passes the official schema', () => {
    // Arrange: a validator built from the vendored OGraf v1 schemas.
    const validator = createOGrafSchemaValidator();
    const validateManifest = validator.compile(ografManifestSchema);

    // Act: validate the manifest exactly as it is on disk.
    const isManifestValid = validateManifest(qrCardManifest);

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
    const manifestWithoutMain: Record<string, unknown> = { ...qrCardManifest };
    delete manifestWithoutMain.main;

    // Act: validate the broken copy.
    const isManifestValid = validateManifest(manifestWithoutMain);

    // Assert: the schema rejects it.
    expect(isManifestValid, 'a manifest without "main" must fail the OGraf schema').toBe(false);
  });
});

describe('qr-card.ograf.json settings', () => {
  it('declares the id, name, render modes and step count the brief fixes', () => {
    // Arrange: nothing to set up; the manifest is read from disk.

    // Act: pick out the fixed settings.
    const fixedSettings = {
      id: qrCardManifest.id,
      name: qrCardManifest.name,
      main: qrCardManifest.main,
      supportsRealTime: qrCardManifest.supportsRealTime,
      supportsNonRealTime: qrCardManifest.supportsNonRealTime,
      stepCount: qrCardManifest.stepCount,
    };

    // Assert: they match the brief, and "main" names the built module in dist/.
    expect(fixedSettings, 'the manifest must declare the settings fixed in the brief').toEqual({
      id: 'baja-qr-card',
      name: 'Cartão de QR',
      main: 'qr-card.js',
      supportsRealTime: true,
      supportsNonRealTime: false,
      stepCount: 1,
    });
  });

  it('declares the lower-third layer and category in the v_baja vendor field', () => {
    // Arrange: nothing to set up; the manifest is read from disk.

    // Act: read BajaOvrLay's own field, which OGraf allows because its name starts with v_.
    const bajaVendorFields = qrCardManifest.v_baja;

    // Assert: the server reads the default layer and the category from it; no update rule.
    expect(bajaVendorFields, 'the QR card must ask for the lower-third layer').toEqual({
      defaultLayerId: 'lower-third',
      category: 'lowerThird',
    });
  });

  it('declares the play and stop lengths the theme sets in --motion-in and --motion-out', () => {
    // Arrange: the two durations as packages/theme/ardosia/tokens.css writes them.
    const motionInMs = readDurationTokenInMilliseconds('--motion-in');
    const motionOutMs = readDurationTokenInMilliseconds('--motion-out');

    // Act: read what the manifest promises a renderer.
    const declaredDurations = qrCardManifest.actionDurations;

    // Assert: the manifest says exactly what the theme's tokens say.
    expect(declaredDurations, 'the manifest durations must be the theme’s motion tokens').toEqual([
      { type: 'playAction', duration: motionInMs },
      { type: 'stopAction', duration: motionOutMs },
    ]);
  });

  it('requires both fields, single-line texts with their own pt-BR titles', () => {
    // Arrange: the data fields as the manifest describes them.
    const fields = qrCardManifest.schema.properties;

    // Act: collect each field's title, type and text control, and the required list.
    const fieldSummaries = Object.fromEntries(
      Object.entries(fields).map(([fieldName, field]) => [
        fieldName,
        { title: field.title, type: field.type, gddType: field.gddType },
      ]),
    );

    // Assert: the call and the address, both required, refusing unknown fields; the
    // address's title is not the item editor's "Rótulo" or any other of its fields.
    expect(fieldSummaries, 'the two fields must be single-line texts with pt-BR titles').toEqual({
      callToAction: { title: 'Chamada', type: 'string', gddType: 'single-line' },
      address: { title: 'Endereço do QR', type: 'string', gddType: 'single-line' },
    });
    expect(qrCardManifest.schema.required, 'both fields must be required').toEqual([
      'callToAction',
      'address',
    ]);
    expect(
      qrCardManifest.schema.additionalProperties,
      'a field the graphic does not know must be refused',
    ).toBe(false);
  });

  it('gives the address the item editor’s limits: 1 to 106 characters, ASCII with no space', () => {
    // Arrange: nothing to set up; the manifest is read from disk.

    // Act: read the address's limits.
    const { minLength, maxLength, pattern } = qrCardManifest.schema.properties.address;

    // Assert: the editor refuses an empty or too long address while it is typed; the server's
    // check refuses a space or an accent.
    expect(
      { minLength, maxLength, pattern },
      'the address must carry the limits the code can hold',
    ).toEqual({ minLength: 1, maxLength: 106, pattern: '^[!-~]*$' });
  });
});
