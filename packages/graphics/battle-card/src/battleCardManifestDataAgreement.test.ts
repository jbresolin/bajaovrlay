// @vitest-environment node
/**
 * The manifest's data schema and the graphic's own validation agree
 * (packages/graphics/battle-card)
 *
 * What this module is for:
 *   battle-card.ograf.json describes the battle card's data as JSON Schema, for renderers
 *   and for the control page's generated form; battleCardModel.ts checks the same data
 *   with Zod when `load` and `updateAction` receive it. If the two disagreed, the form
 *   could offer a value the graphic refuses, or refuse one it would take.
 *
 * What these tests prove:
 *   - The same payloads pass or fail both checks: a battle with and without a trend set by
 *     hand, a battle at lap 0, a leader's battle; and a missing gap, a missing school, a
 *     negative gap, a fractional lap count, position 0, a trend that is not one of the
 *     three, a negative change, a lap count written as text and an unknown field.
 *
 * What these tests deliberately do not cover:
 *   - The rest of the manifest; battleCardManifest.test.ts covers it.
 *   - The page: this file runs in plain Node (the pragma on line 1).
 */
import { createOGrafSchemaValidator } from '@bajaovrlay/graphics-kit/ografSchemaValidator.testSupport';
import { describe, expect, it } from 'vitest';

import battleCardManifest from '../battle-card.ograf.json';
import { type BattleCardData, parseCompleteBattleCardData } from './battleCardModel.js';

/** Imperador (8) 4th at lap 33, ahead of Equipe FEI Baja (1) 5th, 2,0 s behind. */
function createImperadorAheadOfFeiData(): BattleCardData {
  return {
    aheadPosition: 4,
    aheadCarNumber: 8,
    aheadTeamName: 'Imperador',
    aheadSchoolName: 'UTFPR-CWB',
    aheadLaps: 33,
    behindPosition: 5,
    behindCarNumber: 1,
    behindTeamName: 'Equipe FEI Baja',
    behindSchoolName: 'FEI',
    behindLaps: 33,
    gapMs: 2000,
  };
}

const dataAgreementScenarios = [
  // The everyday battle, bound to the positions.
  { name: 'both accept a battle', data: createImperadorAheadOfFeiData(), isValid: true },
  // The operator's trend and change.
  {
    name: 'both accept a trend set by hand with its change',
    data: { ...createImperadorAheadOfFeiData(), manualTrend: 'opening', manualTrendChangeMs: 700 },
    isValid: true,
  },
  // Before the first lap is completed both cars have 0 laps.
  {
    name: 'both accept a battle at lap 0',
    data: { ...createImperadorAheadOfFeiData(), aheadLaps: 0, behindLaps: 0 },
    isValid: true,
  },
  // A battle for the lead.
  {
    name: 'both accept a battle for the lead',
    data: { ...createImperadorAheadOfFeiData(), aheadPosition: 1, behindPosition: 2 },
    isValid: true,
  },
  // The gap is optional in both since gate 2 of PR #27: the leader has none.
  {
    name: 'both accept a battle without the gap',
    data: { ...createImperadorAheadOfFeiData(), gapMs: undefined },
    isValid: true,
  },
  // Every car field is required in both.
  {
    name: 'both refuse a car without its school',
    data: { ...createImperadorAheadOfFeiData(), behindSchoolName: undefined },
    isValid: false,
  },
  // The car behind is behind: a negative gap is a binding to the wrong car.
  {
    name: 'both refuse a negative gap',
    data: { ...createImperadorAheadOfFeiData(), gapMs: -300 },
    isValid: false,
  },
  // Laps are whole numbers.
  {
    name: 'both refuse a fractional lap count',
    data: { ...createImperadorAheadOfFeiData(), behindLaps: 33.5 },
    isValid: false,
  },
  // Positions start at 1.
  {
    name: 'both refuse position 0',
    data: { ...createImperadorAheadOfFeiData(), aheadPosition: 0 },
    isValid: false,
  },
  // Only the three trends.
  {
    name: 'both refuse a trend that is not one of the three',
    data: { ...createImperadorAheadOfFeiData(), manualTrend: 'attacking' },
    isValid: false,
  },
  // The change is a size; its sign comes from the trend.
  {
    name: 'both refuse a negative change',
    data: { ...createImperadorAheadOfFeiData(), manualTrend: 'closing', manualTrendChangeMs: -700 },
    isValid: false,
  },
  // A lap count bound to a text path.
  {
    name: 'both refuse a lap count written as text',
    data: { ...createImperadorAheadOfFeiData(), aheadLaps: '33' },
    isValid: false,
  },
  // A typo'd field name.
  {
    name: 'both refuse an unknown field',
    data: { ...createImperadorAheadOfFeiData(), intervalMs: 2000 },
    isValid: false,
  },
];

describe('the manifest data schema and the graphic validation agree', () => {
  it.each(dataAgreementScenarios)('$name', ({ data, isValid }) => {
    // Arrange: the manifest's data schema compiled into a validator; JSON drops
    // undefined fields, exactly as they would be dropped on the wire.
    const validator = createOGrafSchemaValidator();
    const validateDataWithManifestSchema = validator.compile(battleCardManifest.schema);
    const dataAsSentOnTheWire: unknown = JSON.parse(JSON.stringify(data));

    // Act: check the same payload with both.
    const isValidForManifest = validateDataWithManifestSchema(dataAsSentOnTheWire);
    const isValidForGraphic = parseCompleteBattleCardData(dataAsSentOnTheWire).isValid;

    // Assert: both give the expected answer.
    expect(isValidForManifest, 'the manifest data schema must give the expected answer').toBe(
      isValid,
    );
    expect(isValidForGraphic, 'the graphic validation must give the expected answer').toBe(isValid);
  });
});
