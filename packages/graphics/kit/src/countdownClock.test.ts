/**
 * The countdown on air (packages/graphics/kit)
 *
 * What this module is for:
 *   The countdown card, the waiting screen and the intermission's next-session card count
 *   down to `startsAtMs` by themselves (BAJAOVRLAY-46, decided): every animation frame
 *   while on air, the count is written at the server-aligned "now", so nothing has to be
 *   recomputed at the take and a refreshed start simply moves the target. At zero it shows
 *   "0:00" and stops; it never counts negative. The frame loop is the kit's clockTicker,
 *   so stopping it cancels the pending frame and nothing runs inside OBS after stop.
 *
 * What these tests prove (hand-driven frames, a hand-set "now"):
 *   - Started, it writes the count at once (so play never shows a stale number) and then on
 *     every frame as the clock moves.
 *   - At the start it writes "0:00" and stops by itself: no frame is booked after it.
 *   - Started at or after the start, it writes "0:00" and books no frame at all.
 *   - A start moved later (the schedule edited) is followed: once ticking again, the count
 *     reads the new start.
 *   - Stopping cancels the pending frame, and no write happens after.
 *   - Left without its own "now", it reads the server-aligned one: with the server 30 s
 *     ahead of this machine, the count is 30 s shorter.
 *
 * What these tests deliberately do not cover:
 *   - The count's text itself; countdownText.test.ts.
 *   - The graphics' lifecycles; each graphic's own tests stop it on stop, dispose and
 *     removal from the page.
 */
import {
  forgetTheServerClockAlignment,
  lineUpWithTheServerClockAt,
  readThisMachineMonotonicTimeMs,
} from '@bajaovrlay/shared/clock';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { createCountdownClock } from './countdownClock.js';

/** The enduro's start: Sunday 30 March 2025, 10:00 in Brasília (UTC−3). */
const enduroStartsAtMs = Date.parse('2025-03-30T10:00:00.000-03:00');

/** Hand-driven frames: a frame runs only when the test says, cancellations remembered. */
function createHandDrivenAnimationFrames() {
  const pendingCallbacks = new Map<number, () => void>();
  const cancelledFrameIds: number[] = [];
  let lastFrameId = 0;
  return {
    pendingCallbacks,
    cancelledFrameIds,
    requestFrame(callback: () => void): number {
      lastFrameId += 1;
      pendingCallbacks.set(lastFrameId, callback);
      return lastFrameId;
    },
    cancelFrame(frameId: number): void {
      cancelledFrameIds.push(frameId);
      pendingCallbacks.delete(frameId);
    },
    runNextFrame(): void {
      const [frameId, callback] = [...pendingCallbacks.entries()][0] ?? [];
      if (frameId === undefined || callback === undefined) {
        throw new Error('no frame is pending');
      }
      pendingCallbacks.delete(frameId);
      callback();
    },
  };
}

/** A countdown to the enduro on hand-driven frames, with "now" set by the test. */
function createCountdownToTheEnduro(startingSecondsBefore: number) {
  const frames = createHandDrivenAnimationFrames();
  const writtenTexts: string[] = [];
  const clock = { nowMs: enduroStartsAtMs - startingSecondsBefore * 1000 };
  const target = { startsAtMs: enduroStartsAtMs };
  const countdown = createCountdownClock({
    readStartsAtMs: () => target.startsAtMs,
    writeCountText: (countText) => writtenTexts.push(countText),
    requestFrame: frames.requestFrame,
    cancelFrame: frames.cancelFrame,
    readNowMs: () => clock.nowMs,
  });
  return { countdown, frames, writtenTexts, clock, target };
}

describe('createCountdownClock', () => {
  it('writes the count on every frame as the clock moves', () => {
    // Arrange: 23 min 45 s to go, the countdown started.
    const { countdown, frames, writtenTexts, clock } = createCountdownToTheEnduro(1425);
    countdown.startTicking();

    // Act: two frames, a second apart.
    frames.runNextFrame();
    clock.nowMs += 1000;
    frames.runNextFrame();

    // Assert: the count written at the start, then each frame, a second less the second time.
    expect(writtenTexts, 'the count follows the clock').toEqual(['23:45', '23:45', '23:44']);
  });

  it('writes 0:00 at the start and stops by itself', () => {
    // Arrange: one second to go, the countdown started.
    const { countdown, frames, writtenTexts, clock } = createCountdownToTheEnduro(1);
    countdown.startTicking();

    // Act: a frame at one second, then one at the start.
    frames.runNextFrame();
    clock.nowMs += 1000;
    frames.runNextFrame();

    // Assert: 0:01 (at the start and on the first frame), then 0:00, and no frame after it.
    expect(writtenTexts, 'the count reaches 0:00').toEqual(['0:01', '0:01', '0:00']);
    expect(frames.pendingCallbacks.size, 'nothing runs after zero').toBe(0);
    expect(countdown.isTicking(), 'the countdown says it stopped').toBe(false);
  });

  it('writes 0:00 and books no frame when started after the start', () => {
    // Arrange: the item taken a minute late.
    const { countdown, frames, writtenTexts } = createCountdownToTheEnduro(-60);

    // Act: start it.
    countdown.startTicking();

    // Assert: 0:00 at once, never a negative count, and no loop.
    expect(writtenTexts, 'a late countdown shows 0:00').toEqual(['0:00']);
    expect(frames.pendingCallbacks.size, 'no frame is booked').toBe(0);
  });

  it('follows a start moved later once it ticks again', () => {
    // Arrange: the countdown reached zero at 10:00.
    const { countdown, frames, writtenTexts, target } = createCountdownToTheEnduro(0);
    countdown.startTicking();

    // Act: the schedule moves the start ten minutes later; the graphic redraws and starts
    // ticking again, as its update does; one frame runs.
    target.startsAtMs = enduroStartsAtMs + 600_000;
    countdown.redraw();
    countdown.startTicking();
    frames.runNextFrame();

    // Assert: 0:00, then 10:00 to go from the new start (the redraw, the start, the frame).
    expect(writtenTexts, 'the new target is followed').toEqual(['0:00', '10:00', '10:00', '10:00']);
    expect(countdown.isTicking(), 'it counts again').toBe(true);
  });

  it('cancels the pending frame when stopped, and writes nothing after', () => {
    // Arrange: the countdown started and one frame run.
    const { countdown, frames, writtenTexts } = createCountdownToTheEnduro(1425);
    countdown.startTicking();
    frames.runNextFrame();

    // Act: stop it.
    countdown.stopTicking();

    // Assert: the frame booked after the first is cancelled; no frame is left; the writes
    // are the start's and the one frame's.
    expect(frames.cancelledFrameIds, 'the pending frame is cancelled').toEqual([2]);
    expect(frames.pendingCallbacks.size, 'nothing keeps running in OBS').toBe(0);
    expect(writtenTexts, 'no write after the stop').toEqual(['23:45', '23:45']);
  });

  it('reads the server-aligned now when given none of its own', () => {
    // Arrange: this machine's clock at 09:30:00; the server's 30 s ahead of it.
    vi.useFakeTimers();
    vi.setSystemTime(enduroStartsAtMs - 1_800_000);
    onTestFinished(() => {
      vi.useRealTimers();
      forgetTheServerClockAlignment();
    });
    lineUpWithTheServerClockAt(Date.now() + 30_000, readThisMachineMonotonicTimeMs());
    const writtenTexts: string[] = [];
    const countdown = createCountdownClock({
      readStartsAtMs: () => enduroStartsAtMs,
      writeCountText: (countText) => writtenTexts.push(countText),
      requestFrame: () => 1,
      cancelFrame: () => undefined,
    });

    // Act: draw the count once.
    countdown.redraw();

    // Assert: 29:30 to go on the server's clock, not 30:00 on this machine's.
    expect(writtenTexts, 'the count runs on the server’s clock').toEqual(['29:30']);
  });
});
