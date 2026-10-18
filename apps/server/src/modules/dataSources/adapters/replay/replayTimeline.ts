// The replay's timeline, as pure functions of the recording, the config and "now": which
// recorded line a replay answers, and how its shapes move onto today's timeline.
import {
  type ClockReading,
  computeClockTimeMsAtWallClock,
  type DataSnapshotShapes,
  type ReplayConfig,
} from '@bajaovrlay/shared';

import type { RecordingLine } from '../../recordingLine.js';

/** The line a replay answers now, and the recorded moment it was chosen for. */
export type ReplayedLine = {
  line: RecordingLine;
  /** The moment on the recording's timeline that corresponds to now. */
  targetAtMs: number;
  /** Whether a plain (not looping) replay has run past the end and keeps its last line. */
  isHeldAtTheEnd: boolean;
};

/** Where a replay stands on the recording's timeline at the moment of a poll. */
export type ReplayMoment = {
  /** The recorded moment that corresponds to now. */
  targetAtMs: number;
  /** The wall clock at the poll. */
  nowMs: number;
  /** Whether the replay has ended and holds its last line. */
  isHeldAtTheEnd: boolean;
};

/**
 * Chooses the line to answer at `nowMs`, for `lines` in recorded order (at least one):
 * 1. Wall time since the replay was turned on (replayStartedAtMs; never before it).
 * 2. How far into the recording that is: startOffsetMs + wall time × speed.
 * 3. Past the end: a looping replay starts again (that distance modulo the recording's
 *    length), a plain one stays at the end. A recording of one line has no length and
 *    always answers that line.
 * 4. The target is the first line's moment plus that distance; the answer is the latest
 *    line recorded at or before it, so nothing is shown before it happened.
 */
export function chooseRecordedLineToReplay(
  lines: RecordingLine[],
  config: ReplayConfig,
  nowMs: number,
): ReplayedLine {
  const firstLine = lines[0];
  const lastLine = lines.at(-1);
  if (firstLine === undefined || lastLine === undefined) {
    throw new Error('a replay needs a recording with at least one line');
  }
  // replayStartedAtMs is set every time the source is turned on (D5); a config without
  // it (never turned on) plays from its start offset, as if turned on right now.
  const replayStartedAtMs = config.replayStartedAtMs ?? nowMs;
  const wallTimeSinceTurnedOnMs = Math.max(0, nowMs - replayStartedAtMs);
  const recordingLengthMs = lastLine.atMs - firstLine.atMs;

  // How far in the replay would be on a recording with no end.
  const distanceIgnoringTheEndMs =
    (config.startOffsetMs ?? 0) + wallTimeSinceTurnedOnMs * config.speed;
  const isPastTheEnd = distanceIgnoringTheEndMs > recordingLengthMs;
  const canLoop = config.isLooping && recordingLengthMs > 0;
  const isHeldAtTheEnd = isPastTheEnd && !canLoop;
  // The same distance brought back inside the recording: looped round, or held at the end.
  let distanceAfterLoopOrHoldMs = distanceIgnoringTheEndMs;
  if (isPastTheEnd && canLoop) {
    distanceAfterLoopOrHoldMs = distanceIgnoringTheEndMs % recordingLengthMs;
  }
  if (isHeldAtTheEnd) {
    distanceAfterLoopOrHoldMs = recordingLengthMs;
  }
  const targetAtMs = firstLine.atMs + distanceAfterLoopOrHoldMs;

  let chosenLine = firstLine;
  for (const line of lines) {
    if (line.atMs <= targetAtMs) {
      chosenLine = line;
    }
  }
  return { line: chosenLine, targetAtMs, isHeldAtTheEnd };
}

/**
 * Moves recorded shapes onto today's timeline, without changing the ones given:
 * - every shape's updatedAtMs becomes now, so nothing reads Friday's data as old;
 * - the session clock shows at now what it showed at the replayed moment
 *   (computeClockTimeMsAtWallClock): its referenceWallClockMs moves by (now − targetAtMs);
 * - once a plain replay has ended, the clock is stopped at its last recorded value, so it
 *   does not count on between polls and jump back at each one.
 * What could go wrong: a ClockReading has no speed, so between two polls a running clock
 * counts at 1× and is set again at the next poll; at 10× it jumps forward at every poll.
 * Rehearsal-only, and as accurate as the poll interval.
 */
export function rewriteShapesOntoTheCurrentTimeline(
  shapes: DataSnapshotShapes,
  moment: ReplayMoment,
): DataSnapshotShapes {
  const { nowMs } = moment;
  const rewrittenShapes: DataSnapshotShapes = {};
  if (shapes.session !== undefined) {
    rewrittenShapes.session = {
      ...shapes.session,
      clock: moveClockOntoTheCurrentTimeline(shapes.session.clock, moment),
      updatedAtMs: nowMs,
    };
  }
  if (shapes.positions !== undefined) {
    rewrittenShapes.positions = { ...shapes.positions, updatedAtMs: nowMs };
  }
  if (shapes.standings !== undefined) {
    rewrittenShapes.standings = { ...shapes.standings, updatedAtMs: nowMs };
  }
  if (shapes.brackets !== undefined) {
    rewrittenShapes.brackets = { ...shapes.brackets, updatedAtMs: nowMs };
  }
  return rewrittenShapes;
}

/**
 * The recorded clock as it must read now: shifted so it shows at now what it showed at
 * the replayed moment, or, once the replay has ended, stopped at that value.
 */
function moveClockOntoTheCurrentTimeline(
  recordedClock: ClockReading,
  moment: ReplayMoment,
): ClockReading {
  if (moment.isHeldAtTheEnd) {
    return {
      ...recordedClock,
      referenceTimeMs: computeClockTimeMsAtWallClock(recordedClock, moment.targetAtMs),
      referenceWallClockMs: moment.nowMs,
      running: false,
    };
  }
  const timelineShiftMs = moment.nowMs - moment.targetAtMs;
  return {
    ...recordedClock,
    referenceWallClockMs: recordedClock.referenceWallClockMs + timelineShiftMs,
  };
}
