/**
 * The battle card's data and the texts of its cells (packages/graphics/battle-card)
 *
 * What this module is for:
 *   battleCardModel.ts is the boundary check of the data `load` and `updateAction`
 *   receive (Zod, with pt-BR problems), the merge of a partial update, and the texts the
 *   card draws: each car read from its flat fields, the leader's chip and the gap.
 *
 * What these tests prove:
 *   - The gap is written as the design writes it: a plus, seconds to the tenth cut (never
 *     rounded), a decimal comma and no unit ("+2,0"); a gap past a minute stays in seconds.
 *   - The gap cell shows "—" when the gap is not these two cars' (gate 2 of PR #27): after
 *     the car behind passed the car ahead, with a car between them, or with no gap.
 *   - Each car is read from its own five fields, and only position 1 is the leader.
 *   - The reading the trend follows carries both cars with their places, the laps of the
 *     car behind and the gap.
 *   - Complete data passes; a missing required field, an unknown field and a trend that is
 *     not one of the three are refused with a pt-BR sentence naming the field.
 *   - A partial update changes only what it sends, and a trend set by hand sent as
 *     undefined (the renderer clearing the field) is taken off; a bad update changes
 *     nothing.
 *
 * What these tests deliberately do not cover:
 *   - The trend's rule; battleTrend.test.ts.
 *   - That the manifest's JSON Schema agrees; battleCardManifestDataAgreement.test.ts.
 */
import { describe, expect, it } from 'vitest';

import {
  type BattleCardData,
  isLeader,
  mergePartialUpdateIntoBattleCardData,
  parseCompleteBattleCardData,
  readCarAhead,
  readCarBehind,
  readGapReading,
  writeGapCellText,
  writeGapText,
} from './battleCardModel.js';

/** Imperador (8) 4th at lap 1, ahead of Equipe FEI Baja (1) 5th, 2,0 s behind. */
function createImperadorAheadOfFeiData(): BattleCardData {
  return {
    aheadPosition: 4,
    aheadCarNumber: 8,
    aheadTeamName: 'Imperador',
    aheadSchoolName: 'UTFPR-CWB',
    aheadLaps: 1,
    behindPosition: 5,
    behindCarNumber: 1,
    behindTeamName: 'Equipe FEI Baja',
    behindSchoolName: 'FEI',
    behindLaps: 1,
    gapMs: 2000,
  };
}

describe('the gap text', () => {
  const gapScenarios = [
    // The design's battle: two seconds.
    { name: 'writes 2 000 ms as "+2,0"', gapMs: 2000, expected: '+2,0' },
    // The tenth is cut like every race time: 2,09 s is 2,0, never 2,1.
    { name: 'cuts the tenth: 2 099 ms is "+2,0"', gapMs: 2099, expected: '+2,0' },
    // Cars side by side across the line.
    { name: 'writes 40 ms as "+0,0"', gapMs: 40, expected: '+0,0' },
    // Past a minute a gap stays in seconds, as timing screens write it.
    { name: 'writes 75 300 ms as "+75,3"', gapMs: 75_300, expected: '+75,3' },
  ];

  it.each(gapScenarios)('$name', ({ gapMs, expected }) => {
    // Arrange: the gap of this row, in milliseconds.

    // Act: write it.
    const text = writeGapText(gapMs);

    // Assert: the design's text.
    expect(text, 'the gap must be a plus, seconds to the tenth cut, and a comma').toBe(expected);
  });

  const gapCellScenarios = [
    // The battle as the item means it: car 1 (P5) right behind car 8 (P4).
    { name: 'writes the gap of two cars one place apart', change: {}, expected: '+2,0' },
    // Car 1 passed car 8: its interval is to a third car (gate 2 of PR #27).
    {
      name: 'writes "—" once the car behind has passed the car ahead',
      change: { aheadPosition: 5, behindPosition: 4 },
      expected: '—',
    },
    // A car runs between them: car 1's interval is to that car.
    {
      name: 'writes "—" with a car between them',
      change: { behindPosition: 6 },
      expected: '—',
    },
    // Car 1 became leader, or the leader has no lap yet: no interval sent.
    { name: 'writes "—" with no gap', change: { gapMs: undefined }, expected: '—' },
  ];

  it.each(gapCellScenarios)('$name', ({ change, expected }) => {
    // Arrange: the battle with this row's change.
    const data: BattleCardData = { ...createImperadorAheadOfFeiData(), ...change };

    // Act: write the gap cell.
    const text = writeGapCellText(data);

    // Assert: the gap, or the dash.
    expect(text, 'the gap cell shows only the gap of these two cars').toBe(expected);
  });
});

describe('the two cars', () => {
  it('reads each car from its own five fields', () => {
    // Arrange: the battle's data.
    const data = createImperadorAheadOfFeiData();

    // Act: read both cars.
    const cars = { ahead: readCarAhead(data), behind: readCarBehind(data) };

    // Assert: each car carries exactly its own fields.
    expect(cars, 'each pill must show its own car').toEqual({
      ahead: { position: 4, carNumber: 8, teamName: 'Imperador', schoolName: 'UTFPR-CWB', laps: 1 },
      behind: {
        position: 5,
        carNumber: 1,
        teamName: 'Equipe FEI Baja',
        schoolName: 'FEI',
        laps: 1,
      },
    });
  });

  it('puts only the car in position 1 on the leader chip', () => {
    // Arrange: a battle for the lead, Equipe FEI Baja leading Imperador.
    const data = { ...createImperadorAheadOfFeiData(), aheadPosition: 1, behindPosition: 2 };

    // Act: ask for each car.
    const leaders = [isLeader(readCarAhead(data)), isLeader(readCarBehind(data))];

    // Assert: the car ahead only.
    expect(leaders, 'only position 1 is the leader').toEqual([true, false]);
  });

  it('gives the trend both cars with their places, the laps of the car behind and the gap', () => {
    // Arrange: the battle's data.
    const data = createImperadorAheadOfFeiData();

    // Act: take the reading.
    const reading = readGapReading(data);

    // Assert: what the trend compares from lap to lap.
    expect(reading, 'the reading must carry what the trend follows').toEqual({
      aheadCarNumber: 8,
      aheadPosition: 4,
      behindCarNumber: 1,
      behindPosition: 5,
      behindLaps: 1,
      gapMs: 2000,
    });
  });
});

describe('the data check', () => {
  it('accepts complete data, with or without a trend set by hand', () => {
    // Arrange: the battle with and without a trend by hand.
    const withoutTrend = createImperadorAheadOfFeiData();
    const withTrend = { ...withoutTrend, manualTrend: 'closing', manualTrendChangeMs: 700 };

    // Act: check both.
    const checks = [
      parseCompleteBattleCardData(withoutTrend),
      parseCompleteBattleCardData(withTrend),
    ];

    // Assert: both pass.
    expect(
      checks.map((check) => check.isValid),
      'complete data must pass with or without a trend by hand',
    ).toEqual([true, true]);
  });

  const refusalScenarios = [
    // Every car field is required: a pill without its school would be half drawn.
    {
      name: 'refuses data without the school of the car behind',
      data: { ...createImperadorAheadOfFeiData(), behindSchoolName: undefined },
      problem: 'Falta o campo obrigatório "behindSchoolName".',
    },
    // A typo'd field must not be dropped silently.
    {
      name: 'refuses an unknown field',
      data: { ...createImperadorAheadOfFeiData(), gap: 2000 },
      problem: 'Campo desconhecido nos dados: "gap".',
    },
    // Only the three trends the design draws.
    {
      name: 'refuses a trend that is not one of the three',
      data: { ...createImperadorAheadOfFeiData(), manualTrend: 'attacking' },
      problem: 'Valor inválido no campo "manualTrend".',
    },
  ];

  it.each(refusalScenarios)('$name', ({ data, problem }) => {
    // Arrange: the data of this row, as JSON would carry it.
    const dataOnTheWire: unknown = JSON.parse(JSON.stringify(data));

    // Act: check it.
    const check = parseCompleteBattleCardData(dataOnTheWire);

    // Assert: refused with the pt-BR sentence naming the field.
    expect(check, 'bad data must be refused naming the field').toEqual({ isValid: false, problem });
  });
});

describe('a partial update', () => {
  it('changes only the fields it sends', () => {
    // Arrange: the battle at lap 1.
    const data = createImperadorAheadOfFeiData();

    // Act: the next lap's reading.
    const check = mergePartialUpdateIntoBattleCardData(data, { behindLaps: 2, gapMs: 1300 });

    // Assert: the two fields changed, everything else kept.
    expect(check, 'only the sent fields may change').toEqual({
      isValid: true,
      data: { ...data, behindLaps: 2, gapMs: 1300 },
    });
  });

  it('takes a trend set by hand off when it is sent as undefined', () => {
    // Arrange: the battle with closing set by hand.
    const data = { ...createImperadorAheadOfFeiData(), manualTrend: 'closing' as const };

    // Act: the renderer clears the field, as it does for a key taken off the instance.
    const check = mergePartialUpdateIntoBattleCardData(data, { manualTrend: undefined });

    // Assert: no trend by hand any more.
    expect(
      check.isValid && check.data.manualTrend,
      'a cleared trend by hand must be gone',
    ).toBeUndefined();
  });

  it('refuses a bad update and leaves the data as it was', () => {
    // Arrange: the battle at lap 1.
    const data = createImperadorAheadOfFeiData();

    // Act: a negative lap count.
    const check = mergePartialUpdateIntoBattleCardData(data, { behindLaps: -1 });

    // Assert: refused, and the data object untouched.
    expect(check, 'a bad update must be refused naming the field').toEqual({
      isValid: false,
      problem: 'Valor inválido no campo "behindLaps".',
    });
    expect(data.behindLaps, 'the current data must not change').toBe(1);
  });
});
