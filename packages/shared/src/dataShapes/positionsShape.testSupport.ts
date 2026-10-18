/**
 * Test support for the positions shape tests: the payloads they start from. Each factory
 * builds a fresh copy, so a test can break one thing without touching another test.
 */
import { readFileSync } from 'node:fs';

/** The positions sample as plain JSON: an object whose entries can be changed one by one. */
export type PositionsSamplePayload = { entries: Array<Record<string, unknown>> } & Record<
  string,
  unknown
>;

/**
 * Reads the 60-car positions sample afresh, so each test can break one thing in its own
 * copy without touching the file or another test.
 */
export function readPositionsSample(): PositionsSamplePayload {
  const sampleUrl = new URL('./samples/positions.enduro-lap-34.json', import.meta.url);
  return JSON.parse(readFileSync(sampleUrl, 'utf8')) as PositionsSamplePayload;
}

/** A short positions payload at the start of the race: nobody has completed a lap yet. */
export function buildPositionsAtTheStart(): PositionsSamplePayload {
  return {
    sessionId: 'enduro-2027-nacional',
    updatedAtMs: 1_805_558_400_000,
    entries: [
      {
        position: 1,
        carNumber: 42,
        teamName: 'Carcará Baja',
        schoolName: 'UFPR',
        laps: 0,
        status: 'running',
      },
      {
        position: 2,
        carNumber: 7,
        teamName: 'Pequi Off-Road',
        schoolName: 'UFG',
        laps: 0,
        status: 'running',
      },
    ],
  };
}

/**
 * The 60-car sample with a disqualified car (car 77, 12 laps) listed at position 1. Every
 * other car moves down one place with its laps and gaps untouched, so those gaps are still
 * the ones measured from car 31 on 34 laps, now 2nd.
 */
export function buildPositionsWithDisqualifiedCarFirst(): PositionsSamplePayload {
  const positions = readPositionsSample();
  const disqualifiedCar = {
    position: 1,
    carNumber: 77,
    teamName: 'Gralha Azul Baja',
    schoolName: 'UTFPR',
    laps: 12,
    status: 'disqualified',
  };
  const carsMovedDownOnePlace = positions.entries.map((entry, index) => ({
    ...entry,
    position: index + 2,
  }));
  positions.entries = [disqualifiedCar, ...carsMovedDownOnePlace];
  return positions;
}

/** Returns a copy of one car with both of its gaps taken off, as a source that has none. */
export function withoutAnyGap(entry: Record<string, unknown> | undefined): Record<string, unknown> {
  const carWithoutGap = { ...entry };
  delete carWithoutGap.gapToLeaderMs;
  delete carWithoutGap.gapToLeaderLaps;
  return carWithoutGap;
}

/**
 * The index of the sample's last car. In the sample: the leader (car 31) and 2nd (car 38)
 * are on lap 34; 3rd to 9th are on lap 33, one lap down; 6th is car 52; 57th to 59th are
 * on lap 24; 60th (car 96) retired on lap 12.
 */
export const lastPlaceIndex = 59;
