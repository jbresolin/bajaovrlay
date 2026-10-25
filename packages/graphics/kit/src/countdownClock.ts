/**
 * The countdown on air (BAJAOVRLAY-46), for the countdown card, the waiting screen and the
 * intermission's next-session card: the count to `startsAtMs` written on every animation
 * frame at the server-aligned "now", until it reaches "0:00", where it stops by itself (it
 * never counts negative). A start moved by a refresh is followed at the next redraw, and a
 * graphic starts the ticking again after such an update, so a later start counts again.
 * The loop is the kit's clockTicker: stopping cancels the pending frame, so nothing runs
 * in OBS after stop, dispose or removal from the page.
 */
import { readServerAlignedTimeMs } from '@bajaovrlay/shared/clock';

import { type ClockTicker, createClockTicker } from './clockTicker.js';
import { hasCountdownReachedZeroAt, writeCountdownTextAt } from './countdownText.js';

/** What the countdown needs from its graphic; the readers are called anew every frame. */
export type CountdownClockOptions = {
  /** The start counted down to; undefined before load. */
  readStartsAtMs: () => number | undefined;
  /** Writes the count where the graphic shows it (writeTextIfChanged, so once a second). */
  writeCountText: (countText: string) => void;
  /** requestAnimationFrame and cancelAnimationFrame in a graphic. */
  requestFrame: (callback: () => void) => number;
  cancelFrame: (frameId: number) => void;
  /** "Now"; left out, the server-aligned clock (tests pass their own). */
  readNowMs?: () => number;
};

/** The countdown of one graphic. */
export type CountdownClock = {
  /** Writes the count as it is now; at zero, stops the ticking. Nothing before load. */
  redraw: () => void;
  /** Writes the count and redraws it every frame until zero; a second start does nothing. */
  startTicking: () => void;
  /** Stops the frame loop, cancelling the pending frame (stop, dispose, removal). */
  stopTicking: () => void;
  /** Whether a frame is booked: false once stopped or at zero. */
  isTicking: () => boolean;
};

/** Creates the countdown of a graphic, its frame loop stopped. */
export function createCountdownClock(options: CountdownClockOptions): CountdownClock {
  const readNowMs = options.readNowMs ?? readServerAlignedTimeMs;
  let isTickingNow = false;

  /** Writes the count; answers whether it has reached zero (true before load too). */
  function writeCountNow(): boolean {
    const startsAtMs = options.readStartsAtMs();
    if (startsAtMs === undefined) {
      return true;
    }
    const nowMs = readNowMs();
    options.writeCountText(writeCountdownTextAt(startsAtMs, nowMs));
    return hasCountdownReachedZeroAt(startsAtMs, nowMs);
  }

  function stopTicking(): void {
    isTickingNow = false;
    clockTicker.stop();
  }

  function redrawOnAFrame(): void {
    const hasReachedZero = writeCountNow();
    if (hasReachedZero) {
      stopTicking();
    }
  }

  const clockTicker: ClockTicker = createClockTicker({
    onFrame: redrawOnAFrame,
    requestFrame: options.requestFrame,
    cancelFrame: options.cancelFrame,
  });

  function redraw(): void {
    const hasReachedZero = writeCountNow();
    if (hasReachedZero && isTickingNow) {
      stopTicking();
    }
  }

  function startTicking(): void {
    if (isTickingNow) {
      return;
    }
    const hasReachedZero = writeCountNow();
    if (hasReachedZero) {
      return;
    }
    isTickingNow = true;
    clockTicker.start();
  }

  return { redraw, startTicking, stopTicking, isTicking: () => isTickingNow };
}
