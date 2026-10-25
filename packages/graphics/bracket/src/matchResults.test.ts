/**
 * What a match's result cell says for each car (packages/graphics/bracket)
 *
 * What this module is for:
 *   A bracket match's result is modular (catalogue entry 4): a count of wins when it is a
 *   best of N, a time per car when it was a timed run, or only the winner's mark; "—" on
 *   both while undecided. A W.O. overrides all three: the winner carries the "W.O." tag
 *   and the other car "—". Whatever the kind, a decided match makes one car the winner
 *   (its chip turns green) and the other the loser (dimmed like a retired row).
 *   describeResultOfCar answers both for one car; the round board and the tree draw it.
 *
 * What these tests prove, one row per state of sheet-bracket-results:
 *   - A timed run: each car its time to the tenth, cut ("1:11,3"); the faster one won.
 *   - A best of 3: "2" beside the winner, "1" beside the loser; a series not started reads
 *     "—" on both.
 *   - A plain win: the winner's mark beside the winner, nothing beside the loser.
 *   - A W.O. by absence: the tag beside the winner, "—" beside the dimmed opponent.
 *   - A W.O. with no opponent (a bye): the tag beside carA; carB has no result at all.
 *   - Undecided: "—" on both, neither a winner nor a loser.
 *   - Each result reads as a short signature that changes exactly when what is drawn does,
 *     which is how the graphic knows which cell to crossfade.
 *
 * What these tests deliberately do not cover:
 *   - Whether the match itself is consistent (wins against bestOf, a bye's winner): the
 *     source's brackets shape refuses that before it reaches the graphic.
 *   - The drawing of the cells: bracketView.test.ts.
 */
import { describe, expect, it } from 'vitest';

import type { BracketMatchData } from './bracketModel.js';
import { describeResultOfCar, writeResultSignature } from './matchResults.js';

const corisco = { carNumber: 32, teamName: 'Corisco', schoolName: 'UPE' };
const buffalo = { carNumber: 34, teamName: 'Buffalo', schoolName: 'UFLA' };

const resultScenarios: Array<{
  name: string;
  match: BracketMatchData;
  expectedCarA: unknown;
  expectedCarB: unknown;
}> = [
  // Tempo por carro: a timed run, each car's time; Corisco ran faster.
  {
    name: 'writes each car’s time on a timed run',
    match: {
      matchId: 'r1-m2',
      carA: { ...corisco, timeMs: 71_340 },
      carB: { ...buffalo, timeMs: 74_910 },
      winnerCarNumber: 32,
    },
    expectedCarA: { outcome: 'winner', cell: { kind: 'number', text: '1:11,3' } },
    expectedCarB: { outcome: 'loser', cell: { kind: 'number', text: '1:14,9' } },
  },
  // Melhor de 3: the count of wins in place of a time.
  {
    name: 'writes each car’s wins on a best of 3',
    match: {
      matchId: 'disputa-3o-lugar',
      bestOf: 3,
      carA: { ...corisco, wins: 2 },
      carB: { ...buffalo, wins: 1 },
      winnerCarNumber: 32,
    },
    expectedCarA: { outcome: 'winner', cell: { kind: 'number', text: '2' } },
    expectedCarB: { outcome: 'loser', cell: { kind: 'number', text: '1' } },
  },
  // A series announced but not started: no wins written yet.
  {
    name: 'writes "—" on both cars of a best of 3 not started',
    match: { matchId: 'final', bestOf: 3, carA: corisco, carB: buffalo },
    expectedCarA: { outcome: 'undecided', cell: { kind: 'dash' } },
    expectedCarB: { outcome: 'undecided', cell: { kind: 'dash' } },
  },
  // Vitória sem número: the Super Prime's early rounds, only who went through.
  {
    name: 'marks the winner of a plain win and leaves the loser’s cell empty',
    match: { matchId: 'r2-m1', carA: corisco, carB: buffalo, winnerCarNumber: 32 },
    expectedCarA: { outcome: 'winner', cell: { kind: 'winnerMark' } },
    expectedCarB: { outcome: 'loser', cell: { kind: 'blank' } },
  },
  // W.O.: the opponent did not run; it is drawn like any loser, with "—".
  {
    name: 'tags the winner of a W.O. by absence and writes "—" for the opponent',
    match: { matchId: 'r1-m2', walkover: true, carA: corisco, carB: buffalo, winnerCarNumber: 32 },
    expectedCarA: { outcome: 'winner', cell: { kind: 'walkoverTag' } },
    expectedCarB: { outcome: 'loser', cell: { kind: 'dash' } },
  },
  // W.O. sem adversário: a bye; carB is not a car at all.
  {
    name: 'tags carA of a bye and gives carB no result',
    match: {
      matchId: 'r1-m1',
      walkover: true,
      carA: { carNumber: 2, teamName: 'Baja UFMG', schoolName: 'UFMG' },
      winnerCarNumber: 2,
    },
    expectedCarA: { outcome: 'winner', cell: { kind: 'walkoverTag' } },
    expectedCarB: undefined,
  },
  // Antes de decidir: "—" on both.
  {
    name: 'writes "—" on both cars before the match is decided',
    match: { matchId: 'r2-m1', carA: corisco, carB: buffalo },
    expectedCarA: { outcome: 'undecided', cell: { kind: 'dash' } },
    expectedCarB: { outcome: 'undecided', cell: { kind: 'dash' } },
  },
];

describe('describeResultOfCar', () => {
  it.each(resultScenarios)('$name', ({ match, expectedCarA, expectedCarB }) => {
    // Arrange: the row's match.

    // Act: read the result of each car.
    const resultOfCarA = describeResultOfCar(match, 'carA');
    const resultOfCarB = describeResultOfCar(match, 'carB');

    // Assert: the outcome and the cell of each, as sheet-bracket-results draws them.
    expect(resultOfCarA, 'carA must read this way').toEqual(expectedCarA);
    expect(resultOfCarB, 'carB must read this way').toEqual(expectedCarB);
  });
});

describe('writeResultSignature', () => {
  it('changes when a result arrives, and stays when nothing drawn changed', () => {
    // Arrange: a plain match before and after it is decided, and the decided one again.
    const undecided: BracketMatchData = { matchId: 'r2-m1', carA: corisco, carB: buffalo };
    const decided: BracketMatchData = { ...undecided, winnerCarNumber: 32 };
    const decidedAgain: BracketMatchData = { ...decided, carA: { ...corisco } };

    // Act: write the signature of carA in each.
    const before = writeResultSignature(describeResultOfCar(undecided, 'carA'));
    const after = writeResultSignature(describeResultOfCar(decided, 'carA'));
    const afterAgain = writeResultSignature(describeResultOfCar(decidedAgain, 'carA'));

    // Assert: the result arriving changes it; the same result written again does not.
    expect(after, 'a result arriving must change the signature').not.toBe(before);
    expect(afterAgain, 'the same result must keep the signature').toBe(after);
  });
});
