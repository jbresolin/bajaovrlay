// @vitest-environment node
/**
 * The manifest's data schema and the graphic's own check agree
 * (packages/graphics/bracket-match-bug)
 *
 * What this module is for:
 *   The match bug's data is described twice: as JSON Schema in the manifest (which the
 *   server and the item form use) and as Zod in matchBugModel.ts (which load and
 *   updateAction use). If the two disagreed, a take the server accepted could be refused
 *   by the graphic on air, or the other way round.
 *
 * What these tests prove:
 *   - The same payloads, as they travel on the wire, are accepted or refused by both.
 *
 * What these tests deliberately do not cover:
 *   - What each field means on screen: matchBugModel.test.ts.
 *   - The page: this file runs in plain Node (the pragma on line 1).
 */
import { createOGrafSchemaValidator } from '@bajaovrlay/graphics-kit/ografSchemaValidator.testSupport';
import { describe, expect, it } from 'vitest';

import matchBugManifest from '../bracket-match-bug.ograf.json';
import { type MatchBugData, parseCompleteMatchBugData } from './matchBugModel.js';

/** The second semifinal at 1 × 1: Corisco (47) against Pequi (12), a best of 3. */
function buildSemifinalAtOneAll(): MatchBugData {
  return {
    roundName: 'Semifinal',
    bestOf: 3,
    carANumber: 47,
    carAShortName: 'Corisco',
    carAWins: 1,
    carBNumber: 12,
    carBShortName: 'Pequi',
    carBWins: 1,
  };
}

const dataAgreementScenarios = [
  // The match on air with every field of a series.
  { name: 'both accept a best of 3 at 1 × 1', data: buildSemifinalAtOneAll(), isValid: true },
  // A timed run, decided, in the clock's corner.
  {
    name: 'both accept a decided timed run in the top-right corner',
    data: {
      roundName: 'Quartas de final',
      carANumber: 47,
      carAShortName: 'Corisco',
      carATimeMs: 41_870,
      carBNumber: 12,
      carBShortName: 'Pequi',
      carBTimeMs: 43_215,
      winnerCarNumber: 47,
      corner: 'top-right',
    },
    isValid: true,
  },
  // An empty "agora": nothing at all.
  { name: 'both accept no data at all', data: {}, isValid: true },
  // The kit's four corners only.
  {
    name: 'both refuse a centre position',
    data: { ...buildSemifinalAtOneAll(), corner: 'bottom-center' },
    isValid: false,
  },
  // A series of none.
  { name: 'both refuse a best of 0', data: { ...buildSemifinalAtOneAll(), bestOf: 0 }, isValid: false },
  // Wins are whole races.
  {
    name: 'both refuse half a win',
    data: { ...buildSemifinalAtOneAll(), carAWins: 1.5 },
    isValid: false,
  },
  // A car number from 1.
  {
    name: 'both refuse car number 0',
    data: { ...buildSemifinalAtOneAll(), carANumber: 0 },
    isValid: false,
  },
  // The card's field name, by mistake.
  {
    name: 'both refuse an unknown field',
    data: { ...buildSemifinalAtOneAll(), carALogoUrl: '/media/logo-corisco' },
    isValid: false,
  },
];

describe('the manifest data schema and the graphic validation agree', () => {
  it.each(dataAgreementScenarios)('$name', ({ data, isValid }) => {
    // Arrange: the manifest's data schema compiled into a validator, and the payload as it
    // travels on the wire.
    const validator = createOGrafSchemaValidator();
    const validateDataWithManifestSchema = validator.compile(matchBugManifest.schema);
    const dataAsSentOnTheWire: unknown = JSON.parse(JSON.stringify(data));

    // Act: check the same payload with both.
    const isValidForManifest = validateDataWithManifestSchema(dataAsSentOnTheWire);
    const isValidForGraphic = parseCompleteMatchBugData(dataAsSentOnTheWire).isValid;

    // Assert: both give the expected answer.
    expect(isValidForManifest, 'the manifest data schema must give the expected answer').toBe(
      isValid,
    );
    expect(isValidForGraphic, 'the graphic validation must give the expected answer').toBe(isValid);
  });
});
