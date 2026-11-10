// Runs every detector over one change of a source's snapshot, with the rules that make a
// change a baseline instead of news.
import type { DataSnapshotShapes, DetectedEvent } from '@bajaovrlay/shared';

import type { EventDetectionMoment } from './eventDetectionMoment.js';
import { detectLeaderChange } from './leaderChanged.js';
import { detectNewFastestLap } from './newFastestLap.js';
import { detectNewIncidents } from './newIncident.js';
import { detectNewSuperChats } from './newSuperChat.js';

/**
 * The events between a source's previous accepted snapshot and its new one, in this
 * order: new incidents, then a new fastest lap, then a leader change (the runner shows
 * one layer's events in this order), then new Super Chats (BAJAOVRLAY-35). Pure.
 * Each shape is compared only when both snapshots have it and both belong to the same
 * session. Otherwise the new shape is a baseline and fires nothing:
 * - a shape the previous snapshot did not have (a mapping just added, a source that sent
 *   nothing before) lists what already happened, not what just happened;
 * - a new session (another race, "Reiniciar corrida") is not a change of the old one.
 * What could go wrong: a source that drops a shape for one poll and sends it again makes
 * that poll a baseline, so an incident given in between is never detected.
 */
export function detectEventsBetweenSnapshots(
  previousShapes: DataSnapshotShapes,
  nextShapes: DataSnapshotShapes,
  moment: EventDetectionMoment,
): DetectedEvent[] {
  const events: DetectedEvent[] = [];

  const previousIncidents = previousShapes.incidents;
  const nextIncidents = nextShapes.incidents;
  if (
    previousIncidents !== undefined &&
    nextIncidents !== undefined &&
    previousIncidents.sessionId === nextIncidents.sessionId
  ) {
    events.push(...detectNewIncidents(previousIncidents, nextIncidents, moment));
  }

  const previousPositions = previousShapes.positions;
  const nextPositions = nextShapes.positions;
  if (
    previousPositions !== undefined &&
    nextPositions !== undefined &&
    previousPositions.sessionId === nextPositions.sessionId
  ) {
    events.push(...detectNewFastestLap(previousPositions, nextPositions, moment));
    events.push(...detectLeaderChange(previousPositions, nextPositions, moment));
  }

  // Super Chats have no session, and a missing previous answer is not a plain baseline:
  // the detector's own first-poll window decides (newSuperChat.ts).
  const nextSuperChats = nextShapes.superChats;
  if (nextSuperChats !== undefined) {
    events.push(...detectNewSuperChats(previousShapes.superChats, nextSuperChats, moment));
  }

  return events;
}

/**
 * The events of a source's first snapshot, which is otherwise a baseline (see
 * eventDetection.ts): only the Super Chats of the last 15 minutes, so a viewer who paid
 * just before the source was switched on is not lost. Every race shape fires nothing. Pure.
 */
export function detectEventsInAFirstSnapshot(
  firstShapes: DataSnapshotShapes,
  moment: EventDetectionMoment,
): DetectedEvent[] {
  if (firstShapes.superChats === undefined) {
    return [];
  }
  return detectNewSuperChats(undefined, firstShapes.superChats, moment);
}
