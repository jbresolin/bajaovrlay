// Tests only: a Super Prime of eight cars as a source sends it, round by round, built so
// each test can decide which matches have a winner. The teams are real Super Prime
// short names (the shared sample's), so the data reads like the day.
import {
  type BracketCar,
  type BracketMatch,
  type BracketRound,
  type BracketsShape,
  BracketsShapeSchema,
} from '../dataShapes/index.js';

/** The eight cars of the quarter-finals, by their car number. */
export const superPrimeCars = {
  corisco: { carNumber: 32, teamName: 'Corisco', schoolName: 'UPE' },
  buffalo: { carNumber: 34, teamName: 'Buffalo', schoolName: 'UFLA' },
  pequi: { carNumber: 12, teamName: 'Pequi', schoolName: 'UnB' },
  acaua: { carNumber: 47, teamName: 'Acauã', schoolName: 'UFCG' },
  cactus: { carNumber: 13, teamName: 'Cactus', schoolName: 'UFERSA-Mos' },
  bajaUfmg: { carNumber: 2, teamName: 'Baja UFMG', schoolName: 'UFMG' },
  piratas: { carNumber: 7, teamName: 'Piratas Cerrado', schoolName: 'UnB' },
  ufsc: { carNumber: 29, teamName: 'UFSC', schoolName: 'UFSC-Fln' },
} as const satisfies Record<string, BracketCar>;

/** A match not yet decided: two cars, no winner, no result. */
export function buildUndecidedMatch(
  matchId: string,
  carA: BracketCar,
  carB: BracketCar,
): BracketMatch {
  return { matchId, carA, carB };
}

/** A single race decided: the winner named, nothing else carried. */
export function buildDecidedMatch(
  matchId: string,
  carA: BracketCar,
  carB: BracketCar,
  winner: BracketCar,
): BracketMatch {
  return { matchId, carA, carB, winnerCarNumber: winner.carNumber };
}

/** A best of 3 under way, the wins so far on each car; no winner yet. */
export function buildBestOfThreeUnderWay(
  matchId: string,
  carA: BracketCar,
  winsOfCarA: number,
  carB: BracketCar,
  winsOfCarB: number,
): BracketMatch {
  return {
    matchId,
    bestOf: 3,
    carA: { ...carA, wins: winsOfCarA },
    carB: { ...carB, wins: winsOfCarB },
  };
}

/** A bye: carA alone, through by W.O. from the draw. */
export function buildBye(matchId: string, carA: BracketCar): BracketMatch {
  return { matchId, walkover: true, carA, winnerCarNumber: carA.carNumber };
}

/** The four quarter-finals; `winners` names the winner of each decided one by its id. */
export function buildQuarterFinals(winners: Record<string, BracketCar> = {}): BracketRound {
  const cars = superPrimeCars;
  const pairs: [string, BracketCar, BracketCar][] = [
    ['qf-1', cars.corisco, cars.buffalo],
    ['qf-2', cars.pequi, cars.acaua],
    ['qf-3', cars.cactus, cars.bajaUfmg],
    ['qf-4', cars.piratas, cars.ufsc],
  ];
  const matches = pairs.map(([matchId, carA, carB]) => {
    const winner = winners[matchId];
    return winner === undefined
      ? buildUndecidedMatch(matchId, carA, carB)
      : buildDecidedMatch(matchId, carA, carB, winner);
  });
  return { name: 'Quartas de final', matches };
}

/** The brackets of one session, as the shape carries them. */
export function buildSuperPrimeBrackets(rounds: BracketRound[]): BracketsShape {
  return { sessionId: 'super-prime-30a-competicao', updatedAtMs: 1_793_552_400_000, rounds };
}

/**
 * The rounds checked by BracketsShapeSchema, as the server checks a source's poll: a test
 * built on data no source can send (a match id twice, a round of the wrong size) throws
 * here instead of passing on impossible data.
 */
export function parseRoundsAsASourceSendsThem(rounds: BracketRound[]): BracketRound[] {
  return BracketsShapeSchema.parse(buildSuperPrimeBrackets(rounds)).rounds;
}
