// @vitest-environment node
/**
 * The OGraf manifest, lower-third.ograf.json (packages/graphics/lower-third)
 *
 * What this module is for:
 *   A renderer finds and drives an OGraf graphic through its manifest: the id, the
 *   module to load, the render modes it supports, how long its animations take and the
 *   JSON Schema of its data (which the control page also uses to build the item form).
 *
 * What these tests prove:
 *   - The manifest passes the official OGraf v1 manifest JSON Schema (vendored in the
 *     kit, so this runs offline), and a manifest with a required field removed fails it,
 *     so the check has teeth.
 *   - The settings the brief fixes: id, name, main, real-time only, one step.
 *   - The manifest tells the BajaOvrLay server, in its vendor field `v_baja`, that the
 *     lower third goes on the lower-third layer and in the lowerThird category, with no
 *     update rule.
 *   - The play length is `--motion-in` + `--motion-lead` (the role pill starts a lead
 *     behind the name pill and then takes `--motion-in`) and the stop length is
 *     `--motion-out`, read from the text of packages/theme/ardosia/tokens.css: the
 *     timelines take their lengths from those tokens at run time, and the manifest, which
 *     is static JSON, must promise a renderer the same numbers.
 *   - Only the name is required; every data field has a pt-BR title, and each optional
 *     field's description says what happens when it is left out.
 *   - "Posição" (BAJAOVRLAY-85) is a dropdown of left, center and right labelled
 *     Esquerda, Centro and Direita, starting on Esquerda, with the same three values the
 *     graphic's own lowerThirdPositions knows.
 *
 * What these tests deliberately do not cover:
 *   - That the data schema and the graphic's Zod validation accept and refuse the same
 *     payloads; lowerThirdManifestDataAgreement.test.ts runs the same payloads through both.
 *   - That a real renderer can load the module named in "main"; the Playwright test
 *     e2e/lowerThirdLifecycle.e2e.ts loads it from dist/ the way a renderer does.
 *   - The page: this file runs in plain Node (the pragma on line 1) since it draws
 *     nothing and reads the token file from disk, which Vitest's page environment would
 *     hand over as an empty stylesheet.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import {
  createOGrafSchemaValidator,
  ografManifestSchema,
} from '@bajaovrlay/graphics-kit/ografSchemaValidator.testSupport';
import { describe, expect, it } from 'vitest';

import lowerThirdManifest from '../lower-third.ograf.json';
import { lowerThirdPositions } from './lowerThirdModel.js';

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

describe('lower-third.ograf.json against the OGraf v1 manifest schema', () => {
  it('passes the official schema', () => {
    // Arrange: a validator built from the vendored OGraf v1 schemas.
    const validator = createOGrafSchemaValidator();
    const validateManifest = validator.compile(ografManifestSchema);

    // Act: validate the manifest exactly as it is on disk.
    const isManifestValid = validateManifest(lowerThirdManifest);

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
    const manifestWithoutMain: Record<string, unknown> = { ...lowerThirdManifest };
    delete manifestWithoutMain.main;

    // Act: validate the broken copy.
    const isManifestValid = validateManifest(manifestWithoutMain);

    // Assert: the schema rejects it.
    expect(isManifestValid, 'a manifest without "main" must fail the OGraf schema').toBe(false);
  });
});

describe('lower-third.ograf.json settings', () => {
  it('declares the id, name, render modes and step count the brief fixes', () => {
    // Arrange: nothing to set up; the manifest is read from disk.

    // Act: pick out the fixed settings.
    const fixedSettings = {
      id: lowerThirdManifest.id,
      name: lowerThirdManifest.name,
      main: lowerThirdManifest.main,
      supportsRealTime: lowerThirdManifest.supportsRealTime,
      supportsNonRealTime: lowerThirdManifest.supportsNonRealTime,
      stepCount: lowerThirdManifest.stepCount,
    };

    // Assert: they match the brief, and "main" names the built module in dist/.
    expect(fixedSettings, 'the manifest must declare the settings fixed in the brief').toEqual({
      id: 'baja-lower-third',
      name: 'Tarja',
      main: 'lower-third.js',
      supportsRealTime: true,
      supportsNonRealTime: false,
      stepCount: 1,
    });
  });

  it('declares the lower-third layer and the lowerThird category in the v_baja vendor field', () => {
    // Arrange: nothing to set up; the manifest is read from disk.

    // Act: read BajaOvrLay's own field, which OGraf allows because its name starts with v_.
    const bajaVendorFields = lowerThirdManifest.v_baja;

    // Assert: the server reads the default layer and the category from it; a lower third
    // has no clock to carry forward, so no update rule.
    expect(
      bajaVendorFields,
      'the lower third must ask for the lower-third layer and its category, with no update rule',
    ).toEqual({ defaultLayerId: 'lower-third', category: 'lowerThird' });
  });

  it('declares the play length as --motion-in + --motion-lead and the stop length as --motion-out', () => {
    // Arrange: the three durations as packages/theme/ardosia/tokens.css writes them. The
    // timelines read the same tokens from the page at run time (lowerThirdAnimations.ts),
    // so the manifest tells the truth only while it matches the file.
    const motionInMs = readDurationTokenInMilliseconds('--motion-in');
    const motionLeadMs = readDurationTokenInMilliseconds('--motion-lead');
    const motionOutMs = readDurationTokenInMilliseconds('--motion-out');

    // Act: read what the manifest promises a renderer.
    const declaredDurations = lowerThirdManifest.actionDurations;

    // Assert: the play-in ends when the role pill, a lead behind, has come in; the
    // stop-out takes both pills out together.
    expect(
      declaredDurations,
      'the manifest durations must follow the theme’s motion tokens',
    ).toEqual([
      { type: 'playAction', duration: motionInMs + motionLeadMs },
      { type: 'stopAction', duration: motionOutMs },
    ]);
  });

  it('requires only the name and refuses unknown fields', () => {
    // Arrange: nothing to set up; the manifest is read from disk.

    // Act: read the required list and whether unknown fields are allowed.
    const requiredFields = lowerThirdManifest.schema.required;
    const allowsUnknownFields = lowerThirdManifest.schema.additionalProperties;

    // Assert: the role and the team line get "limpar" in the form and may be left out.
    expect(requiredFields, 'only the name may be required').toEqual(['name']);
    expect(allowsUnknownFields, 'a field the graphic does not know must be refused').toBe(false);
  });

  it('gives every data field a pt-BR title', () => {
    // Arrange: the data fields as the manifest describes them.
    const dataFields = Object.entries(lowerThirdManifest.schema.properties);

    // Act: collect each field's title.
    const titlesByField = Object.fromEntries(
      dataFields.map(([fieldName, field]) => [fieldName, field.title]),
    );

    // Assert: each field has the pt-BR title an operator form will show.
    expect(titlesByField, 'every data field must carry a pt-BR title').toEqual({
      name: 'Nome',
      role: 'Função',
      teamLine: 'Equipe',
      position: 'Posição',
    });
  });

  it('says in each optional field’s pt-BR description what happens when it is left out', () => {
    // Arrange: the three optional fields of the form.
    const { role, teamLine, position } = lowerThirdManifest.schema.properties;

    // Act: read their help texts.
    const descriptions = [role.description, teamLine.description, position.description];

    // Assert: each starts by saying the field is optional and say what is shown without it.
    for (const description of descriptions) {
      expect(description, 'an optional field’s help must say it is optional').toMatch(/^Opcional;/);
      expect(description, 'an optional field’s help must say what happens when absent').toMatch(
        /Ausente,/,
      );
    }
  });
});

describe('the "Posição" field of lower-third.ograf.json', () => {
  it('is a dropdown of the three places, labelled in pt-BR, starting on Esquerda', () => {
    // Arrange: the position field as the manifest describes it.
    const positionField = lowerThirdManifest.schema.properties.position;

    // Act: pick out what the item editor reads to draw the dropdown.
    const dropdownAsDeclared = {
      values: positionField.enum,
      control: positionField.gddType,
      labels: positionField.gddOptions.labels,
      startingValue: positionField.default,
    };

    // Assert: the three values, their pt-BR words, and the left for a new item.
    expect(dropdownAsDeclared, 'the position must be a dropdown of the three places').toEqual({
      values: ['left', 'center', 'right'],
      control: 'select',
      labels: { left: 'Esquerda', center: 'Centro', right: 'Direita' },
      startingValue: 'left',
    });
  });

  it('offers exactly the places the graphic knows, in the same order', () => {
    // Arrange: the values of the manifest's dropdown.
    const valuesInTheManifest = lowerThirdManifest.schema.properties.position.enum;

    // Act: read the places the graphic's own model knows.
    const valuesInTheGraphic = [...lowerThirdPositions];

    // Assert: the same list, so the form never offers a place the graphic refuses.
    expect(valuesInTheManifest, 'the manifest and the graphic must know the same places').toEqual(
      valuesInTheGraphic,
    );
  });
});
