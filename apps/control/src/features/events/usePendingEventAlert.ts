import { useEffect, useRef, useState } from 'react';

import { useIsConnectedToServer } from '@/state/ControlPageStateProvider';

import { playEventChime } from './eventChime';

/** How long the badge pulses after a new pending event arrives. */
const pulseDurationMs = 3_000;

/**
 * The alert of a new pending event: answers whether the "Eventos" badge pulses now, and
 * plays the chime (when `isEventSoundOn`) each time a pending event this page has not seen
 * yet arrives. It follows the events by id, not their count, so one arriving as another
 * leaves is still heard (gate 2 of PR #22). The pending events seen at the first connection
 * are the baseline: they are not news to a page that just opened. The ids seen are kept
 * across a reconnect, so an event that arrived while the line was down is heard once, and
 * the ones heard before are not heard again. What could go wrong: two new events in one
 * change chime once, which is enough.
 */
export function usePendingEventAlert(
  pendingEventIds: readonly string[],
  isEventSoundOn: boolean,
): boolean {
  const isConnected = useIsConnectedToServer();
  const pendingEventIdsSeen = useRef<Set<string> | null>(null);
  const [isPulsing, setIsPulsing] = useState(false);
  // One text for the effect to compare, so a new list with the same ids changes nothing.
  const pendingEventIdsText = pendingEventIds.join('\n');

  useEffect(() => {
    if (!isConnected) {
      return;
    }
    const pendingEventIdsNow = pendingEventIdsText === '' ? [] : pendingEventIdsText.split('\n');
    const idsSeenBefore = pendingEventIdsSeen.current;
    if (idsSeenBefore === null) {
      pendingEventIdsSeen.current = new Set(pendingEventIdsNow);
      return;
    }
    const newEventIds = pendingEventIdsNow.filter((eventId) => !idsSeenBefore.has(eventId));
    if (newEventIds.length === 0) {
      return;
    }
    for (const eventId of newEventIds) {
      idsSeenBefore.add(eventId);
    }
    setIsPulsing(true);
    if (isEventSoundOn) {
      playEventChime();
    }
  }, [isConnected, pendingEventIdsText, isEventSoundOn]);

  useEffect(() => {
    if (!isPulsing) {
      return;
    }
    const stopPulsingTimer = setTimeout(() => setIsPulsing(false), pulseDurationMs);
    return () => clearTimeout(stopPulsingTimer);
  }, [isPulsing]);

  return isPulsing;
}
