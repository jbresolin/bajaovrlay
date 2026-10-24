// Simulated overall standings: enduro points from the race as it stands, plus points
// for the other events from a fixed table drawn from the seed. This is NOT the real
// Baja SAE Brasil scoring (whose rules have many more events and penalties); it only
// gives the standings graphics believable numbers that move with the enduro.
import type {
  SessionKind,
  StandingsEntry,
  StandingsScorePart,
  StandingsShape,
} from '@bajaovrlay/shared';

import { ptBR } from '../../../../core/messages/ptBR.js';
import { drawForCarAndLap, type DrawPurpose, scaleDrawBetween } from './seededRandom.js';
import type { CarRaceState, EnduroRaceState } from './simulateEnduro.js';

// Points for the enduro winner: 400, the weight Baja SAE scoring gives its biggest
// event (the enduro). The rest score by their laps against the leader's
// (computeEnduroPointsOfCar).
const enduroPointsForTheLeader = 400;

// The other events and the most points each gives in this simulation. Values in the
// range of a Baja scoresheet's dynamic events, rounded; not the real rules.
const otherEvents: { sessionKind: SessionKind; mostPoints: number; purpose: DrawPurpose }[] = [
  { sessionKind: 'acceleration', mostPoints: 75, purpose: 'accelerationPoints' },
  { sessionKind: 'speed', mostPoints: 75, purpose: 'speedPoints' },
  { sessionKind: 'traction', mostPoints: 75, purpose: 'tractionPoints' },
  { sessionKind: 'suspension', mostPoints: 100, purpose: 'suspensionPoints' },
  { sessionKind: 'maneuverability', mostPoints: 75, purpose: 'maneuverabilityPoints' },
];

// The share of an event's points the weakest team still scores: 40 %, since in the real
// events a team that completes its run scores a good part of the points.
const leastShareOfEventPoints = 0.4;

/**
 * The overall standings at this moment of the race: each team's enduro points plus its
 * points in the other events, one score part per event, highest total first; tied teams
 * share a rank and are listed by car number. No simulated team is disqualified.
 */
export function buildOverallStandings(raceState: EnduroRaceState, nowMs: number): StandingsShape {
  const leaderLaps = Math.max(
    0,
    ...raceState.cars.map((car) => car.lapCompletedAtRunningMs.length),
  );
  const unrankedEntries = raceState.cars.map((car, carIndex) => {
    const pointsByPart: Record<string, number> = {
      enduro: computeEnduroPointsOfCar(car, leaderLaps),
    };
    for (const event of otherEvents) {
      pointsByPart[event.sessionKind] = drawEventPoints(raceState.settings.seed, carIndex, event);
    }
    const totalPoints = roundToOneDecimal(
      Object.values(pointsByPart).reduce((sum, points) => sum + points, 0),
    );
    return { car, totalPoints, pointsByPart };
  });

  const sortedEntries = [...unrankedEntries].sort((first, second) => {
    const pointsDifference = second.totalPoints - first.totalPoints;
    if (pointsDifference !== 0) {
      return pointsDifference;
    }
    return first.car.carNumber - second.car.carNumber;
  });

  const entries: StandingsEntry[] = [];
  sortedEntries.forEach((sortedEntry, index) => {
    const entryAbove = entries[index - 1];
    const isTiedWithTheEntryAbove =
      entryAbove !== undefined && entryAbove.points === sortedEntry.totalPoints;
    entries.push({
      rank: isTiedWithTheEntryAbove ? entryAbove.rank : index + 1,
      carNumber: sortedEntry.car.carNumber,
      teamName: sortedEntry.car.teamName,
      schoolName: sortedEntry.car.schoolName,
      points: sortedEntry.totalPoints,
      pointsByPart: sortedEntry.pointsByPart,
    });
  });

  return { scope: 'overall', updatedAtMs: nowMs, scoreParts: listScoreParts(), entries };
}

/**
 * The six parts of the simulated score, one per event, in the order a board shows them:
 * the dynamic events, then the enduro (the real export also puts the enduro after the
 * dynamics). Each part's id is its session kind, so a part reads as the event it scores.
 */
function listScoreParts(): StandingsScorePart[] {
  const labels = ptBR.simulatorScorePartLabels;
  return [
    { partId: 'acceleration', label: labels.acceleration },
    { partId: 'speed', label: labels.speed },
    { partId: 'traction', label: labels.traction },
    { partId: 'suspension', label: labels.suspension },
    { partId: 'maneuverability', label: labels.maneuverability },
    { partId: 'enduro', label: labels.enduro },
  ];
}

/**
 * Enduro points, the simulator's simple formula: 400 × the car's laps ÷ the leader's
 * laps, rounded to one decimal; 0 for everyone before the leader's first lap.
 */
function computeEnduroPointsOfCar(car: CarRaceState, leaderLaps: number): number {
  if (leaderLaps === 0) {
    return 0;
  }
  const carLaps = car.lapCompletedAtRunningMs.length;
  return roundToOneDecimal((enduroPointsForTheLeader * carLaps) / leaderLaps);
}

/** A team's points in one of the other events: fixed by the seed, 40 % to 100 % of the most. */
function drawEventPoints(
  seed: number,
  carIndex: number,
  event: { mostPoints: number; purpose: DrawPurpose },
): number {
  const draw = drawForCarAndLap(seed, carIndex, 0, event.purpose);
  const shareOfThePoints = scaleDrawBetween(draw, leastShareOfEventPoints, 1);
  return roundToOneDecimal(event.mostPoints * shareOfThePoints);
}

/** Rounds points to one decimal, as scoresheets show them. */
function roundToOneDecimal(points: number): number {
  return Math.round(points * 10) / 10;
}
