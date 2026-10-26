/**
 * What a match's result cell says for each car, and whether the car won (catalogue entry
 * 4, sheet-bracket-results). The match says which kind of result it has by what it carries:
 * a W.O. (`walkover`) overrides everything; a best of N (`bestOf`) counts wins; a time on
 * either car makes a timed run; anything else is a plain win, shown by the winner's mark.
 * "—" stands for a result not known yet. Pure; the board and the tree draw the answer.
 */
import { writeLapTimeAsText } from '@bajaovrlay/shared/raceTimeText';

import type { BracketCarData, BracketMatchData } from './bracketModel.js';

/** One of the two cars of a match. */
export type CarSide = 'carA' | 'carB';

/** How the match ended for a car: it won, it lost, or it is not decided yet. */
export type CarOutcome = 'winner' | 'loser' | 'undecided';

/**
 * What the result cell holds: the outlined "W.O." tag, the winner's mark, a number (a
 * count of wins, "2", or a time, "1:11,3"), "—", or nothing (the loser of a plain win).
 */
export type ResultCell =
  | { kind: 'walkoverTag' }
  | { kind: 'winnerMark' }
  | { kind: 'number'; text: string }
  | { kind: 'dash' }
  | { kind: 'blank' };

/** A car's outcome and its result cell. */
export type CarResult = { outcome: CarOutcome; cell: ResultCell };

/** The kind of result a match carries, decided by what it carries. */
export type MatchResultKind = 'walkover' | 'wins' | 'times' | 'winnerOnly';

/** Reads the kind of result: W.O. first, then a best of N, then times, else a plain win. */
export function readResultKindOfMatch(match: BracketMatchData): MatchResultKind {
  if (match.walkover === true) {
    return 'walkover';
  }
  if (match.bestOf !== undefined) {
    return 'wins';
  }
  const hasATime = match.carA.timeMs !== undefined || match.carB?.timeMs !== undefined;
  if (hasATime) {
    return 'times';
  }
  return 'winnerOnly';
}

/**
 * The result of one car of the match, or undefined for the empty slot of a bye (carB of a
 * match with no carB), which is not a car and has no result.
 */
export function describeResultOfCar(match: BracketMatchData, side: CarSide): CarResult | undefined {
  const car = match[side];
  if (car === undefined) {
    return undefined;
  }
  const outcome = readOutcomeOfCar(match, car);
  return { outcome, cell: describeResultCell(match, car, outcome) };
}

/**
 * A short text that changes exactly when what the car's result draws changes ("winner:
 * number:2"): the graphic compares it before and after an update to know which cells to
 * crossfade.
 */
export function writeResultSignature(result: CarResult | undefined): string {
  if (result === undefined) {
    return 'noCar';
  }
  const cellText = result.cell.kind === 'number' ? result.cell.text : '';
  return `${result.outcome}:${result.cell.kind}:${cellText}`;
}

/** The outcome a signature was written for: its first part, "winner" of "winner:number:2". */
export function readOutcomeOfSignature(signature: string): string {
  const [outcome] = signature.split(':');
  return outcome ?? '';
}

function readOutcomeOfCar(match: BracketMatchData, car: BracketCarData): CarOutcome {
  if (match.winnerCarNumber === undefined) {
    return 'undecided';
  }
  return match.winnerCarNumber === car.carNumber ? 'winner' : 'loser';
}

function describeResultCell(
  match: BracketMatchData,
  car: BracketCarData,
  outcome: CarOutcome,
): ResultCell {
  switch (readResultKindOfMatch(match)) {
    case 'walkover':
      return outcome === 'winner' ? { kind: 'walkoverTag' } : { kind: 'dash' };
    case 'wins':
      return car.wins === undefined ? { kind: 'dash' } : { kind: 'number', text: String(car.wins) };
    case 'times':
      return car.timeMs === undefined
        ? { kind: 'dash' }
        : { kind: 'number', text: writeLapTimeAsText(car.timeMs) };
    case 'winnerOnly':
      return describePlainWinCell(outcome);
  }
}

/** A plain win: the winner's mark, nothing for the loser, "—" on both before it is run. */
function describePlainWinCell(outcome: CarOutcome): ResultCell {
  if (outcome === 'winner') {
    return { kind: 'winnerMark' };
  }
  if (outcome === 'loser') {
    return { kind: 'blank' };
  }
  return { kind: 'dash' };
}
