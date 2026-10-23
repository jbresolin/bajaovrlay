// Runs every detector over one change of a source's snapshot, with the rules that make a
// change a baseline instead of news.
import type { DataSnapshotShapes, DetectedEvent } from '@bajaovrlay/shared';

import type { EventDetectionMoment } from './eventDetectionMoment.js';
import { detectLeaderChange } from './leaderChanged.js';
import { detectNewFastestLap } from './newFastestLap.js';
import { detectNewIncidents } from './newIncident.js';

/**
 * The events between a source's previous accepted snapshot and its new one, in this
 * order: new incidents, then a new fastest lap, then a leader change (the runner shows
 * one layer's events in this order). Pure.
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

  return events;
}
