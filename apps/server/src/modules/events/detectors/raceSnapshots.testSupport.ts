/**
 * Test support for the detectors' tests: small, realistic snapshots of one enduro, three
 * cars and a few incidents, built fresh by each call so a test can change one thing.
 */
import type {
  DataSnapshotShapes,
  IncidentEntry,
  IncidentsShape,
  PositionEntry,
  PositionsShape,
} from '@bajaovrlay/shared';

/** The session every snapshot here belongs to. */
export const enduroSessionId = 'enduro-2027-nacional';

/** 14:10:00 UTC on 14 August 2027: when the poll after the earlier one was accepted. */
export const detectedAtMs = Date.parse('2027-08-14T14:10:00.000Z');

/** One car of the three, with its best lap. */
type CarAtTheMoment = Pick<PositionEntry, 'carNumber' | 'laps' | 'bestLapMs' | 'bestLapNumber'>;

const teamsByCarNumber: Record<number, { teamName: string; schoolName: string }> = {
  31: { teamName: 'Acauã Baja', schoolName: 'Mauá' },
  38: { teamName: 'Coruja Racing', schoolName: 'EESC-USP' },
  47: { teamName: 'Carnaúba Baja', schoolName: 'UFERSA' },
};

/**
 * Positions of the three cars in the order given (the first one leads), each on its own
 * laps with its own best lap. No gaps: the detectors do not read them.
 */
export function buildPositionsInOrder(cars: CarAtTheMoment[]): PositionsShape {
  return {
    sessionId: enduroSessionId,
    updatedAtMs: detectedAtMs,
    entries: cars.map((car, index) => {
      const team = teamsByCarNumber[car.carNumber] ?? { teamName: 'Equipe', schoolName: 'UF' };
      const entry: PositionEntry = {
        position: index + 1,
        carNumber: car.carNumber,
        teamName: team.teamName,
        schoolName: team.schoolName,
        laps: car.laps,
        status: 'running',
      };
      if (car.bestLapMs !== undefined) {
        entry.bestLapMs = car.bestLapMs;
      }
      if (car.bestLapNumber !== undefined) {
        entry.bestLapNumber = car.bestLapNumber;
      }
      return entry;
    }),
  };
}

/**
 * Mid-race: car 31 leads on lap 34 with the session's best, 4:38,291 set on lap 29; car 38
 * is 2nd (best 4:39,596 on lap 12); car 47 3rd (best 4:40,496 on lap 30).
 */
export function buildPositionsWithCar31Leading(): PositionsShape {
  return buildPositionsInOrder([
    { carNumber: 31, laps: 34, bestLapMs: 278_291, bestLapNumber: 29 },
    { carNumber: 38, laps: 34, bestLapMs: 279_596, bestLapNumber: 12 },
    { carNumber: 47, laps: 33, bestLapMs: 280_496, bestLapNumber: 30 },
  ]);
}

/** Car 47's start penalty, as the race direction listed it. */
export function buildStartPenaltyOfCar47(): IncidentEntry {
  return {
    incidentId: 'ocorrencia-0007',
    carNumber: 47,
    teamName: 'Carnaúba Baja',
    schoolName: 'UFERSA',
    kind: 'penalty',
    reason: 'Queima de largada',
    penaltyText: '+30 segundos',
    lap: 1,
  };
}

/** Car 38's warning for blocking, with no penalty. */
export function buildBlockingWarningOfCar38(): IncidentEntry {
  return {
    incidentId: 'ocorrencia-0012',
    carNumber: 38,
    teamName: 'Coruja Racing',
    schoolName: 'EESC-USP',
    kind: 'warning',
    reason: 'Bloqueio de ultrapassagem',
    lap: 9,
  };
}

/** The incidents list of the session with these entries. */
export function buildIncidents(entries: IncidentEntry[]): IncidentsShape {
  return { sessionId: enduroSessionId, updatedAtMs: detectedAtMs, entries };
}

/** A snapshot's shapes with car 31 leading and the given incidents. */
export function buildShapesWithCar31Leading(incidents: IncidentEntry[]): DataSnapshotShapes {
  return {
    positions: buildPositionsWithCar31Leading(),
    incidents: buildIncidents(incidents),
  };
}
