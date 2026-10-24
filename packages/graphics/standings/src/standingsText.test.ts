/**
 * The words and numbers of a standings row (packages/graphics/standings)
 *
 * What this module is for:
 *   standingsText.ts writes each cell of a row as the design pages write it: a score with
 *   a decimal comma and at most two decimals ("903,48", "312,5"), the typographic minus
 *   for SEG. and PEN. ("−15"), "—" for a part the source does not know, and for a
 *   disqualified team "—" as its rank and "DESCL." as its total. It also says which rank
 *   sits on the green chip.
 *
 * What these tests prove:
 *   - The number format of the design (buildSampleData.mjs `writePoints`), row by row on
 *     real values of the 30th competition's export.
 *   - A part missing for one team shows "—", while a part worth 0 shows "0".
 *   - A disqualified team's rank is "—" and its total "DESCL.", whatever its points.
 *   - Rank 1 is on the green chip whether tied or not; rank 2 and a disqualified team never.
 *
 * What these tests deliberately do not cover:
 *   - Where the texts go on the board; standingsView.test.ts draws whole pages.
 */
import { describe, expect, it } from 'vitest';

import type { StandingsEntry } from './standingsModel.js';
import {
  isOnTheLeaderChip,
  writePartPointsText,
  writePointsAsText,
  writeRankText,
  writeTotalText,
} from './standingsText.js';

/** Baja UFMG, the winner of the 30th competition, as the overall export scores it. */
function createBajaUfmgEntry(): StandingsEntry {
  return {
    rank: 1,
    carNumber: 2,
    teamName: 'Baja UFMG',
    schoolName: 'UFMG',
    points: 921.8,
    pointsByPart: { projeto: 246.81, enduro: 312.5, seguranca: -15, penalidade: 0 },
  };
}

/** Garra Baja, one of the four disqualified teams: no rank, a total of 0 in the export. */
function createDisqualifiedGarraBajaEntry(): StandingsEntry {
  return {
    carNumber: 42,
    teamName: 'Garra Baja',
    schoolName: 'USJT',
    points: 0,
    pointsByPart: { seguranca: -5 },
    isDisqualified: true,
  };
}

const pointsFormatScenarios = [
  // Two decimals, as most totals are: Equipe FEI Baja's 903.48.
  { name: 'writes 903.48 with a decimal comma', points: 903.48, expected: '903,48' },
  // The zero after the comma is dropped, as the design writes Baja UFMG's total.
  { name: 'drops the trailing zero of 921.80', points: 921.8, expected: '921,8' },
  // A whole score has no comma at all: the 4X4 bonus.
  { name: 'writes a whole 150 without a comma', points: 150, expected: '150' },
  // SEG. is negative: the typographic minus, never the hyphen.
  { name: 'writes −15 with the typographic minus', points: -15, expected: '−15' },
  // A fractional penalty keeps both its minus and its comma.
  { name: 'writes −12.5 with the minus and the comma', points: -12.5, expected: '−12,5' },
  // A score with more decimals than the board shows is rounded to two.
  { name: 'rounds 206.254 to two decimals', points: 206.254, expected: '206,25' },
  // A tiny negative that rounds to nothing is a plain 0, not "−0".
  { name: 'writes a negative that rounds to zero as 0', points: -0.001, expected: '0' },
  // Zero is a real score (PEN. 0), shown as 0.
  { name: 'writes zero as 0', points: 0, expected: '0' },
];

describe('writePointsAsText', () => {
  it.each(pointsFormatScenarios)('$name', ({ points, expected }) => {
    // Arrange: the score as the source sends it (the scenario's number).

    // Act: write it for the board.
    const text = writePointsAsText(points);

    // Assert: it reads as the design page writes it.
    expect(text, 'the score must be written as the design pages write it').toBe(expected);
  });
});

describe('the cells of a part', () => {
  it('shows the points of a part the team has, and "—" for one the source left out', () => {
    // Arrange: Baja UFMG, whose export line has no DINÂM. value in this test.
    const entry = createBajaUfmgEntry();

    // Act: write the PROJETO, PEN. and DINÂM. cells.
    const projetoText = writePartPointsText(entry, 'projeto');
    const penaltyText = writePartPointsText(entry, 'penalidade');
    const dynamicsText = writePartPointsText(entry, 'dinamicas');

    // Assert: real values as numbers, 0 as 0, the missing part as the dash.
    expect(projetoText, 'a known part must show its points').toBe('246,81');
    expect(penaltyText, 'a part worth 0 must show 0, not the dash').toBe('0');
    expect(dynamicsText, 'a part the source does not know must show "—"').toBe('—');
  });

  it('shows "—" in every part when the team carries no parts at all', () => {
    // Arrange: a team sent with its total alone.
    const entryWithTotalOnly = createBajaUfmgEntry();
    delete entryWithTotalOnly.pointsByPart;

    // Act: write its ENDURO cell.
    const enduroText = writePartPointsText(entryWithTotalOnly, 'enduro');

    // Assert: unknown, so the dash.
    expect(enduroText, 'a team with no parts must show "—" in a part').toBe('—');
  });
});

describe('the rank and total of a disqualified team', () => {
  it('writes "—" as the rank and "DESCL." as the total, whatever its points', () => {
    // Arrange: Garra Baja, disqualified, 0 points in the export.
    const entry = createDisqualifiedGarraBajaEntry();

    // Act: write its rank and total cells.
    const rankText = writeRankText(entry);
    const totalText = writeTotalText(entry);

    // Assert: the design's marks for a disqualified team.
    expect(rankText, 'a disqualified team has no rank: "—"').toBe('—');
    expect(totalText, 'a disqualified team shows "DESCL." as its total').toBe('DESCL.');
  });

  it('writes the rank and the total of a ranked team as numbers', () => {
    // Arrange: Baja UFMG, first.
    const entry = createBajaUfmgEntry();

    // Act: write its rank and total cells.
    const rankText = writeRankText(entry);
    const totalText = writeTotalText(entry);

    // Assert: 1 and 921,8.
    expect(rankText, 'a ranked team shows its rank').toBe('1');
    expect(totalText, 'a ranked team shows its total in the board’s format').toBe('921,8');
  });
});

const leaderChipScenarios = [
  // The winner alone.
  { name: 'puts rank 1 on the green chip', entry: createBajaUfmgEntry(), expected: true },
  // A tie for first: every team at rank 1 gets the chip (Sinuelo's enduro is not tied, but
  // a per-event table can be).
  {
    name: 'puts a tied rank 1 on the green chip too',
    entry: { ...createBajaUfmgEntry(), carNumber: 51, teamName: 'Sinuelo' },
    expected: true,
  },
  // Second place keeps the yellow number.
  {
    name: 'keeps rank 2 off the chip',
    entry: { ...createBajaUfmgEntry(), rank: 2 },
    expected: false,
  },
  // A disqualified team has no rank, so no chip.
  {
    name: 'keeps a disqualified team off the chip',
    entry: createDisqualifiedGarraBajaEntry(),
    expected: false,
  },
];

describe('isOnTheLeaderChip', () => {
  it.each(leaderChipScenarios)('$name', ({ entry, expected }) => {
    // Arrange: the scenario's team.

    // Act: ask whether its rank sits on the green chip.
    const isOnTheChip = isOnTheLeaderChip(entry);

    // Assert: only rank 1, tied or not, and never a disqualified team.
    expect(isOnTheChip, 'only rank 1 (tied or not) sits on the green chip').toBe(expected);
  });
});
