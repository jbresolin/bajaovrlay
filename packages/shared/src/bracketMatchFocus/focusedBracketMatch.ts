import type { BracketCar, BracketsShape } from '../dataShapes/index.js';
import type { Team } from '../entities/team.js';
import { buildMediaUrl } from '../media/mediaId.js';
import type { BracketMatchFocus, BracketMatchSlot } from './bracketMatchFocus.js';
import {
  type BracketMatchInPlayOrder,
  listBracketMatchesInPlayOrder,
} from './bracketMatchPlayOrder.js';

/**
 * What one slot of the focus holds now:
 * - `chosen`: the match the operator put there, as the source lists it now;
 * - `notChosen`: nothing there (never chosen, emptied, or chosen in another session);
 * - `gone`: the operator chose a match the source no longer lists. The graphics show
 *   nothing for it, as for an empty slot, and the page names the match that went.
 */
export type FocusedBracketMatchReading =
  | { status: 'chosen'; matchInPlayOrder: BracketMatchInPlayOrder }
  | { status: 'notChosen' }
  | { status: 'gone'; matchId: string };

/** One car of the focused match as the graphics receive it; optional parts left out. */
export type FocusedBracketCar = {
  carNumber: number;
  /** The bracket's own name for the team ("Corisco"): the short one a bug has room for. */
  shortName: string;
  /** The team's name in Cadastros ("Corisco Baja UPE"); the short name when it is not there. */
  teamName: string;
  /** The school's short form, as the bracket carries it ("UPE"). */
  schoolName: string;
  city?: string;
  /** The state's two letters ("PE"). */
  state?: string;
  /** The logo's /media address, from Cadastros. */
  logoUrl?: string;
  /** Whether the logo goes on the light plate; given only with a logo. */
  logoOnLightPlate?: boolean;
  /** The races won in a best of N, as the bracket carries them. */
  wins?: number;
  /** The car's time in this match, in ms, once it has run. */
  timeMs?: number;
};

/** The focused match as the graphics receive it (BAJAOVRLAY-65). */
export type FocusedBracketMatchData = {
  roundName: string;
  isThirdPlace: boolean;
  /** The series' length; 1 for a single race, the source's `bestOf` otherwise. */
  bestOf: number;
  winnerCarNumber?: number;
  carA: FocusedBracketCar;
  carB: FocusedBracketCar;
};

/** The focus of one source, if the operator ever chose for it. */
export function findBracketMatchFocusOfSource(
  focuses: readonly BracketMatchFocus[],
  sourceId: string,
): BracketMatchFocus | undefined {
  return focuses.find((focus) => focus.sourceId === sourceId);
}

/** The match id one slot of a focus names, or undefined when that slot is empty. */
export function readMatchIdOfSlot(
  focus: BracketMatchFocus,
  slot: BracketMatchSlot,
): string | undefined {
  return slot === 'current' ? focus.currentMatchId : focus.upNextMatchId;
}

/**
 * Reads what one slot holds against the brackets the source sends now: a focus of another
 * session holds nothing (it was chosen for another day), and a chosen match that is no
 * longer listed as a raced match is gone. Pure.
 */
export function readFocusedBracketMatch(
  brackets: BracketsShape,
  focus: BracketMatchFocus | undefined,
  slot: BracketMatchSlot,
): FocusedBracketMatchReading {
  if (focus === undefined || focus.sessionId !== brackets.sessionId) {
    return { status: 'notChosen' };
  }
  const chosenMatchId = readMatchIdOfSlot(focus, slot);
  if (chosenMatchId === undefined) {
    return { status: 'notChosen' };
  }
  const matchInPlayOrder = listBracketMatchesInPlayOrder(brackets.rounds).find(
    (entry) => entry.match.matchId === chosenMatchId,
  );
  if (matchInPlayOrder === undefined) {
    return { status: 'gone', matchId: chosenMatchId };
  }
  return { status: 'chosen', matchInPlayOrder };
}

/**
 * One car of the match joined with its team in Cadastros by car number, the key both
 * share (the team card's join). A team missing from Cadastros keeps the bracket's names
 * and has no city, state or logo: the graphics draw it without them, nothing invented.
 */
function describeCarForGraphics(car: BracketCar, teams: readonly Team[]): FocusedBracketCar {
  const teamInCadastros = teams.find((team) => team.carNumber === car.carNumber);
  const describedCar: FocusedBracketCar = {
    carNumber: car.carNumber,
    shortName: car.teamName,
    teamName: teamInCadastros?.teamName ?? car.teamName,
    schoolName: car.schoolName,
  };
  if (teamInCadastros?.city !== undefined) {
    describedCar.city = teamInCadastros.city;
  }
  if (teamInCadastros?.state !== undefined) {
    describedCar.state = teamInCadastros.state;
  }
  if (teamInCadastros?.logoMediaId !== undefined) {
    describedCar.logoUrl = buildMediaUrl(teamInCadastros.logoMediaId);
    describedCar.logoOnLightPlate = teamInCadastros.logoOnLightPlate === true;
  }
  if (car.wins !== undefined) {
    describedCar.wins = car.wins;
  }
  if (car.timeMs !== undefined) {
    describedCar.timeMs = car.timeMs;
  }
  return describedCar;
}

/**
 * The data of a focused match the graphics receive: its round, the third place, the best
 * of, the winner once decided, and both cars joined with Cadastros. A match in play order
 * always has its carB (byes are never listed there). Pure: the teams are handed in.
 */
export function describeFocusedMatchForGraphics(
  matchInPlayOrder: BracketMatchInPlayOrder,
  teams: readonly Team[],
): FocusedBracketMatchData {
  const { match } = matchInPlayOrder;
  const carB = match.carB;
  if (carB === undefined) {
    throw new Error('a bye is never in play order; this is a bug in bracketMatchPlayOrder.ts');
  }
  const data: FocusedBracketMatchData = {
    roundName: matchInPlayOrder.roundName,
    isThirdPlace: matchInPlayOrder.isThirdPlace,
    bestOf: match.bestOf ?? 1,
    carA: describeCarForGraphics(match.carA, teams),
    carB: describeCarForGraphics(carB, teams),
  };
  if (match.winnerCarNumber !== undefined) {
    data.winnerCarNumber = match.winnerCarNumber;
  }
  return data;
}
