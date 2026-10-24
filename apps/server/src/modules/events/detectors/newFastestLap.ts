// The detector of a new fastest lap: the session's best lap got better.
import type { DetectedEvent, PositionEntry, PositionsShape } from '@bajaovrlay/shared';
import { writeLapTimeAsText } from '@bajaovrlay/shared/raceTimeText';

import type { EventDetectionMoment } from './eventDetectionMoment.js';

/**
 * Lists one fastestLap event when the session's best lap in `next` is faster than in
 * `previous`, or when `previous` had no best lap at all (the first laps of the race).
 * A lap equal to the best, or slower, fires nothing. The car is the one holding the new
 * best; on a tie, the one listed higher.
 * The event id is `<sourceId>:fastestLap:<sessionId>:<carNumber>:<lap>`, the lap being
 * the car's bestLapNumber, or `t<bestLapMs>` when the source does not say which lap.
 */
export function detectNewFastestLap(
  previous: PositionsShape,
  next: PositionsShape,
  moment: EventDetectionMoment,
): DetectedEvent[] {
  const previousBest = findHolderOfTheBestLap(previous);
  const nextBest = findHolderOfTheBestLap(next);
  if (nextBest?.bestLapMs === undefined) {
    return [];
  }
  const hasImproved =
    previousBest?.bestLapMs === undefined || nextBest.bestLapMs < previousBest.bestLapMs;
  if (!hasImproved) {
    return [];
  }
  return [buildFastestLapEvent(next.sessionId, nextBest, nextBest.bestLapMs, moment)];
}

/** The entry holding the session's best lap (the first of a tie), or undefined with none. */
function findHolderOfTheBestLap(positions: PositionsShape): PositionEntry | undefined {
  let holder: PositionEntry | undefined;
  for (const entry of positions.entries) {
    if (entry.bestLapMs === undefined) {
      continue;
    }
    if (holder?.bestLapMs === undefined || entry.bestLapMs < holder.bestLapMs) {
      holder = entry;
    }
  }
  return holder;
}

/** The event of a new fastest lap: the car, the time in ms and as text, the lap. */
function buildFastestLapEvent(
  sessionId: string,
  holder: PositionEntry,
  bestLapMs: number,
  moment: EventDetectionMoment,
): DetectedEvent {
  const lapPart =
    holder.bestLapNumber === undefined ? `t${String(bestLapMs)}` : String(holder.bestLapNumber);
  const event: DetectedEvent = {
    eventId: `${moment.sourceId}:fastestLap:${sessionId}:${String(holder.carNumber)}:${lapPart}`,
    kind: 'fastestLap',
    sourceId: moment.sourceId,
    detectedAtMs: moment.detectedAtMs,
    payload: {
      carNumber: holder.carNumber,
      teamName: holder.teamName,
      schoolName: holder.schoolName,
      lapTimeMs: bestLapMs,
      lapTimeText: writeLapTimeAsText(bestLapMs),
    },
  };
  if (holder.bestLapNumber !== undefined) {
    event.payload.lapNumber = holder.bestLapNumber;
  }
  return event;
}
