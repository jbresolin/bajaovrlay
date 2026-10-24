// @vitest-environment node
/**
 * The OGraf manifest, notice.ograf.json (packages/graphics/notice)
 *
 * What this module is for:
 *   A renderer finds and drives an OGraf graphic through its manifest: the id, the
 *   module to load, the render modes it supports, how long its animations take and the
 *   JSON Schema of its data (which the control page also uses to build the item form).
 *
 * What these tests prove:
 *   - The manifest passes the official OGraf v1 manifest JSON Schema (vendored in
 *     ograf-schema/, so this runs offline), and a manifest with a required field removed
 *     fails it, so the check has teeth.
 *   - The settings the brief fixes: id, name, main, real-time only, one step.
 *   - The manifest tells the BajaOvrLay server, in its vendor field `v_baja`, that the
 *     notice goes on the notice layer and in the notice category, with no update rule.
 *   - The play and stop durations in the manifest are the theme's `--motion-in` and
 *     `--motion-out`, read from the text of packages/theme/ardosia/tokens.css: the
 *     timelines take their lengths from those tokens at run time, and the manifest, which
 *     is static JSON, must promise a renderer the same numbers.
 *   - Only the variant and the car are required; every data field has a pt-BR title, and
 *     the two selects (variant, kind of notice) have pt-BR option labels.
 *
 * What these tests deliberately do not cover:
 *   - That the data schema and the graphic's Zod validation accept and refuse the same
 *     payloads; noticeManifestDataAgreement.test.ts runs the same payloads through both.
 *   - That a real renderer can load the module named in "main"; the Playwright test
 *     e2e/noticeLifecycle.e2e.ts loads it from dist/ the way a renderer does.
 *   - The page: this file runs in plain Node (the pragma on line 1) since it draws
 *     nothing and reads the token file from disk, which Vitest's page environment would
 *     hand over as an empty stylesheet.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import {
  createOGrafSchemaValidator,
  ografManifestSchema,
} from '@bajaovrlay/graphics-kit/ografSchemaValidator';
import { describe, expect, it } from 'vitest';

import noticeManifest from '../notice.ograf.json';

/**
 * The text of packages/theme/ardosia/tokens.css, found through the theme package's own
 * exports (never by a path into another package's folder).
 */
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

describe('notice.ograf.json against the OGraf v1 manifest schema', () => {
  it('passes the official schema', () => {
    // Arrange: a validator built from the vendored OGraf v1 schemas.
    const validator = createOGrafSchemaValidator();
    const validateManifest = validator.compile(ografManifestSchema);

    // Act: validate the manifest exactly as it is on disk.
    const isManifestValid = validateManifest(noticeManifest);

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
    const manifestWithoutMain: Record<string, unknown> = { ...noticeManifest };
    delete manifestWithoutMain.main;

    // Act: validate the broken copy.
    const isManifestValid = validateManifest(manifestWithoutMain);

    // Assert: the schema rejects it.
    expect(isManifestValid, 'a manifest without "main" must fail the OGraf schema').toBe(false);
  });
});

describe('notice.ograf.json settings', () => {
  it('declares the id, name, render modes and step count the brief fixes', () => {
    // Arrange: nothing to set up; the manifest is read from disk.

    // Act: pick out the fixed settings.
    const fixedSettings = {
      id: noticeManifest.id,
      name: noticeManifest.name,
      main: noticeManifest.main,
      supportsRealTime: noticeManifest.supportsRealTime,
      supportsNonRealTime: noticeManifest.supportsNonRealTime,
      stepCount: noticeManifest.stepCount,
    };

    // Assert: they match the brief, and "main" names the built module in dist/.
    expect(fixedSettings, 'the manifest must declare the settings fixed in the brief').toEqual({
      id: 'baja-notice',
      name: 'Aviso',
      main: 'notice.js',
      supportsRealTime: true,
      supportsNonRealTime: false,
      stepCount: 1,
    });
  });

  it('declares the notice layer and the notice category in the v_baja vendor field', () => {
    // Arrange: nothing to set up; the manifest is read from disk.

    // Act: read BajaOvrLay's own field, which OGraf allows because its name starts with v_.
    const bajaVendorFields = noticeManifest.v_baja;

    // Assert: the server reads the default layer and the category from it; a notice has
    // no clock to carry forward, so no update rule.
    expect(
      bajaVendorFields,
      'the notice must ask for the notice layer and the notice category, with no update rule',
    ).toEqual({ defaultLayerId: 'notice', category: 'notice' });
  });

  it('declares the play and stop lengths the theme sets in --motion-in and --motion-out', () => {
    // Arrange: the two durations as packages/theme/ardosia/tokens.css writes them. The
    // timelines read the same tokens from the page at run time (noticeAnimations.ts), so
    // the manifest tells the truth only while it matches the file.
    const motionInMs = readDurationTokenInMilliseconds('--motion-in');
    const motionOutMs = readDurationTokenInMilliseconds('--motion-out');

    // Act: read what the manifest promises a renderer.
    const declaredDurations = noticeManifest.actionDurations;

    // Assert: the manifest says exactly what the theme's tokens say.
    expect(declaredDurations, 'the manifest durations must be the theme’s motion tokens').toEqual([
      { type: 'playAction', duration: motionInMs },
      { type: 'stopAction', duration: motionOutMs },
    ]);
  });

  it('requires only the variant and the car number', () => {
    // Arrange: nothing to set up; the manifest is read from disk.

    // Act: read the required list and whether unknown fields are allowed.
    const requiredFields = noticeManifest.schema.required;
    const allowsUnknownFields = noticeManifest.schema.additionalProperties;

    // Assert: every other field gets "limpar" in the form and may be left out.
    expect(requiredFields, 'only the variant and the car may be required').toEqual([
      'variant',
      'carNumber',
    ]);
    expect(allowsUnknownFields, 'a field the graphic does not know must be refused').toBe(false);
  });

  it('gives every data field a pt-BR title', () => {
    // Arrange: the data fields as the manifest describes them.
    const dataFields = Object.entries(noticeManifest.schema.properties);

    // Act: collect each field's title.
    const titlesByField = Object.fromEntries(
      dataFields.map(([fieldName, field]) => [fieldName, field.title]),
    );

    // Assert: each field has the pt-BR title an operator form will show.
    expect(titlesByField, 'every data field must carry a pt-BR title').toEqual({
      variant: 'Variante',
      carNumber: 'Carro',
      teamName: 'Equipe',
      schoolName: 'Escola',
      lapNumber: 'Volta',
      lapTimeText: 'Tempo da volta',
      noticeKind: 'Tipo de aviso',
      reason: 'Motivo',
      penaltyText: 'Punição',
    });
  });

  it('labels the options of the variant and of the kind of notice in pt-BR', () => {
    // Arrange: the two select fields of the form.
    const variantField = noticeManifest.schema.properties.variant;
    const noticeKindField = noticeManifest.schema.properties.noticeKind;

    // Act: read their values and option labels.
    const selects = {
      variant: { values: variantField.enum, labels: variantField.gddOptions.labels },
      noticeKind: { values: noticeKindField.enum, labels: noticeKindField.gddOptions.labels },
    };

    // Assert: every value the graphic knows has its pt-BR label.
    expect(selects, 'each option must carry its pt-BR label').toEqual({
      variant: {
        values: ['fastestLap', 'penalty'],
        labels: { fastestLap: 'Volta mais rápida', penalty: 'Penalidade ou aviso' },
      },
      noticeKind: {
        values: ['penalty', 'warning', 'incident', 'notice'],
        labels: {
          penalty: 'Penalidade',
          warning: 'Advertência',
          incident: 'Incidente',
          notice: 'Aviso',
        },
      },
    });
  });
});
