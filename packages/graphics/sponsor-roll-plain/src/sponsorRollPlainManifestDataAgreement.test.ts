// @vitest-environment node
/**
 * The manifest's data schema and the graphic's own validation agree
 * (packages/graphics/sponsor-roll-plain)
 *
 * What this module is for:
 *   sponsor-roll-plain.ograf.json describes the plain roll's data as JSON Schema, for
 *   renderers, the server's take check and the control page's form; sponsorRollPlainModel.ts
 *   checks the same data with Zod when `load` and `updateAction` receive it. If the two
 *   disagreed, the server could put on air data the graphic refuses.
 *
 * What these tests prove:
 *   - The same payloads pass or fail both checks: the list of Cadastros as it comes; a
 *     sponsor with no logo; a corner; an empty list; a seventh level; a weight past 10; a
 *     fifth corner; and an unknown field.
 *
 * What these tests deliberately do not cover:
 *   - The rest of the manifest; sponsorRollPlainManifest.test.ts.
 *   - The page: this file runs in plain Node (the pragma on line 1).
 */
import { createOGrafSchemaValidator } from '@bajaovrlay/graphics-kit/ografSchemaValidator.testSupport';
import { describe, expect, it } from 'vitest';

import plainRollManifest from '../sponsor-roll-plain.ograf.json';
import { parseCompleteSponsorRollPlainData } from './sponsorRollPlainModel.js';

/** Bosch as the entity list of sponsors gives it, weight and plate included. */
function buildBoschAsTheListGivesIt() {
  return {
    name: 'Bosch',
    level: 'diamante',
    logoUrl: '/media/logo-bosch',
    logoOnLightPlate: true,
    rollWeight: 10,
  };
}

const dataAgreementScenarios = [
  // The seeded item's data at a take: the list of Cadastros, nothing else.
  {
    name: 'both accept the list as Cadastros gives it',
    data: { sponsors: [buildBoschAsTheListGivesIt()] },
    isValid: true,
  },
  // A list typed by hand with a sponsor still waiting for its logo: skipped, not refused.
  {
    name: 'both accept a sponsor with no logo',
    data: { sponsors: [{ name: 'Randon', level: 'prata' }] },
    isValid: true,
  },
  // The operator's corner.
  {
    name: 'both accept a corner',
    data: { sponsors: [buildBoschAsTheListGivesIt()], corner: 'bottom-right' },
    isValid: true,
  },
  // Nothing to roll.
  { name: 'both refuse an empty list', data: { sponsors: [] }, isValid: false },
  // "master", the top level's name before the design renamed it.
  {
    name: 'both refuse a level outside the six',
    data: { sponsors: [{ ...buildBoschAsTheListGivesIt(), level: 'master' }] },
    isValid: false,
  },
  // The library's limit on the weight.
  {
    name: 'both refuse a weight past 10',
    data: { sponsors: [{ ...buildBoschAsTheListGivesIt(), rollWeight: 11 }] },
    isValid: false,
  },
  // The four corners only.
  {
    name: 'both refuse a centre position',
    data: { sponsors: [buildBoschAsTheListGivesIt()], corner: 'bottom-center' },
    isValid: false,
  },
  // The sponsor roll's field, by mistake.
  {
    name: 'both refuse an unknown field',
    data: { sponsors: [buildBoschAsTheListGivesIt()], eventWord: 'ENDURO' },
    isValid: false,
  },
];

describe('the manifest data schema and the graphic validation agree', () => {
  it.each(dataAgreementScenarios)('$name', ({ data, isValid }) => {
    // Arrange: the manifest's data schema compiled into a validator, and the payload as it
    // travels on the wire.
    const validator = createOGrafSchemaValidator();
    const validateDataWithManifestSchema = validator.compile(plainRollManifest.schema);
    const dataAsSentOnTheWire: unknown = JSON.parse(JSON.stringify(data));

    // Act: check the same payload with both.
    const isValidForManifest = validateDataWithManifestSchema(dataAsSentOnTheWire);
    const isValidForGraphic = parseCompleteSponsorRollPlainData(dataAsSentOnTheWire).isValid;

    // Assert: both give the expected answer.
    expect(isValidForManifest, 'the manifest data schema must give the expected answer').toBe(
      isValid,
    );
    expect(isValidForGraphic, 'the graphic validation must give the expected answer').toBe(isValid);
  });
});
