import type { InboxEvent, RecordDetectedEventsCommand } from '@bajaovrlay/shared';

import type {
  ReducerOutcome,
  SlicesChangedByCommands,
} from '../../../core/store/reducers/reducerTypes.js';
import {
  appendInboxEvents,
  findInboxEvent,
  findRuleOfKind,
  findStatusOfNewEvent,
} from './inboxEventChanges.js';

/**
 * recordDetectedEvents (the event detection, `sistema:eventos`): lists each detected
 * event in the inbox, queued when its rule says auto (the runner takes it from there) and
 * pending when it says ask, dated by its detection. Skipped, with no trace:
 * - an event whose id the inbox already holds: the same happening seen again (a source
 *   sending an old incident again, a poll after a restart) is never listed twice;
 * - an event whose rule says ignore: nothing listed, nothing logged.
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
    const status = findStatusOfNewEvent(rule);
    newEvents.push({
      ...detectedEvent,
      status,
      statusChanges: [{ status, atMs: detectedEvent.detectedAtMs }],
    });
  }

  if (newEvents.length === 0) {
    return { status: 'applied', slices };
  }
  return {
    status: 'applied',
    slices: { ...slices, events: appendInboxEvents(slices.events, newEvents) },
  };
}
