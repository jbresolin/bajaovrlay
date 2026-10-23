// The detector of a leader change: another car in 1st place.
import type { DetectedEvent, PositionsShape } from '@bajaovrlay/shared';

import type { EventDetectionMoment } from './eventDetectionMoment.js';

/**
 * Lists one leaderChanged event when the car in 1st place of `next` is not the one of
 * `previous`. An empty list on either side fires nothing.
 * The event id is `<sourceId>:leaderChanged:<sessionId>:<carNumber>:<laps>`: the new
 * leader and its laps, so a car that takes the lead, loses it and takes it back on a
 * later lap fires each time, while the same change seen twice is one event.
 * What could go wrong: two cars swapping the lead at every poll on the same lap fire only
 * the first swap of each car on that lap; the queue's gap makes more pointless anyway.
 */
export function detectLeaderChange(
  previous: PositionsShape,
  next: PositionsShape,
  moment: EventDetectionMoment,
): DetectedEvent[] {
  const previousLeader = previous.entries[0];
  const nextLeader = next.entries[0];
  if (previousLeader === undefined || nextLeader === undefined) {
    return [];
  }
  if (previousLeader.carNumber === nextLeader.carNumber) {
    return [];
  }
  const lapsPart = String(nextLeader.laps);
  const event: DetectedEvent = {
    eventId: `${moment.sourceId}:leaderChanged:${next.sessionId}:${String(nextLeader.carNumber)}:${lapsPart}`,
    kind: 'leaderChanged',
    sourceId: moment.sourceId,
    detectedAtMs: moment.detectedAtMs,
    payload: {
      carNumber: nextLeader.carNumber,
      teamName: nextLeader.teamName,
      schoolName: nextLeader.schoolName,
    },
  };
  // Before the first lap the leader has 0 laps, which is no lap to name.
  if (nextLeader.laps >= 1) {
    event.payload.lapNumber = nextLeader.laps;
  }
  return [event];
}
