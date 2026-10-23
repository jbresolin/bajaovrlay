// The simulated race direction: a few penalties and warnings over the race, drawn from the
// seed like the flags, so the event inbox (BAJAOVRLAY-44) can be rehearsed with nobody
// typing penalties. Plausible, not the rulebook: the reasons are made up like the teams.
import type { IncidentEntry, IncidentsShape } from '@bajaovrlay/shared';

import { ptBR } from '../../../../core/messages/ptBR.js';
import { drawBreakdownOfCar } from './breakdowns.js';
import { buildFlagScheduleOfRace, convertElapsedTimeToRunningTime } from './flags.js';
import { drawForRace, scaleDrawBetween } from './seededRandom.js';
import type { CarRaceState, EnduroRaceState, EnduroSimulationSettings } from './simulateEnduro.js';

// One incident for every 30 minutes of session, at least one: eight in a four-hour
// enduro, enough to rehearse the inbox without burying the operator.
const sessionTimePerIncidentMs = 30 * 60_000;

// Where in its share of the session an incident happens: between 10 % and 90 % of it,
// so two incidents are never on top of each other.
const earliestIncidentInItsShare = 0.1;
const latestIncidentInItsShare = 0.9;

// The share of incidents after the first that are penalties; the rest are warnings. The
// first one is always a penalty, so every rehearsal has one to approve.
const penaltyShareAfterTheFirst = 0.6;

/** One incident as drawn for a race: when, what, which car, which reason. */
export type DrawnIncident = {
  /** 1 for the race's first incident, 2 for the second... */
  occurrenceNumber: number;
  /** Simulated time since the green flag, reds included (the adapter's clock). */
  atElapsedMs: number;
  kind: 'penalty' | 'warning';
  /** The car's index in the field, from 0 (car 1 is index 0). */
  carIndex: number;
  /** The reason's place in its kind's list of the ptBR catalog. */
  reasonIndex: number;
};

/**
 * Draws every incident of a race from its seed, in order. The session is cut into equal
 * shares, one incident in the middle of each, like the yellows. The car is drawn among
 * the whole field; one that has already retired at that moment passes the incident to the
 * next car in the grid (a car parked in the paddock is not penalised). Pure: the same
 * settings always give the same list.
 */
export function drawIncidentScheduleOfRace(settings: EnduroSimulationSettings): DrawnIncident[] {
  const { seed, sessionDurationMs } = settings;
  const flagSchedule = buildFlagScheduleOfRace(seed, sessionDurationMs);
  const incidentCount = Math.max(1, Math.round(sessionDurationMs / sessionTimePerIncidentMs));
  const shareOfTheSessionMs = sessionDurationMs / incidentCount;

  const incidents: DrawnIncident[] = [];
  for (let occurrenceNumber = 1; occurrenceNumber <= incidentCount; occurrenceNumber += 1) {
    const shareStartMs = (occurrenceNumber - 1) * shareOfTheSessionMs;
    const momentDraw = drawForRace(seed, occurrenceNumber, 'incidentMoment');
    const atElapsedMs = Math.round(
      shareStartMs +
        shareOfTheSessionMs *
          scaleDrawBetween(momentDraw, earliestIncidentInItsShare, latestIncidentInItsShare),
    );
    const atRunningMs = convertElapsedTimeToRunningTime(atElapsedMs, flagSchedule);
    const carIndex = findCarStillInTheRace(settings, occurrenceNumber, atRunningMs);
    if (carIndex === undefined) {
      continue;
    }

    const isPenalty =
      occurrenceNumber === 1 ||
      drawForRace(seed, occurrenceNumber, 'incidentIsPenalty') < penaltyShareAfterTheFirst;
    const reasonCount = isPenalty
      ? ptBR.simulatorIncidents.penalties.length
      : ptBR.simulatorIncidents.warnings.length;
    const reasonIndex = Math.floor(
      drawForRace(seed, occurrenceNumber, 'incidentReason') * reasonCount,
    );
    incidents.push({
      occurrenceNumber,
      atElapsedMs,
      kind: isPenalty ? 'penalty' : 'warning',
      carIndex,
      reasonIndex,
    });
  }
  return incidents;
}

/**
 * The index of the car an incident goes to: the drawn car, or the next one in the grid
 * (wrapping round) when it had retired by then. Undefined when every car had retired.
 */
function findCarStillInTheRace(
  settings: EnduroSimulationSettings,
  occurrenceNumber: number,
  atRunningMs: number,
): number | undefined {
  const { seed, carCount, sessionDurationMs } = settings;
  const drawnCarIndex = Math.floor(drawForRace(seed, occurrenceNumber, 'incidentCar') * carCount);
  for (let step = 0; step < carCount; step += 1) {
    const carIndex = (drawnCarIndex + step) % carCount;
    const breakdown = drawBreakdownOfCar(seed, carIndex, sessionDurationMs);
    const hadRetiredByThen =
      breakdown?.kind === 'retirement' && breakdown.atRunningMs <= atRunningMs;
    if (!hadRetiredByThen) {
      return carIndex;
    }
  }
  return undefined;
}

/**
 * The incidents shape at the race state's moment: every drawn incident whose moment has
 * passed, oldest first, under the session's id. An incident's id is the session id plus
 * its number, so it never changes once listed and a restarted race (a new session id)
 * gives new ones. The moment (atMs) is left out: the race state has no wall clock, and
 * the inbox dates an event by when it was detected anyway.
 */
export function buildSimulatedIncidents(
  raceState: EnduroRaceState,
  sessionId: string,
  nowMs: number,
): IncidentsShape {
  const schedule = drawIncidentScheduleOfRace(raceState.settings);
  const incidentsThatHappened = schedule.filter(
    (incident) => incident.atElapsedMs <= raceState.elapsedSimulatedMs,
  );
  const entries: IncidentEntry[] = [];
  for (const incident of incidentsThatHappened) {
    const car = raceState.cars[incident.carIndex];
    if (car !== undefined) {
      entries.push(buildIncidentEntry(raceState, incident, car, sessionId));
    }
  }
  return { sessionId, updatedAtMs: nowMs, entries };
}

/** One listed incident: the car's team, the reason and penalty, the lap it was on. */
function buildIncidentEntry(
  raceState: EnduroRaceState,
  incident: DrawnIncident,
  car: CarRaceState,
  sessionId: string,
): IncidentEntry {
  const atRunningMs = convertElapsedTimeToRunningTime(incident.atElapsedMs, raceState.flagSchedule);
  // The laps the car had completed by then, plus the one it was running.
  const lapsCompletedByThen = car.lapCompletedAtRunningMs.filter(
    (completedAtMs) => completedAtMs <= atRunningMs,
  ).length;
  const entry: IncidentEntry = {
    incidentId: `${sessionId}-ocorrencia-${String(incident.occurrenceNumber)}`,
    carNumber: car.carNumber,
    teamName: car.teamName,
    schoolName: car.schoolName,
    kind: incident.kind,
    reason: readReasonOfIncident(incident),
    lap: lapsCompletedByThen + 1,
  };
  const penalty = ptBR.simulatorIncidents.penalties[incident.reasonIndex];
  if (incident.kind === 'penalty' && penalty !== undefined) {
    entry.penaltyText = penalty.penaltyText;
  }
  return entry;
}

/**
 * The reason's text from the catalog. The index was drawn within its kind's list, so it
 * is always there; the fallback only satisfies the compiler's check of a list read.
 */
function readReasonOfIncident(incident: DrawnIncident): string {
  const reasons = ptBR.simulatorIncidents;
  if (incident.kind === 'penalty') {
    return reasons.penalties[incident.reasonIndex]?.reason ?? reasons.warnings[0];
  }
  return reasons.warnings[incident.reasonIndex] ?? reasons.warnings[0];
}
