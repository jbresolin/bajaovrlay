// @vitest-environment node
/**
 * The OGraf manifest, team-card.ograf.json (packages/graphics/team-card)
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
 *     card goes on the lower-third layer and in the team category, with no update rule.
 *   - The play and stop durations in the manifest are the theme's `--motion-in` and
 *     `--motion-out`, read from the text of packages/theme/ardosia/tokens.css.
 *   - The car, the team and the school are required; every data field has a pt-BR title;
 *     the field names are the team entity's attribute keys, so an item maps each one to
 *     the attribute of the same name in Cadastros.
 *   - The photo and the logo, and only they, carry `v_baja.role: "imageUrl"`, so the
 *     control page offers an image picker (or a team's image attributes) for exactly those.
 *   - The plate is a switch that starts off.
 *
 * What these tests deliberately do not cover:
 *   - That the data schema and the graphic's Zod validation accept and refuse the same
 *     payloads; teamCardManifestDataAgreement.test.ts runs the same payloads through both.
 *   - That a real renderer can load the module named in "main"; the Playwright test
 *     e2e/teamCardLifecycle.e2e.ts loads it from dist/ the way a renderer does.
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

import teamCardManifest from '../team-card.ograf.json';

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

/** The data fields as the manifest describes them, each read through one loose shape. */
function listManifestDataFields(): Array<[string, Record<string, unknown>]> {
  return Object.entries(teamCardManifest.schema.properties);
}

describe('team-card.ograf.json against the OGraf v1 manifest schema', () => {
  it('passes the official schema', () => {
    // Arrange: a validator built from the vendored OGraf v1 schemas.
    const validator = createOGrafSchemaValidator();
    const validateManifest = validator.compile(ografManifestSchema);

    // Act: validate the manifest exactly as it is on disk.
    const isManifestValid = validateManifest(teamCardManifest);

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
    const manifestWithoutMain: Record<string, unknown> = { ...teamCardManifest };
    delete manifestWithoutMain.main;

    // Act: validate the broken copy.
    const isManifestValid = validateManifest(manifestWithoutMain);

    // Assert: the schema rejects it.
    expect(isManifestValid, 'a manifest without "main" must fail the OGraf schema').toBe(false);
  });
});

describe('team-card.ograf.json settings', () => {
  it('declares the id, name, render modes and step count the brief fixes', () => {
    // Arrange: nothing to set up; the manifest is read from disk.

    // Act: pick out the fixed settings.
    const fixedSettings = {
      id: teamCardManifest.id,
      name: teamCardManifest.name,
      main: teamCardManifest.main,
      supportsRealTime: teamCardManifest.supportsRealTime,
      supportsNonRealTime: teamCardManifest.supportsNonRealTime,
      stepCount: teamCardManifest.stepCount,
    };

    // Assert: they match the brief, and "main" names the built module in dist/.
    expect(fixedSettings, 'the manifest must declare the settings fixed in the brief').toEqual({
      id: 'baja-team-card',
      name: 'Cartão de equipe',
      main: 'team-card.js',
      supportsRealTime: true,
      supportsNonRealTime: false,
      stepCount: 1,
    });
  });

  it('declares the lower-third layer and the team category in the v_baja vendor field', () => {
    // Arrange: nothing to set up; the manifest is read from disk.

    // Act: read BajaOvrLay's own field, which OGraf allows because its name starts with v_,
    // without its car group, which the kit's everyManifestCarGroups.test.ts checks.
    const { carGroups, ...bajaVendorFields } = teamCardManifest.v_baja;

    // Assert: the server reads the default layer and the category from it; no update rule.
    expect(
      bajaVendorFields,
      'the team card must ask for the lower-third layer and the team category',
    ).toEqual({ defaultLayerId: 'lower-third', category: 'team' });
    expect(
      carGroups.map((carGroup) => carGroup.label),
      'its car, team and school are filled by choosing one car (BAJAOVRLAY-66)',
    ).toEqual(['Carro']);
  });

  it('declares the play and stop lengths the theme sets in --motion-in and --motion-out', () => {
    // Arrange: the two durations as packages/theme/ardosia/tokens.css writes them.
    const motionInMs = readDurationTokenInMilliseconds('--motion-in');
    const motionOutMs = readDurationTokenInMilliseconds('--motion-out');

    // Act: read what the manifest promises a renderer.
    const declaredDurations = teamCardManifest.actionDurations;

    // Assert: the manifest says exactly what the theme's tokens say.
    expect(declaredDurations, 'the manifest durations must be the theme’s motion tokens').toEqual([
      { type: 'playAction', duration: motionInMs },
      { type: 'stopAction', duration: motionOutMs },
    ]);
  });

  it('requires the car, the team and the school, and refuses fields it does not know', () => {
    // Arrange: nothing to set up; the manifest is read from disk.

    // Act: read the required list and whether unknown fields are allowed.
    const requiredFields = teamCardManifest.schema.required;
    const allowsUnknownFields = teamCardManifest.schema.additionalProperties;

    // Assert: every other field gets "limpar" in the form and may be left out.
    expect(requiredFields, 'only the car, the team and the school may be required').toEqual([
      'carNumber',
      'teamName',
      'schoolName',
    ]);
    expect(allowsUnknownFields, 'a field the graphic does not know must be refused').toBe(false);
  });

  it('names its fields after the team entity’s attributes and titles each in pt-BR', () => {
    // Arrange: the data fields as the manifest describes them.
    const dataFields = listManifestDataFields();

    // Act: collect each field's title, by field name.
    const titlesByField = Object.fromEntries(
      dataFields.map(([fieldName, field]) => [fieldName, field.title]),
    );

    // Assert: the attribute keys of a team in Cadastros, each with its form label.
    expect(titlesByField, 'every data field must be a team attribute with a pt-BR title').toEqual({
      carNumber: 'Carro',
      teamName: 'Equipe',
      schoolName: 'Escola',
      city: 'Cidade',
      state: 'Estado (UF)',
      carPhotoUrl: 'Foto do carro',
      logoUrl: 'Logo da equipe',
      logoOnLightPlate: 'Logo sobre placa clara',
    });
  });

  it('marks the photo and the logo, and nothing else, as image fields', () => {
    // Arrange: the data fields as the manifest describes them.
    const dataFields = listManifestDataFields();

    // Act: list the fields whose vendor role is imageUrl, and check they are text.
    const imageFields = dataFields
      .filter(([, field]) => {
        const vendorFields = field.v_baja as { role?: string } | undefined;
        return vendorFields?.role === 'imageUrl';
      })
      .map(([fieldName, field]) => ({ fieldName, type: field.type }));

    // Assert: exactly the two image addresses, each a string as the role requires.
    expect(imageFields, 'only the photo and the logo may be image fields').toEqual([
      { fieldName: 'carPhotoUrl', type: 'string' },
      { fieldName: 'logoUrl', type: 'string' },
    ]);
  });

  it('makes the plate a switch that starts off', () => {
    // Arrange: nothing to set up; the manifest is read from disk.

    // Act: read the plate's field.
    const plateField = teamCardManifest.schema.properties.logoOnLightPlate;

    // Assert: a boolean (the form's switch), off for a new item.
    expect(
      { type: plateField.type, default: plateField.default },
      'the plate must be a switch, off by default',
    ).toEqual({ type: 'boolean', default: false });
  });
});
