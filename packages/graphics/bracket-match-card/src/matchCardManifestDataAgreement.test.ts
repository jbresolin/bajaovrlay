// @vitest-environment node
/**
 * The manifest's data schema and the graphic's own check agree
 * (packages/graphics/bracket-match-card)
 *
 * What this module is for:
 *   The "a seguir" card's data is described twice: as JSON Schema in the manifest (which
 *   the server and the item form use) and as Zod in matchCardModel.ts (which load and
 *   updateAction use). If the two disagreed, a take the server accepted could be refused
 *   by the graphic on air, or the other way round.
 *
 * What these tests prove:
 *   - The same payloads, as they travel on the wire, are accepted or refused by both.
 *
 * What these tests deliberately do not cover:
 *   - What each field means on screen: matchCardModel.test.ts.
 *   - The page: this file runs in plain Node (the pragma on line 1).
 */
import { createOGrafSchemaValidator } from '@bajaovrlay/graphics-kit/ografSchemaValidator.testSupport';
import { describe, expect, it } from 'vitest';

import matchCardManifest from '../bracket-match-card.ograf.json';
import { type MatchCardData, parseCompleteMatchCardData } from './matchCardModel.js';

/** The second semifinal "a seguir": Corisco Baja (32) against Equipe Cactus Baja (13). */
function buildSemifinalUpNext(): MatchCardData {
  return {
    roundName: 'Semifinal',
    bestOf: 3,
    carANumber: 32,
    carATeamName: 'Corisco Baja',
    carASchoolName: 'UPE',
    carACity: 'Recife',
    carAState: 'PE',
    carALogoUrl: '/media/logo-corisco-baja',
    carALogoOnLightPlate: false,
    carBNumber: 13,
    carBTeamName: 'Equipe Cactus Baja',
    carBSchoolName: 'UFERSA-Mos',
  };
}

const dataAgreementScenarios = [
  // The card as the seeded item delivers it, one logo, one team without.
  { name: 'both accept the semifinal "a seguir"', data: buildSemifinalUpNext(), isValid: true },
  // The score once the series has started.
  {
    name: 'both accept the score of a series under way',
    data: { ...buildSemifinalUpNext(), carAWins: 1, carBWins: 0 },
    isValid: true,
  },
  // An empty "a seguir": nothing at all.
  { name: 'both accept no data at all', data: {}, isValid: true },
  // A car number from 1.
  {
    name: 'both refuse car number 0',
    data: { ...buildSemifinalUpNext(), carBNumber: 0 },
    isValid: false,
  },
  // The plate is yes or no.
  {
    name: 'both refuse a plate written as text',
    data: { ...buildSemifinalUpNext(), carALogoOnLightPlate: 'sim' },
    isValid: false,
  },
  // A time is a whole number of milliseconds.
  {
    name: 'both refuse a negative time',
    data: { ...buildSemifinalUpNext(), carATimeMs: -1 },
    isValid: false,
  },
  // The bug's field name, by mistake.
  {
    name: 'both refuse an unknown field',
    data: { ...buildSemifinalUpNext(), corner: 'top-left' },
    isValid: false,
  },
];

describe('the manifest data schema and the graphic validation agree', () => {
  it.each(dataAgreementScenarios)('$name', ({ data, isValid }) => {
    // Arrange: the manifest's data schema compiled into a validator, and the payload as it
    // travels on the wire.
    const validator = createOGrafSchemaValidator();
    const validateDataWithManifestSchema = validator.compile(matchCardManifest.schema);
    const dataAsSentOnTheWire: unknown = JSON.parse(JSON.stringify(data));

    // Act: check the same payload with both.
    const isValidForManifest = validateDataWithManifestSchema(dataAsSentOnTheWire);
    const isValidForGraphic = parseCompleteMatchCardData(dataAsSentOnTheWire).isValid;

    // Assert: both give the expected answer.
    expect(isValidForManifest, 'the manifest data schema must give the expected answer').toBe(
      isValid,
    );
    expect(isValidForGraphic, 'the graphic validation must give the expected answer').toBe(isValid);
  });
});
