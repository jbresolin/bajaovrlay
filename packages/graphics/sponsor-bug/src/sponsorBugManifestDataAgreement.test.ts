// @vitest-environment node
/**
 * The manifest's data schema and the graphic's own validation agree
 * (packages/graphics/sponsor-bug)
 *
 * What this module is for:
 *   sponsor-bug.ograf.json describes the bug's data as JSON Schema, for renderers and for
 *   the control page's generated form; sponsorBugModel.ts checks the same data with Zod
 *   when `load` and `updateAction` receive it. If the two disagreed, the form could offer
 *   a value the graphic refuses, or refuse one it would take.
 *
 * What these tests prove:
 *   - The same payloads pass or fail both checks: a complete bug; no data at all (the
 *     mark alone); the plate off; and a plate written as text, a logo address that is not
 *     text, an event word that is a number, and an unknown field.
 *
 * What these tests deliberately do not cover:
 *   - The rest of the manifest (settings, titles, roles, durations, the OGraf schema
 *     itself); sponsorBugManifest.test.ts covers it.
 *   - The page: this file runs in plain Node (the pragma on line 1); it draws nothing.
 */
import { createOGrafSchemaValidator } from '@bajaovrlay/graphics-kit/ografSchemaValidator.testSupport';
import { describe, expect, it } from 'vitest';

import sponsorBugManifest from '../sponsor-bug.ograf.json';
import { parseCompleteSponsorBugData, type SponsorBugData } from './sponsorBugModel.js';

/** Builds the enduro's bug presented by the master sponsor, as an item from Cadastros gives it. */
function createEnduroBugData(): SponsorBugData {
  return {
    eventWord: 'ENDURO',
    caption: 'Apresentado por',
    sponsorLogoUrl: '/media/7d1e3a5c-logo-serra-azul',
    sponsorLogoOnLightPlate: true,
  };
}

const dataAgreementScenarios = [
  // The everyday bug must pass both checks.
  { name: 'both accept a complete bug', data: createEnduroBugData(), isValid: true },
  // Every field is optional: the mark alone is a finished bug.
  { name: 'both accept no data at all, the mark alone', data: {}, isValid: true },
  // A light logo straight on the card.
  {
    name: 'both accept the plate switched off',
    data: { ...createEnduroBugData(), sponsorLogoOnLightPlate: false },
    isValid: true,
  },
  // The plate is a boolean; text would be a binding to the wrong field.
  {
    name: 'both refuse a plate written as text',
    data: { ...createEnduroBugData(), sponsorLogoOnLightPlate: 'sim' },
    isValid: false,
  },
  // An image address must be text; a number would be a media id bound by mistake.
  {
    name: 'both refuse a logo address that is not text',
    data: { ...createEnduroBugData(), sponsorLogoUrl: 5 },
    isValid: false,
  },
  // The event word is text.
  {
    name: 'both refuse an event word that is a number',
    data: { ...createEnduroBugData(), eventWord: 2026 },
    isValid: false,
  },
  // A typo'd field name (the team card's "logoUrl") must fail both.
  {
    name: 'both refuse an unknown field',
    data: { ...createEnduroBugData(), logoUrl: '/media/7d1e3a5c-logo-serra-azul' },
    isValid: false,
  },
];

describe('the manifest data schema and the graphic validation agree', () => {
  it.each(dataAgreementScenarios)('$name', ({ data, isValid }) => {
    // Arrange: the manifest's data schema compiled into a validator; JSON drops
    // undefined fields, exactly as they would be dropped on the wire.
    const validator = createOGrafSchemaValidator();
    const validateDataWithManifestSchema = validator.compile(sponsorBugManifest.schema);
    const dataAsSentOnTheWire: unknown = JSON.parse(JSON.stringify(data));

    // Act: check the same payload with both.
    const isValidForManifest = validateDataWithManifestSchema(dataAsSentOnTheWire);
    const isValidForGraphic = parseCompleteSponsorBugData(dataAsSentOnTheWire).isValid;

    // Assert: both give the expected answer.
    expect(isValidForManifest, 'the manifest data schema must give the expected answer').toBe(
      isValid,
    );
    expect(isValidForGraphic, 'the graphic validation must give the expected answer').toBe(isValid);
  });
});
