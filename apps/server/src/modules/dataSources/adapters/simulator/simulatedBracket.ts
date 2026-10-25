// The simulated Super Prime as a pure function of seed, field and time (BAJAOVRLAY-25):
// ask for a moment, get every round known at that moment. Nothing is remembered between
// calls; the heats are run again from the draw, in order, one per simulated minute, with the
// same seeded draws, so the same moment always gives the same bracket (a restart, a test).
// It is not the real Super Prime: a heat is a coin toss from the seed, not a race.
import type { BracketCar, BracketMatch, BracketRound } from '@bajaovrlay/shared';

import { ptBR } from '../../../../core/messages/ptBR.js';
import { readFictionalTeamOfCar } from './fictionalTeams.js';
import { drawForRace } from './seededRandom.js';
import { drawFirstRoundOfSimulatedBracket } from './simulatedBracketDraw.js';

/** One heat every simulated minute: at 60×, a 16-slot Super Prime is over in about 15 s. */
export const simulatedHeatIntervalMs = 60_000;

/** A best of 3 (the semifinals, the third place and the final) is won with two wins. */
const winsThatTakeABestOfThree = 2;

/** What the bracket is drawn from: the race's seed and its field. */
export type SimulatedBracketSettings = { seed: number; carCount: number };

/** One match while the heats are run: its cars, the heats each has won, its winner. */
type MatchBeingRun = {
  matchId: string;
  isBestOfThree: boolean;
  carA: BracketCar;
  /** Left out for a bye. */
  carB: BracketCar | undefined;
  heatsWonByCarA: number;
  heatsWonByCarB: number;
  winnerCarNumber: number | undefined;
};

/** One round while the heats are run. */
type RoundBeingRun = { name: string; isThirdPlace: boolean; matches: MatchBeingRun[] };

/** How many heats are over by the moment looked at, and how many have been run so far. */
type HeatClock = { seed: number; heatsOverByNow: number; heatsRun: number };

/**
 * The rounds of the simulated Super Prime known at `elapsedSimulatedMs` after the green
 * flag, first round first. A round is listed once every car in it is known (the shape has
 * no pending slot): the first from the start, each next one once the round before is
 * decided; the third place and the final together, once both semifinals are, the third
 * place run first. Pure: the same arguments always give a deep-equal answer.
 */
export function simulateBracketAt(
  settings: SimulatedBracketSettings,
  elapsedSimulatedMs: number,
): BracketRound[] {
  const heatClock: HeatClock = {
    seed: settings.seed,
    heatsOverByNow: Math.floor(Math.max(0, elapsedSimulatedMs) / simulatedHeatIntervalMs),
    heatsRun: 0,
  };
  const rounds: RoundBeingRun[] = [];

  let roundNumber = 1;
  let matches = buildFirstRound(settings);
  for (;;) {
    rounds.push({ name: nameRoundByItsMatchCount(matches.length), isThirdPlace: false, matches });
    runHeatsOfMatchesInOrder(matches, heatClock);
    const isRoundDecided = matches.every((match) => match.winnerCarNumber !== undefined);
    if (!isRoundDecided || matches.length === 1) {
      break;
    }
    if (matches.length === 2) {
      addThirdPlaceAndFinal(rounds, matches, roundNumber + 1, heatClock);
      break;
    }
    roundNumber += 1;
    matches = pairTheWinnersOf(matches, roundNumber);
  }

  return rounds.map(writeRoundAsTheShapeHasIt);
}

/** The first round from the draw: the byes decided at once, carA through by W.O. */
function buildFirstRound(settings: SimulatedBracketSettings): MatchBeingRun[] {
  const pairs = drawFirstRoundOfSimulatedBracket(settings.seed, settings.carCount);
  const isBestOfThree = pairs.length <= 2;
  return pairs.map((pair, matchIndex) => {
    const carA = describeCarOfIndex(pair.carIndexA);
    const carB = pair.carIndexB === undefined ? undefined : describeCarOfIndex(pair.carIndexB);
    const match = buildMatch(`r1-m${String(matchIndex + 1)}`, isBestOfThree, carA, carB);
    if (carB === undefined) {
      match.winnerCarNumber = carA.carNumber;
    }
    return match;
  });
}

/** After the semifinals: the third place (the losers) then the final (the winners). */
function addThirdPlaceAndFinal(
  rounds: RoundBeingRun[],
  semifinals: MatchBeingRun[],
  finalRoundNumber: number,
  heatClock: HeatClock,
): void {
  const [firstSemifinal, secondSemifinal] = semifinals;
  if (firstSemifinal === undefined || secondSemifinal === undefined) {
    return;
  }
  const thirdPlace = buildMatch(
    'disputa-3o-lugar',
    true,
    readLoserOf(firstSemifinal),
    readLoserOf(secondSemifinal),
  );
  const final = buildMatch(
    `r${String(finalRoundNumber)}-m1`,
    true,
    readWinnerOf(firstSemifinal),
    readWinnerOf(secondSemifinal),
  );
  rounds.push({
    name: ptBR.simulatorBracket.thirdPlace,
    isThirdPlace: true,
    matches: [thirdPlace],
  });
  rounds.push({ name: nameRoundByItsMatchCount(1), isThirdPlace: false, matches: [final] });
  // The third place runs before the final, as on the day.
  runHeatsOfMatchesInOrder([thirdPlace, final], heatClock);
}

/** The next round: the winners of matches 1 and 2 meet, then those of 3 and 4, and so on. */
function pairTheWinnersOf(matches: MatchBeingRun[], roundNumber: number): MatchBeingRun[] {
  const nextMatches: MatchBeingRun[] = [];
  const isBestOfThree = matches.length / 2 <= 2;
  for (let matchIndex = 0; matchIndex < matches.length; matchIndex += 2) {
    const fromFirst = matches[matchIndex];
    const fromSecond = matches[matchIndex + 1];
    if (fromFirst === undefined || fromSecond === undefined) {
      continue;
    }
    const matchId = `r${String(roundNumber)}-m${String(matchIndex / 2 + 1)}`;
    nextMatches.push(
      buildMatch(matchId, isBestOfThree, readWinnerOf(fromFirst), readWinnerOf(fromSecond)),
    );
  }
  return nextMatches;
}

/**
 * Runs the heats of the matches, one match after the other, each until it is decided,
 * while heats are left before the moment looked at. A match with no carB (a bye) is
 * decided already and runs none.
 */
function runHeatsOfMatchesInOrder(matches: MatchBeingRun[], heatClock: HeatClock): void {
  for (const match of matches) {
    while (match.winnerCarNumber === undefined) {
      if (heatClock.heatsRun >= heatClock.heatsOverByNow) {
        return;
      }
      heatClock.heatsRun += 1;
      runOneHeat(match, heatClock);
    }
  }
}

/** One heat: carA or carB wins it on the seed's draw; a plain match ends there. */
function runOneHeat(match: MatchBeingRun, heatClock: HeatClock): void {
  const carB = match.carB;
  if (carB === undefined) {
    return;
  }
  const isWonByCarA = drawForRace(heatClock.seed, heatClock.heatsRun, 'bracketHeatWinner') < 0.5;
  if (isWonByCarA) {
    match.heatsWonByCarA += 1;
  } else {
    match.heatsWonByCarB += 1;
  }
  const winsNeeded = match.isBestOfThree ? winsThatTakeABestOfThree : 1;
  if (match.heatsWonByCarA === winsNeeded) {
    match.winnerCarNumber = match.carA.carNumber;
  }
  if (match.heatsWonByCarB === winsNeeded) {
    match.winnerCarNumber = carB.carNumber;
  }
}

function buildMatch(
  matchId: string,
  isBestOfThree: boolean,
  carA: BracketCar,
  carB: BracketCar | undefined,
): MatchBeingRun {
  return {
    matchId,
    isBestOfThree,
    carA,
    carB,
    heatsWonByCarA: 0,
    heatsWonByCarB: 0,
    winnerCarNumber: undefined,
  };
}

/** The car of a field index, as the brackets list it: car 1 is the first fictional team. */
function describeCarOfIndex(carIndex: number): BracketCar {
  const team = readFictionalTeamOfCar(carIndex);
  return { carNumber: carIndex + 1, teamName: team.teamName, schoolName: team.schoolName };
}

/** The decided match's winner, as a car of the next round (without this match's wins). */
function readWinnerOf(match: MatchBeingRun): BracketCar {
  const isWonByCarB = match.carB !== undefined && match.winnerCarNumber === match.carB.carNumber;
  if (isWonByCarB && match.carB !== undefined) {
    return match.carB;
  }
  return match.carA;
}

/** The decided match's loser, for the third place: a semifinal always has two cars. */
function readLoserOf(match: MatchBeingRun): BracketCar {
  if (match.carB === undefined) {
    throw new Error(`match ${match.matchId} has no carB, so no loser; a bug`);
  }
  return match.winnerCarNumber === match.carA.carNumber ? match.carB : match.carA;
}

/** "Final", "Semifinal", "Quartas de final", "Oitavas de final", then "16 avos de final"… */
function nameRoundByItsMatchCount(matchCount: number): string {
  const roundNames = ptBR.simulatorBracket;
  if (matchCount === 1) {
    return roundNames.final;
  }
  if (matchCount === 2) {
    return roundNames.semifinal;
  }
  if (matchCount === 4) {
    return roundNames.quarterFinals;
  }
  if (matchCount === 8) {
    return roundNames.roundOfSixteen;
  }
  return roundNames.roundOfManyMatches(matchCount);
}

/** One round as the brackets shape has it. */
function writeRoundAsTheShapeHasIt(round: RoundBeingRun): BracketRound {
  const matches = round.matches.map(writeMatchAsTheShapeHasIt);
  return round.isThirdPlace
    ? { name: round.name, isThirdPlace: true, matches }
    : { name: round.name, matches };
}

/**
 * One match as the brackets shape has it: a bye as carA's W.O. with no carB; a best of 3
 * with each car's wins once its first heat is run; a plain match with its winner only.
 */
function writeMatchAsTheShapeHasIt(match: MatchBeingRun): BracketMatch {
  const hasAHeatBeenRun = match.heatsWonByCarA + match.heatsWonByCarB > 0;
  const isCountingWins = match.isBestOfThree && hasAHeatBeenRun;
  const carA = isCountingWins ? { ...match.carA, wins: match.heatsWonByCarA } : match.carA;
  const written: BracketMatch = { matchId: match.matchId, carA };
  if (match.isBestOfThree) {
    written.bestOf = 3;
  }
  if (match.carB === undefined) {
    written.walkover = true;
  } else {
    written.carB = isCountingWins ? { ...match.carB, wins: match.heatsWonByCarB } : match.carB;
  }
  if (match.winnerCarNumber !== undefined) {
    written.winnerCarNumber = match.winnerCarNumber;
  }
  return written;
}
