import type { DetectedEvent, InboxEvent, RecordDetectedEventsCommand } from '@bajaovrlay/shared';

import type {
  ReducerOutcome,
  SlicesChangedByCommands,
} from '../../../core/store/reducers/reducerTypes.js';
import {
  appendInboxEvents,
  changeStatusOfEvent,
  findInboxEvent,
  findRuleOfKind,
  listNewEvent,
} from './inboxEventChanges.js';

/**
 * recordDetectedEvents (the event detection, `sistema:eventos`): lists each detected
 * event in the inbox, queued when its rule says auto (the runner takes it from there) and
 * pending when it says ask, dated by its detection. Skipped, with no trace:
 * - an event whose id the inbox already holds: the same happening seen again (a source
 *   sending an old incident again, a poll after a restart) is never listed twice;
 * - an event whose rule says ignore: nothing listed, nothing logged.
 * A new fastest lap or leader change supersedes the older ones of the same kind and source
 * still queued: they expire at its detection, so an outdated "Volta mais rápida" never airs
 * after a better one (gate 2 of PR #22). Sessions are not compared: an older session's
 * queued event is outdated too.
 * While "Pausar gatilhos" is on, an event its rule would queue lands pending instead,
 * marked held by the pause (BAJAOVRLAY-73; listNewEvent).
 * When every event is skipped the slices come back unchanged, so the store writes no row.
 */
export function reduceRecordDetectedEvents(
  slices: SlicesChangedByCommands,
  command: RecordDetectedEventsCommand,
): ReducerOutcome {
  const newEvents: InboxEvent[] = [];
  for (const detectedEvent of command.events) {
    const isAlreadyListed =
      findInboxEvent(slices.events, detectedEvent.eventId) !== undefined ||
      newEvents.some((newEvent) => newEvent.eventId === detectedEvent.eventId);
    const rule = findRuleOfKind(slices.eventRules, detectedEvent.kind);
    if (isAlreadyListed || rule?.mode === 'ignore') {
      continue;
    }
    newEvents.push(listNewEvent(detectedEvent, rule, slices.triggerActivity.isPaused));
  }

  if (newEvents.length === 0) {
    return { status: 'applied', slices };
  }
  let eventsKept = slices.events;
  for (const newEvent of newEvents) {
    eventsKept = expireQueuedEventsSupersededBy(eventsKept, newEvent);
  }
  return {
    status: 'applied',
    slices: { ...slices, events: appendInboxEvents(eventsKept, newEvents) },
  };
}

// The kinds whose newer event makes an older one of its source old news.
const kindsSupersededByANewerEvent = new Set(['fastestLap', 'leaderChanged']);

/** The events with every queued one of the new event's kind and source expired. */
function expireQueuedEventsSupersededBy(
  events: InboxEvent[],
  newEvent: DetectedEvent,
): InboxEvent[] {
  if (!kindsSupersededByANewerEvent.has(newEvent.kind)) {
    return events;
  }
  return events.map((event) => {
    const isSuperseded =
      event.status === 'queued' &&
      event.kind === newEvent.kind &&
      event.sourceId === newEvent.sourceId;
    return isSuperseded ? changeStatusOfEvent(event, 'expired', newEvent.detectedAtMs) : event;
  });
}
