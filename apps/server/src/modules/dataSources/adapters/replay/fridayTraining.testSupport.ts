// Test support for the replay tests: Friday's training, recorded one line every two
// seconds for one minute from 13:00:00, as the recorder writes it. Each line holds the
// session (clock counting down from four hours) and the positions of two cars whose gap
// grows by one second per line, so a test can tell the lines apart by the gap. Every
// call builds new objects.
import type { PositionsShape, SessionShape } from '@bajaovrlay/shared';

import type { RecordingLine } from '../../recordingLine.js';

/** 13:00:00 UTC on Friday 13 August 2027: the first line of the recording. */
export const fridayAt1300Ms = Date.parse('2027-08-13T13:00:00.000Z');
/** The last line of the recording, one minute after the first. */
export const fridayAt1301Ms = fridayAt1300Ms + 60_000;
/** Four hours: the enduro's length, which the session clock counts down from. */
export const enduroDurationMs = 14_400_000;

/** The session of Friday's training at a moment: green flag, clock running down. */
export function buildFridaySessionAt(atMs: number): SessionShape {
  const elapsedMs = atMs - fridayAt1300Ms;
  return {
    sessionId: 'treino-2027-sexta',
    eventName: 'Baja SAE Brasil 2027 — Etapa Nacional',
    sessionName: 'Treino livre de sexta',
    sessionKind: 'enduro',
    state: 'green',
    clock: {
      clockMode: 'remaining',
      referenceTimeMs: enduroDurationMs - elapsedMs,
      referenceWallClockMs: atMs,
      running: true,
    },
    scheduledDurationMs: enduroDurationMs,
    lapsCompletedByLeader: 3,
    updatedAtMs: atMs,
  };
}

/**
 * The positions of Friday's training at a moment: "Acauã Baja" (car 31) leads "Baja
 * UFPR" (car 42) on the same lap, by one second more for every line since 13:00:00.
 */
export function buildFridayPositionsAt(atMs: number): PositionsShape {
  const gapToLeaderMs = 1_000 + (atMs - fridayAt1300Ms) / 2;
  return buildTwoCarPositions({ updatedAtMs: atMs, gapOfCar42Ms: gapToLeaderMs });
}

/**
 * Positions of two cars on lap 3: "Acauã Baja" (car 31) leads "Baja UFPR" (car 42) by
 * the given gap, dated at the given moment.
 */
export function buildTwoCarPositions(parts: {
  updatedAtMs: number;
  gapOfCar42Ms: number;
}): PositionsShape {
  return {
    sessionId: 'treino-2027-sexta',
    updatedAtMs: parts.updatedAtMs,
    entries: [
      {
        position: 1,
        carNumber: 31,
        teamName: 'Acauã Baja',
        schoolName: 'Mauá',
        laps: 3,
        status: 'running',
      },
      {
        position: 2,
        carNumber: 42,
        teamName: 'Baja UFPR',
        schoolName: 'UFPR',
        laps: 3,
        gapToLeaderMs: parts.gapOfCar42Ms,
        intervalMs: parts.gapOfCar42Ms,
        status: 'running',
      },
    ],
  };
}

/** One line of Friday's recording: the session and the positions at that moment. */
export function buildFridayLineAt(atMs: number): RecordingLine {
  return {
    atMs,
    shapes: { session: buildFridaySessionAt(atMs), positions: buildFridayPositionsAt(atMs) },
  };
}

/** Every line of Friday's recording: 31 lines, 13:00:00 to 13:01:00, two seconds apart. */
export function buildFridayRecordingLines(): RecordingLine[] {
  const lines: RecordingLine[] = [];
  for (let atMs = fridayAt1300Ms; atMs <= fridayAt1301Ms; atMs += 2_000) {
    lines.push(buildFridayLineAt(atMs));
  }
  return lines;
}
