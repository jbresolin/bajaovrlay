// The detector of new incidents: an incident id the previous snapshot did not list.
import type { DetectedEvent, IncidentEntry, IncidentsShape } from '@bajaovrlay/shared';

import type { EventDetectionMoment } from './eventDetectionMoment.js';

/**
 * Lists one newIncident event per incident of `next` whose id `previous` did not list,
 * in the order `next` lists them. An incident that changed its text but kept its id is
 * the same incident and fires nothing (the notice already showed it, or will).
 * The event id is `<sourceId>:incident:<incidentId>`: the source's own id, so the same
 * incident seen again after a restart is the same event.
 */
export function detectNewIncidents(
  previous: IncidentsShape,
  next: IncidentsShape,
  moment: EventDetectionMoment,
): DetectedEvent[] {
  const incidentIdsListedBefore = new Set(previous.entries.map((entry) => entry.incidentId));
  const newIncidents = next.entries.filter(
    (entry) => !incidentIdsListedBefore.has(entry.incidentId),
  );
  return newIncidents.map((incident) => buildNewIncidentEvent(incident, moment));
}

/** The event of one new incident: the car, what it is, why, the penalty and the lap. */
function buildNewIncidentEvent(
  incident: IncidentEntry,
  moment: EventDetectionMoment,
): DetectedEvent {
  const event: DetectedEvent = {
    eventId: `${moment.sourceId}:incident:${incident.incidentId}`,
    kind: 'newIncident',
    sourceId: moment.sourceId,
    detectedAtMs: moment.detectedAtMs,
    payload: {
      carNumber: incident.carNumber,
      teamName: incident.teamName,
      schoolName: incident.schoolName,
      noticeKind: incident.kind,
      reason: incident.reason,
    },
  };
  if (incident.penaltyText !== undefined) {
    event.payload.penaltyText = incident.penaltyText;
  }
  if (incident.lap !== undefined) {
    event.payload.lapNumber = incident.lap;
  }
  return event;
}
