/**
 * The brackets shape (packages/shared)
 *
 * What this module is for:
 *   An elimination (the Super Prime, the suspension's knockout) reaches BajaOvrLay as the
 *   brackets shape: its rounds, first round first, each a list of head-to-head matches.
 *   Who advances is the source's job (the Baja app's `tournament` table); the shape only
 *   refuses a bracket that contradicts itself, so the graphic never draws a result that
 *   cannot be. A match says which kind of result it has by what it carries: times
 *   (`timeMs` on the cars), wins (`bestOf`, with `wins` on the cars) or only the winner.
 *   `walkover` marks a winner who advanced without racing, and a bye is a match with no
 *   `carB` at all, its winner `carA` by W.O. One round may be the third-place match
 *   (`isThirdPlace`), after the semifinals.
 *
 * What these tests prove:
 *   - Each kind of result passes, and so do a bye, a W.O. by absence and an undecided match.
 *   - Each rule refuses its mistake with the exact pt-BR sentence the operator reads on
 *     "Fontes", at the path of the bad field: times and wins mixed in one match, wins
 *     without a best of N, an even best of N, wins over what the series needs, a decided
 *     best of N whose winner lacks the wins (or whose loser has them too), an undecided one
 *     where a car already has them, a bye that is not carA's W.O. (or whose series is
 *     wrong in the same ways as any match's), and a W.O. with no winner.
 *
 * What these tests deliberately do not cover:
 *   - The two rules the draft already had (two different cars, a winner who is one of
 *     them); dataShapes.test.ts keeps them with the other shapes' refusals.
 *   - The rounds (their sizes, the third place, a car or a match id listed twice, the real
 *     Super Prime): bracketsShapeRounds.test.ts.
 *   - Pending slots ("Vencedor J12", "A DEFINIR"): the shape has none, so a source lists a
 *     match only once both its cars are known (the simulator's rule, simulatedBracket.ts).
 */
import { describe, expect, it } from 'vitest';

import { validateDataShape } from './validateDataShape.js';

/** One car as the brackets list it: team 2 "Baja UFMG" of UFMG unless a row says otherwise. */
function buildBracketCar(carNumber: number, teamName: string, schoolName: string) {
  return { carNumber, teamName, schoolName };
}

const bajaUfmg = buildBracketCar(2, 'Baja UFMG', 'UFMG');
const komiketo = buildBracketCar(10, 'Komiketo', 'UFSJ');
const corisco = buildBracketCar(32, 'Corisco', 'UPE');
const buffalo = buildBracketCar(34, 'Buffalo', 'UFLA');

/** Brackets of one session holding the given rounds, as a source would send them. */
function buildBracketsWithRounds(rounds: unknown[]) {
  return { sessionId: 'super-prime-30a-competicao', updatedAtMs: 1_793_552_400_000, rounds };
}

/** A round holding one match: the shape of most rows below. */
function buildBracketsWithOneMatch(match: Record<string, unknown>) {
  return buildBracketsWithRounds([{ name: 'Final', matches: [match] }]);
}

describe('the results a match may carry', () => {
  const acceptedMatchScenarios = [
    // A timed run (a suspension knockout): each car's time, the faster one through.
    {
      name: 'accepts a timed match: a time on each car and the winner',
      match: {
        matchId: 'quartas-1',
        carA: { ...corisco, timeMs: 71_340 },
        carB: { ...buffalo, timeMs: 74_910 },
        winnerCarNumber: 32,
      },
    },
    // A best of 3 (the Super Prime's final): the wins of each car, 2 × 0.
    {
      name: 'accepts a best of 3 won 2 × 0',
      match: {
        matchId: 'final-1',
        bestOf: 3,
        carA: { ...bajaUfmg, wins: 2 },
        carB: { ...komiketo, wins: 0 },
        winnerCarNumber: 2,
      },
    },
    // A best of 3 still running: one win each, no winner yet.
    {
      name: 'accepts a best of 3 still at 1 × 1, with no winner yet',
      match: {
        matchId: 'final-1',
        bestOf: 3,
        carA: { ...bajaUfmg, wins: 1 },
        carB: { ...komiketo, wins: 1 },
      },
    },
    // The Super Prime's early rounds: only who won, no number.
    {
      name: 'accepts a match that carries only its winner',
      match: { matchId: 'r2-m1', carA: bajaUfmg, carB: corisco, winnerCarNumber: 2 },
    },
    // Before the race: both cars, nothing else.
    {
      name: 'accepts a match not decided yet',
      match: { matchId: 'r2-m1', carA: bajaUfmg, carB: corisco },
    },
    // An opponent who did not run (absent, broken, out): a car like any loser, the winner by W.O.
    {
      name: 'accepts a W.O. by absence: the opponent is listed, the winner advanced without racing',
      match: {
        matchId: 'r1-m2',
        walkover: true,
        carA: corisco,
        carB: buffalo,
        winnerCarNumber: 34,
      },
    },
    // A best of 3 won by W.O.: the winner needs no wins when nobody raced.
    {
      name: 'accepts a best of 3 won by W.O. with no wins counted',
      match: {
        matchId: 'final-1',
        bestOf: 3,
        walkover: true,
        carA: bajaUfmg,
        carB: komiketo,
        winnerCarNumber: 10,
      },
    },
    // A draw short of a power of two: the slot facing carA is empty.
    {
      name: 'accepts a bye: no carB, carA through by W.O.',
      match: { matchId: 'r1-m1', walkover: true, carA: bajaUfmg, winnerCarNumber: 2 },
    },
  ];

  it.each(acceptedMatchScenarios)('$name', ({ match }) => {
    // Arrange: brackets whose one round holds this row's match.
    const brackets = buildBracketsWithOneMatch(match);

    // Act: validate them as a poll would.
    const validation = validateDataShape('brackets', brackets);

    // Assert: accepted, with nothing dropped from the match.
    expect(validation, 'a consistent match must pass the brackets shape').toEqual({
      isValid: true,
      shape: brackets,
    });
  });
});

describe('a match that contradicts itself', () => {
  const refusedMatchScenarios = [
    // A source that wrote both kinds of result would leave the graphic guessing which to show.
    {
      name: 'refuses a time on a car of a best of N',
      match: {
        matchId: 'final-1',
        bestOf: 3,
        carA: { ...bajaUfmg, wins: 2, timeMs: 71_340 },
        carB: { ...komiketo, wins: 0 },
        winnerCarNumber: 2,
      },
      expectedErrorMessage:
        'Dados inválidos em "brackets.rounds.0.matches.0.carA.timeMs": uma disputa tem tempos ou vitórias, nunca os dois; esta é melhor de 3.',
    },
    // Wins counted with no series to count them in.
    {
      name: 'refuses wins on a match that is not a best of N',
      match: {
        matchId: 'r2-m1',
        carA: { ...bajaUfmg, wins: 1 },
        carB: corisco,
        winnerCarNumber: 2,
      },
      expectedErrorMessage:
        'Dados inválidos em "brackets.rounds.0.matches.0.carA.wins": vitórias só existem numa disputa melhor de N (bestOf).',
    },
    // A best of 2 can end 1 × 1 with nobody through.
    {
      name: 'refuses a best of an even number',
      match: { matchId: 'final-1', bestOf: 2, carA: bajaUfmg, carB: komiketo },
      expectedErrorMessage:
        'Dados inválidos em "brackets.rounds.0.matches.0.bestOf": uma disputa melhor de N precisa de N ímpar, aqui 2.',
    },
    // Three wins in a best of 3 cannot happen: the series ends at two.
    {
      name: 'refuses more wins than the series needs',
      match: {
        matchId: 'final-1',
        bestOf: 3,
        carA: { ...bajaUfmg, wins: 3 },
        carB: { ...komiketo, wins: 0 },
        winnerCarNumber: 2,
      },
      expectedErrorMessage:
        'Dados inválidos em "brackets.rounds.0.matches.0.carA.wins": numa melhor de 3 ninguém passa de 2 vitórias, aqui 3.',
    },
    // A winner named before the series is over: one win is not enough in a best of 3.
    {
      name: 'refuses a decided best of 3 whose winner has one win',
      match: {
        matchId: 'final-1',
        bestOf: 3,
        carA: { ...bajaUfmg, wins: 1 },
        carB: { ...komiketo, wins: 0 },
        winnerCarNumber: 2,
      },
      expectedErrorMessage:
        'Dados inválidos em "brackets.rounds.0.matches.0.winnerCarNumber": numa melhor de 3 o vencedor tem 2 vitórias, aqui 1.',
    },
    // A winner with no count at all is the same mistake.
    {
      name: 'refuses a decided best of 3 whose winner has no wins written',
      match: {
        matchId: 'final-1',
        bestOf: 3,
        carA: bajaUfmg,
        carB: komiketo,
        winnerCarNumber: 2,
      },
      expectedErrorMessage:
        'Dados inválidos em "brackets.rounds.0.matches.0.winnerCarNumber": numa melhor de 3 o vencedor tem 2 vitórias, aqui 0.',
    },
    // 2 × 2 in a best of 3: the loser cannot have won the series too.
    {
      name: 'refuses a decided best of 3 whose loser has the wins too',
      match: {
        matchId: 'final-1',
        bestOf: 3,
        carA: { ...bajaUfmg, wins: 2 },
        carB: { ...komiketo, wins: 2 },
        winnerCarNumber: 2,
      },
      expectedErrorMessage:
        'Dados inválidos em "brackets.rounds.0.matches.0.carB.wins": numa melhor de 3 quem perde tem menos de 2 vitórias, aqui 2.',
    },
    // A bye whose empty slot "won" would put nobody in the next round.
    {
      name: 'refuses a bye whose winner is not carA',
      match: { matchId: 'r1-m1', walkover: true, carA: bajaUfmg, winnerCarNumber: 10 },
      expectedErrorMessage:
        'Dados inválidos em "brackets.rounds.0.matches.0.winnerCarNumber": sem adversário (carB ausente), o vencedor é o carro 2 (carA).',
    },
    // A bye is decided the moment the draw is made: carA advances.
    {
      name: 'refuses a bye with no winner',
      match: { matchId: 'r1-m1', walkover: true, carA: bajaUfmg },
      expectedErrorMessage:
        'Dados inválidos em "brackets.rounds.0.matches.0.winnerCarNumber": sem adversário (carB ausente), o vencedor é o carro 2 (carA).',
    },
    // Nobody raced, so the win can only be a W.O.
    {
      name: 'refuses a bye not marked as a W.O.',
      match: { matchId: 'r1-m1', carA: bajaUfmg, winnerCarNumber: 2 },
      expectedErrorMessage:
        'Dados inválidos em "brackets.rounds.0.matches.0.walkover": sem adversário (carB ausente), a vitória é por W.O. (walkover).',
    },
    // A W.O. is a way of winning: it needs the one who won.
    {
      name: 'refuses a W.O. with no winner',
      match: { matchId: 'r1-m2', walkover: true, carA: corisco, carB: buffalo },
      expectedErrorMessage:
        'Dados inválidos em "brackets.rounds.0.matches.0.winnerCarNumber": uma vitória por W.O. precisa do vencedor.',
    },
    // Two wins in a best of 3 end the series: a winner must be named with them.
    {
      name: 'refuses an undecided best of 3 where a car already has two wins',
      match: {
        matchId: 'final-1',
        bestOf: 3,
        carA: { ...bajaUfmg, wins: 2 },
        carB: { ...komiketo, wins: 1 },
      },
      expectedErrorMessage:
        'Dados inválidos em "brackets.rounds.0.matches.0.carA.wins": com 2 vitórias numa melhor de 3 o carro 2 já venceu; falta o vencedor.',
    },
    // A bye goes through the series checks too: an even best of N is a typo there as well.
    {
      name: 'refuses a bye with a best of an even number',
      match: { matchId: 'r1-m1', bestOf: 2, walkover: true, carA: bajaUfmg, winnerCarNumber: 2 },
      expectedErrorMessage:
        'Dados inválidos em "brackets.rounds.0.matches.0.bestOf": uma disputa melhor de N precisa de N ímpar, aqui 2.',
    },
    // ...and its car's wins need a series to count in.
    {
      name: 'refuses wins on a bye that is not a best of N',
      match: {
        matchId: 'r1-m1',
        walkover: true,
        carA: { ...bajaUfmg, wins: 0 },
        winnerCarNumber: 2,
      },
      expectedErrorMessage:
        'Dados inválidos em "brackets.rounds.0.matches.0.carA.wins": vitórias só existem numa disputa melhor de N (bestOf).',
    },
  ];

  it.each(refusedMatchScenarios)('$name', ({ match, expectedErrorMessage }) => {
    // Arrange: brackets whose one round holds this row's broken match.
    const brackets = buildBracketsWithOneMatch(match);

    // Act: validate them as a poll would.
    const validation = validateDataShape('brackets', brackets);

    // Assert: refused, with the pt-BR sentence of this row's rule at the bad field.
    expect(validation, 'the match must be refused for the rule this row breaks').toEqual({
      isValid: false,
      errorMessage: expectedErrorMessage,
    });
  });
});
