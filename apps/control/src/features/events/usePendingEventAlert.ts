import { useEffect, useRef, useState } from 'react';

import { useIsConnectedToServer } from '@/state/ControlPageStateProvider';

import { playEventChime } from './eventChime';

/** How long the badge pulses after a new pending event arrives. */
const pulseDurationMs = 3_000;

/**
 * The alert of a new pending event: answers whether the "Eventos" badge pulses now, and
 * plays the chime (when `isEventSoundOn`) each time the number of pending events goes up.
 * The first number seen once connected is the baseline, so the events already waiting
 * when the page opens (or reconnects) neither chime nor pulse: they are not news to this
 * page. What could go wrong: two events in one change chime once, which is enough.
 */
export function usePendingEventAlert(pendingEventCount: number, isEventSoundOn: boolean): boolean {
  const isConnected = useIsConnectedToServer();
  const countSeenBefore = useRef<number | null>(null);
  const [isPulsing, setIsPulsing] = useState(false);

  useEffect(() => {
    if (!isConnected) {
      countSeenBefore.current = null;
      return;
    }
    const countBefore = countSeenBefore.current;
    countSeenBefore.current = pendingEventCount;
    if (countBefore === null || pendingEventCount <= countBefore) {
      return;
    }
    setIsPulsing(true);
    if (isEventSoundOn) {
      playEventChime();
    }
  }, [isConnected, pendingEventCount, isEventSoundOn]);

  useEffect(() => {
    if (!isPulsing) {
      return;
    }
    const stopPulsingTimer = setTimeout(() => setIsPulsing(false), pulseDurationMs);
    return () => clearTimeout(stopPulsingTimer);
  }, [isPulsing]);

  return isPulsing;
}
