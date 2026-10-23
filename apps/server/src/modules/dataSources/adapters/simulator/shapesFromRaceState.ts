// The four canonical shapes the simulator answers, built from the race state of one
// moment: session (flag and clock), positions (order and gaps), overall standings and
// the incidents of the simulated race direction.
import type {
  IncidentsShape,
  PositionsShape,
  SessionShape,
  StandingsShape,
} from '@bajaovrlay/shared';

import { ptBR } from '../../../../core/messages/ptBR.js';
import { buildPositionEntriesInRaceOrder, orderCarsByRacePosition } from './raceOrder.js';
import { buildSimulatedIncidents } from './simulatedIncidents.js';
import type { CarRaceState, EnduroRaceState } from './simulateEnduro.js';
import { buildOverallStandings } from './standingsFromRaceState.js';

/** What one simulator poll answers. */
export type SimulatedShapes = {
  session: SessionShape;
  positions: PositionsShape;
  standings: StandingsShape;
  incidents: IncidentsShape;
};

/**
 * Builds the session, positions, overall standings and incidents of the race state,
 * dated `nowMs` (the server's wall clock at the poll). `simulatedStartAtMs` is the
 * wall-clock moment the race started, when it has one; it names the session.
 */
export function buildShapesFromRaceState(
  raceState: EnduroRaceState,
  nowMs: number,
  simulatedStartAtMs?: number,
): SimulatedShapes {
  const sessionId = buildSimulatedSessionId(raceState.settings.seed, simulatedStartAtMs);
  const orderedCars = orderCarsByRacePosition(
    reportStatusesAsFinishersOnceTheSessionIsFinished(raceState),
  );
  const leaderLaps = orderedCars[0]?.lapCompletedAtRunningMs.length ?? 0;

  return {
    session: buildSession(raceState, sessionId, leaderLaps, nowMs),
    positions: {
      sessionId,
      updatedAtMs: nowMs,
      entries: buildPositionEntriesInRaceOrder(orderedCars),
    },
    standings: buildOverallStandings(raceState, nowMs),
    incidents: buildSimulatedIncidents(raceState, sessionId, nowMs),
  };
}

/**
 * One session id per race: the seed and the moment the race started. Two simulators with
 * different seeds are different races, and so is the same seed after "Reiniciar corrida"
 * (BAJAOVRLAY-44): the event inbox keys a fastest lap or a leader change by the session,
 * so the 3rd lap of a restarted race is a new event and not one already shown. A race
 * that never started is named by its seed alone.
 */
function buildSimulatedSessionId(seed: number, simulatedStartAtMs: number | undefined): string {
  const seedPart = `simulador-enduro-${String(seed)}`;
  if (simulatedStartAtMs === undefined) {
    return seedPart;
  }
  return `${seedPart}-${String(simulatedStartAtMs)}`;
}

/**
 * The cars as the positions report them. The positions shape has no "finished" status,
 * so once the session is finished every car that did not retire reads 'running', as the
 * cars that took the checkered flag already do: a car still in the pits or stopped then
 * is reported as finished like the others. Today's numbers (a pit stop of 4 min at most,
 * a repair of 15 min at most, 15 min of checkered flag) never leave one there; this
 * keeps it so if they change. Before the finish every status is reported as it is.
 */
function reportStatusesAsFinishersOnceTheSessionIsFinished(
  raceState: EnduroRaceState,
): CarRaceState[] {
  if (raceState.flag !== 'finished') {
    return raceState.cars;
  }
  return raceState.cars.map((car) => {
    const isLeftInThePitsOrStopped = car.status === 'inPit' || car.status === 'stopped';
    return isLeftInThePitsOrStopped ? { ...car, status: 'running' } : car;
  });
}

/**
 * The session: its flag, and its clock counting down the session's time in running
 * time. The clock stops during a red and once the time is up (it would only show 0:00);
 * between polls a client runs it at real speed (a clock reading has no speed), so at
 * speed 60 it jumps forward at each poll.
 */
function buildSession(
  raceState: EnduroRaceState,
  sessionId: string,
  leaderLaps: number,
  nowMs: number,
): SessionShape {
  const sessionDurationMs = raceState.settings.sessionDurationMs;
  const timeLeftMs = Math.max(0, sessionDurationMs - raceState.runningTimeMs);
  const isClockRunning = raceState.flag !== 'red' && timeLeftMs > 0;
  return {
    sessionId,
    eventName: ptBR.simulatorSession.eventName,
    sessionName: ptBR.simulatorSession.sessionName,
    sessionKind: 'enduro',
    state: raceState.flag,
    clock: {
      clockMode: 'remaining',
      referenceTimeMs: timeLeftMs,
      referenceWallClockMs: nowMs,
      running: isClockRunning,
    },
    scheduledDurationMs: sessionDurationMs,
    lapsCompletedByLeader: leaderLaps,
    updatedAtMs: nowMs,
  };
}
