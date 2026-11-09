// @vitest-environment node
/**
 * The manifest's data schema and the graphic's own validation agree
 * (packages/graphics/logo-bug)
 *
 * What this module is for:
 *   logo-bug.ograf.json describes the logo bug's data as JSON Schema, for renderers and for
 *   the control page's generated form; logoBugModel.ts checks the same data with Zod when
 *   `load` and `updateAction` receive it. If the two disagreed, the form could offer a
 *   value the graphic refuses, or refuse one it would take.
 *
 * What these tests prove:
 *   - The same payloads pass or fail both checks: the image alone; every field at a limit;
 *     no image; an empty image address; a fifth corner; a height and an opacity past their
 *     limits; a fractional height; and an unknown field.
 *
 * What these tests deliberately do not cover:
 *   - The rest of the manifest; logoBugManifest.test.ts covers it.
 *   - The page: this file runs in plain Node (the pragma on line 1).
 */
import { createOGrafSchemaValidator } from '@bajaovrlay/graphics-kit/ografSchemaValidator.testSupport';
import { describe, expect, it } from 'vitest';

import logoBugManifest from '../logo-bug.ograf.json';
import { type LogoBugData, parseCompleteLogoBugData } from './logoBugModel.js';

/** Builds the channel's logo as an item with only the image chosen gives it. */
function createChannelLogoData(): LogoBugData {
  return { logoUrl: '/media/3b8f0c2e-logo-baja-sae-brasil' };
}

const dataAgreementScenarios = [
  // The seeded item once the operator picked the file.
  { name: 'both accept the image alone', data: createChannelLogoData(), isValid: true },
  // Every number at an edge the brief fixes.
  {
    name: 'both accept the smallest height and the faintest opacity, top-left',
    data: { ...createChannelLogoData(), corner: 'top-left', heightPx: 32, opacityPercent: 30 },
    isValid: true,
  },
  // The other edges.
  {
    name: 'both accept the largest height and full opacity',
    data: { ...createChannelLogoData(), heightPx: 200, opacityPercent: 100 },
    isValid: true,
  },
  // The seeded item before the operator picked the file.
  { name: 'both refuse data without the image', data: {}, isValid: false },
  // A field cleared to nothing.
  { name: 'both refuse an empty image address', data: { logoUrl: '' }, isValid: false },
  // The brief keeps to the four corners.
  {
    name: 'both refuse a centre position',
    data: { ...createChannelLogoData(), corner: 'bottom-center' },
    isValid: false,
  },
  // Past the height limit.
  {
    name: 'both refuse a height of 201 px',
    data: { ...createChannelLogoData(), heightPx: 201 },
    isValid: false,
  },
  // Whole pixels only.
  {
    name: 'both refuse a height of 80.5 px',
    data: { ...createChannelLogoData(), heightPx: 80.5 },
    isValid: false,
  },
  // Under the opacity limit.
  {
    name: 'both refuse an opacity of 29%',
    data: { ...createChannelLogoData(), opacityPercent: 29 },
    isValid: false,
  },
  // The sponsor bug's field name, by mistake.
  {
    name: 'both refuse an unknown field',
    data: { ...createChannelLogoData(), sponsorLogoUrl: '/media/7d1e3a5c-logo-serra-azul' },
    isValid: false,
  },
];

describe('the manifest data schema and the graphic validation agree', () => {
  it.each(dataAgreementScenarios)('$name', ({ data, isValid }) => {
    // Arrange: the manifest's data schema compiled into a validator, and the payload as it
    // travels on the wire.
    const validator = createOGrafSchemaValidator();
    const validateDataWithManifestSchema = validator.compile(logoBugManifest.schema);
    const dataAsSentOnTheWire: unknown = JSON.parse(JSON.stringify(data));

    // Act: check the same payload with both.
    const isValidForManifest = validateDataWithManifestSchema(dataAsSentOnTheWire);
    const isValidForGraphic = parseCompleteLogoBugData(dataAsSentOnTheWire).isValid;

    // Assert: both give the expected answer.
    expect(isValidForManifest, 'the manifest data schema must give the expected answer').toBe(
      isValid,
    );
    expect(isValidForGraphic, 'the graphic validation must give the expected answer').toBe(isValid);
  });
});
