/**
 * Detecting events between two snapshots of one source (apps/server)
 *
 * What this module is for:
 *   The event inbox (BAJAOVRLAY-44) is fed by detectors: pure functions that compare a
 *   source's previous accepted snapshot with the new one and say what happened once in
 *   between. A new incident id (a penalty given), a better session best lap (a new
 *   fastest lap), another car in 1st place (a leader change). detectEventsBetweenSnapshots
 *   runs the three and applies the rules that keep them honest: a shape the previous
 *   snapshot did not have, or a session that changed, is a new baseline and fires nothing.
 *
 * What these tests prove, one row each:
 *   - A new incident fires once, with its car, reason and penalty in the payload.
 *   - The same incident in both snapshots fires nothing; so does a warning that was
 *     already there when a new penalty arrives (only the new one fires).
 *   - A session best that improves fires a fastest lap with the right car, time, text and
 *     lap number; a slower lap, or the same best again, fires nothing.
 *   - A leader change fires once; the same leader fires nothing.
 *   - A shape missing from the previous snapshot is a baseline: nothing fires, even
 *     though the new one lists incidents and a leader (a mapping just added, a source
 *     that sent nothing before).
 *   - A new session (a restarted simulated race) is a baseline too.
 *   - Event ids are deterministic: the same change detected twice gives the same ids.
 *
 * What these tests deliberately do not cover:
 *   - The baseline after a boot or after a source is turned on, which needs memory of
 *     what was seen: the detection's store tests (eventDetectionOnTheStore.test.ts).
 *   - Recording the events, their rules and statuses (the inbox's tests).
 */
import type { DataSnapshotShapes, DetectedEvent } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { detectEventsBetweenSnapshots } from './detectEventsBetweenSnapshots.js';
import {
  buildBlockingWarningOfCar38,
  buildIncidents,
  buildPositionsInOrder,
  buildPositionsWithCar31Leading,
  buildShapesWithCar31Leading,
  buildStartPenaltyOfCar47,
  detectedAtMs,
} from './raceSnapshots.testSupport.js';

/** The source every snapshot here comes from: the seeded simulator. */
const sourceId = 'simulador-enduro';

/** The event car 47's start penalty becomes. */
const startPenaltyEvent: DetectedEvent = {
  eventId: 'simulador-enduro:incident:ocorrencia-0007',
  kind: 'newIncident',
  sourceId,
  detectedAtMs,
  payload: {
    carNumber: 47,
    teamName: 'Carnaúba Baja',
    schoolName: 'UFERSA',
    noticeKind: 'penalty',
    reason: 'Queima de largada',
    penaltyText: '+30 segundos',
    lapNumber: 1,
  },
};

/** Car 38 takes the session's best with 4:38,100 on its lap 35, and leads. */
function buildShapesWithCar38LeadingOnANewBest(): DataSnapshotShapes {
  return {
    positions: buildPositionsInOrder([
      { carNumber: 38, laps: 35, bestLapMs: 278_100, bestLapNumber: 35 },
      { carNumber: 31, laps: 34, bestLapMs: 278_291, bestLapNumber: 29 },
      { carNumber: 47, laps: 33, bestLapMs: 280_496, bestLapNumber: 30 },
    ]),
  };
}

/** The race restarted: a new session id, car 38 ahead and car 47's penalty listed. */
function buildShapesOfTheRestartedRace(): DataSnapshotShapes {
  const restartedSessionId = 'enduro-2027-nacional-reinicio';
  const positions = buildPositionsInOrder([
    { carNumber: 38, laps: 1, bestLapMs: 290_000, bestLapNumber: 1 },
    { carNumber: 31, laps: 1, bestLapMs: 291_000, bestLapNumber: 1 },
  ]);
  const incidents = buildIncidents([buildStartPenaltyOfCar47()]);
  return {
    positions: { ...positions, sessionId: restartedSessionId },
    incidents: { ...incidents, sessionId: restartedSessionId },
  };
}

const detectionScenarios: Array<{
  name: string;
  previousShapes: DataSnapshotShapes;
  nextShapes: DataSnapshotShapes;
  expectedEvents: DetectedEvent[];
}> = [
  // The main case of the brief: the race direction gives a penalty; it appears once.
  {
    name: 'fires once for an incident the source had not listed',
    previousShapes: buildShapesWithCar31Leading([]),
    nextShapes: buildShapesWithCar31Leading([buildStartPenaltyOfCar47()]),
    expectedEvents: [startPenaltyEvent],
  },
  // The next poll lists the same penalty again: it was already news, so nothing fires.
  {
    name: 'fires nothing for an incident already listed',
    previousShapes: buildShapesWithCar31Leading([buildStartPenaltyOfCar47()]),
    nextShapes: buildShapesWithCar31Leading([buildStartPenaltyOfCar47()]),
    expectedEvents: [],
  },
  // A warning that was there stays quiet while the new penalty beside it fires.
  {
    name: 'fires only the new incident when an old one is still listed',
    previousShapes: buildShapesWithCar31Leading([buildBlockingWarningOfCar38()]),
    nextShapes: buildShapesWithCar31Leading([
      buildBlockingWarningOfCar38(),
      buildStartPenaltyOfCar47(),
    ]),
    expectedEvents: [startPenaltyEvent],
  },
  // A new session best: the notice needs the car, the time in words and the lap.
  // Car 38 also took the lead on that lap, so the leader change fires after it.
  {
    name: 'fires a fastest lap with its lap number when the session best improves',
    previousShapes: { positions: buildPositionsWithCar31Leading() },
    nextShapes: buildShapesWithCar38LeadingOnANewBest(),
    expectedEvents: [
      {
        eventId: 'simulador-enduro:fastestLap:enduro-2027-nacional:38:35',
        kind: 'fastestLap',
        sourceId,
        detectedAtMs,
        payload: {
          carNumber: 38,
          teamName: 'Coruja Racing',
          schoolName: 'EESC-USP',
          lapNumber: 35,
          lapTimeMs: 278_100,
          lapTimeText: '4:38,1',
        },
      },
      {
        eventId: 'simulador-enduro:leaderChanged:enduro-2027-nacional:38:35',
        kind: 'leaderChanged',
        sourceId,
        detectedAtMs,
        payload: {
          carNumber: 38,
          teamName: 'Coruja Racing',
          schoolName: 'EESC-USP',
          lapNumber: 35,
        },
      },
    ],
  },
  // Car 47 improves its own best, but not the session's: not a fastest lap of the race.
  {
    name: 'fires nothing for a lap slower than the session best',
    previousShapes: { positions: buildPositionsWithCar31Leading() },
    nextShapes: {
      positions: buildPositionsInOrder([
        { carNumber: 31, laps: 35, bestLapMs: 278_291, bestLapNumber: 29 },
        { carNumber: 38, laps: 34, bestLapMs: 279_596, bestLapNumber: 12 },
        { carNumber: 47, laps: 34, bestLapMs: 279_000, bestLapNumber: 34 },
      ]),
    },
    expectedEvents: [],
  },
  // Another car in 1st place, with no new best: one leader change, nothing else.
  {
    name: 'fires once when another car takes 1st place',
    previousShapes: { positions: buildPositionsWithCar31Leading() },
    nextShapes: {
      positions: buildPositionsInOrder([
        { carNumber: 38, laps: 35, bestLapMs: 279_596, bestLapNumber: 12 },
        { carNumber: 31, laps: 34, bestLapMs: 278_291, bestLapNumber: 29 },
        { carNumber: 47, laps: 33, bestLapMs: 280_496, bestLapNumber: 30 },
      ]),
    },
    expectedEvents: [
      {
        eventId: 'simulador-enduro:leaderChanged:enduro-2027-nacional:38:35',
        kind: 'leaderChanged',
        sourceId,
        detectedAtMs,
        payload: {
          carNumber: 38,
          teamName: 'Coruja Racing',
          schoolName: 'EESC-USP',
          lapNumber: 35,
        },
      },
    ],
  },
  // The same leader a lap later is no news.
  {
    name: 'fires nothing when the same car still leads',
    previousShapes: { positions: buildPositionsWithCar31Leading() },
    nextShapes: {
      positions: buildPositionsInOrder([
        { carNumber: 31, laps: 35, bestLapMs: 278_291, bestLapNumber: 29 },
        { carNumber: 38, laps: 35, bestLapMs: 279_596, bestLapNumber: 12 },
        { carNumber: 47, laps: 34, bestLapMs: 280_496, bestLapNumber: 30 },
      ]),
    },
    expectedEvents: [],
  },
  // The baseline: the previous snapshot had no incidents and no positions (the source
  // just started sending them), so what the new one lists is history, not news.
  {
    name: 'fires nothing for shapes the previous snapshot did not have',
    previousShapes: {},
    nextShapes: buildShapesWithCar31Leading([buildStartPenaltyOfCar47()]),
    expectedEvents: [],
  },
  // "Reiniciar corrida": a new session whose leader and incidents are not changes of the
  // old race's.
  {
    name: 'fires nothing when the session changed',
    previousShapes: buildShapesWithCar31Leading([]),
    nextShapes: buildShapesOfTheRestartedRace(),
    expectedEvents: [],
  },
];

describe('detectEventsBetweenSnapshots', () => {
  it.each(detectionScenarios)('$name', ({ previousShapes, nextShapes, expectedEvents }) => {
    // Arrange: the previous and the new snapshot of this row, from the simulator.
    const moment = { sourceId, detectedAtMs };

    // Act: detect what happened between them.
    const events = detectEventsBetweenSnapshots(previousShapes, nextShapes, moment);

    // Assert: exactly this row's events, in detection order.
    expect(events, 'the detected events must be exactly these').toEqual(expectedEvents);
  });

  it('gives the same event ids when the same change is detected again', () => {
    // Arrange: a change with all three kinds at once: a penalty, a new best and a new leader.
    const previousShapes = buildShapesWithCar31Leading([]);
    const nextShapes = {
      ...buildShapesWithCar38LeadingOnANewBest(),
      incidents: buildIncidents([buildStartPenaltyOfCar47()]),
    };

    // Act: detect it twice, the second time a minute later (after a restart, say).
    const firstIds = detectEventsBetweenSnapshots(previousShapes, nextShapes, {
      sourceId,
      detectedAtMs,
    }).map((event) => event.eventId);
    const secondIds = detectEventsBetweenSnapshots(previousShapes, nextShapes, {
      sourceId,
      detectedAtMs: detectedAtMs + 60_000,
    }).map((event) => event.eventId);

    // Assert: the ids name what happened, never when it was seen, so they match.
    expect(firstIds, 'three events: the penalty, the fastest lap and the leader').toEqual([
      'simulador-enduro:incident:ocorrencia-0007',
      'simulador-enduro:fastestLap:enduro-2027-nacional:38:35',
      'simulador-enduro:leaderChanged:enduro-2027-nacional:38:35',
    ]);
    expect(secondIds, 'the same change must give the same ids').toEqual(firstIds);
  });
});
