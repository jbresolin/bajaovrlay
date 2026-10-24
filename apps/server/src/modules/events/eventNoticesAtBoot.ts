import type { InboxEvent, Instance } from '@bajaovrlay/shared';

import { changeStatusOfEvent, readMomentMs } from './reducers/inboxEventChanges.js';

/**
 * True for an instance an event put on air. The boot drops them (core's loadInitialSlices):
 * their auto-out lived in memory and is lost at a restart, so a notice would stay up for
 * good and the automatic queue would wait behind it forever (gate 2 of PR #22).
 */
export function isInstanceOfAnEvent(instance: Instance): boolean {
  return instance.eventId !== undefined;
}

/**
 * The events with every one still on air marked shown at the boot's moment, since the
 * boot has just taken every event's notice off the air; `wereAnyMarked` tells the boot to
 * save the events row again.
 */
export function markEventsOnAirAsShownAtBoot(
  events: InboxEvent[],
  isoMomentOfTheBoot: string,
): { events: InboxEvent[]; wereAnyMarked: boolean } {
  const bootMs = readMomentMs(isoMomentOfTheBoot);
  const wereAnyMarked = events.some((event) => event.status === 'onAir');
  if (!wereAnyMarked) {
    return { events, wereAnyMarked };
  }
  return {
    events: events.map((event) =>
      event.status === 'onAir' ? changeStatusOfEvent(event, 'shown', bootMs) : event,
    ),
    wereAnyMarked,
  };
}
