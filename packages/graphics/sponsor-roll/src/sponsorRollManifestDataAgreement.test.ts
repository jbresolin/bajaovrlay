// @vitest-environment node
/**
 * The manifest's data schema and the graphic's own validation agree
 * (packages/graphics/sponsor-roll)
 *
 * What this module is for:
 *   sponsor-roll.ograf.json describes the data as JSON Schema; sponsorRollModel.ts checks
 *   the same data with Zod. If they disagreed, the server's check and the graphic's could
 *   answer differently for one take.
 *
 * What these tests prove:
 *   - The same payloads pass or fail both: the 17 on the full screen, the corner without
 *     its word; and no sponsor, a level nobody sells, a sponsor with no logo, a weight of
 *     11, a layout of its own and an unknown field.
 *
 * What these tests deliberately do not cover:
 *   - The rest of the manifest; sponsorRollManifest.test.ts.
 */
import { createOGrafSchemaValidator } from '@bajaovrlay/graphics-kit/ografSchemaValidator.testSupport';
import { describe, expect, it } from 'vitest';

import sponsorRollManifest from '../sponsor-roll.ograf.json';
import { parseCompleteSponsorRollData } from './sponsorRollModel.js';
import {
  createThe30thCompetitionRoll,
  createThe30thCompetitionSponsors,
} from './sponsorRollOnThePage.testSupport.js';

/** The 17 with Bosch changed. */
function withBoschChanged(change: Record<string, unknown>): unknown {
  const [bosch, ...others] = createThe30thCompetitionSponsors();
  return { layout: 'fullscreen', sponsors: [{ ...bosch, ...change }, ...others] };
}

const dataAgreementScenarios = [
  // The everyday roll.
  { name: 'both accept the 17', data: createThe30thCompetitionRoll('fullscreen'), isValid: true },
  // The word is optional.
  {
    name: 'both accept the corner without its word',
    data: { layout: 'corner', sponsors: createThe30thCompetitionSponsors() },
    isValid: true,
  },
  // A roll needs a sponsor.
  { name: 'both refuse no sponsor', data: { layout: 'fullscreen', sponsors: [] }, isValid: false },
  // Six levels only.
  {
    name: 'both refuse a level nobody sells',
    data: withBoschChanged({ level: 'platina' }),
    isValid: false,
  },
  // The list never carries a sponsor without a logo; a roll could not draw it.
  {
    name: 'both refuse a sponsor with no logo',
    data: withBoschChanged({ logoUrl: undefined }),
    isValid: false,
  },
  // The weight is 1 to 10, as Cadastros keeps it.
  {
    name: 'both refuse a weight of 11',
    data: withBoschChanged({ rollWeight: 11 }),
    isValid: false,
  },
  // Two layouts only.
  {
    name: 'both refuse a layout of its own',
    data: { ...createThe30thCompetitionRoll('fullscreen'), layout: 'faixa' },
    isValid: false,
  },
  // A typo'd field name must fail both.
  {
    name: 'both refuse an unknown field',
    data: { ...createThe30thCompetitionRoll('fullscreen'), caption: 'Apresentado por' },
    isValid: false,
  },
];

describe('the manifest data schema and the graphic validation agree', () => {
  it.each(dataAgreementScenarios)('$name', ({ data, isValid }) => {
    // Arrange: the manifest's data schema compiled; the payload as JSON sends it.
    const validator = createOGrafSchemaValidator();
    const validateDataWithManifestSchema = validator.compile(sponsorRollManifest.schema);
    const dataAsSentOnTheWire: unknown = JSON.parse(JSON.stringify(data));

    // Act: check the same payload with both.
    const isValidForManifest = validateDataWithManifestSchema(dataAsSentOnTheWire);
    const isValidForGraphic = parseCompleteSponsorRollData(dataAsSentOnTheWire).isValid;

    // Assert: both give the expected answer.
    expect(isValidForManifest, 'the manifest data schema must give the expected answer').toBe(
      isValid,
    );
    expect(isValidForGraphic, 'the graphic validation must give the expected answer').toBe(isValid);
  });
});
