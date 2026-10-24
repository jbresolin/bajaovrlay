/**
 * Clock ticker (packages/graphics/kit)
 *
 * What this module is for:
 *   While a graphic with a running clock is on air (the race clock, and the clock block of
 *   the lower strip and the message ticker), its text is redrawn once per animation frame
 *   (requestAnimationFrame). The ticker owns that loop: start it, and it calls back on
 *   every frame; stop it, and the pending frame is cancelled. A loop that survives
 *   `dispose` would keep burning CPU inside OBS after the graphic is gone.
 *
 * What these tests prove:
 *   - Once started, the ticker calls back on every frame, one frame after another.
 *   - Starting twice does not run two loops side by side.
 *   - Stopping cancels the exact frame that was pending, and no callback happens after.
 *
 * What these tests deliberately do not cover:
 *   - The real requestAnimationFrame; a hand-driven fake stands in so frames happen
 *     exactly when the test says. The Playwright tests run the real one.
 */
import { describe, expect, it } from 'vitest';

import { createClockTicker } from './clockTicker.js';

/**
 * Builds a requestAnimationFrame stand-in that runs frames only when the test calls
 * `runNextFrame`, and remembers which frames were cancelled.
 */
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
      const callbacksDueNow = [...pendingCallbacks.entries()];
      pendingCallbacks.clear();
      for (const [, callback] of callbacksDueNow) {
        callback();
      }
    },
  };
}

describe('createClockTicker', () => {
  it('calls back once per frame after it is started', () => {
    // Arrange: a ticker on hand-driven frames that counts its callbacks.
    const frames = createHandDrivenAnimationFrames();
    let frameCount = 0;
    const ticker = createClockTicker({
      onFrame: () => (frameCount += 1),
      requestFrame: frames.requestFrame,
      cancelFrame: frames.cancelFrame,
    });

    // Act: start it and let three frames happen.
    ticker.start();
    frames.runNextFrame();
    frames.runNextFrame();
    frames.runNextFrame();

    // Assert: one callback per frame, and the next frame is already booked.
    expect(frameCount, 'the ticker must call back once per animation frame').toBe(3);
    expect(frames.pendingCallbacks.size, 'the ticker must book the next frame').toBe(1);
  });

  it('runs a single loop even when started twice', () => {
    // Arrange: a ticker on hand-driven frames.
    const frames = createHandDrivenAnimationFrames();
    let frameCount = 0;
    const ticker = createClockTicker({
      onFrame: () => (frameCount += 1),
      requestFrame: frames.requestFrame,
      cancelFrame: frames.cancelFrame,
    });

    // Act: start it twice (play pressed twice) and let one frame happen.
    ticker.start();
    ticker.start();
    frames.runNextFrame();

    // Assert: one callback, not two: there is only one loop.
    expect(frameCount, 'a second start must not create a second loop').toBe(1);
  });

  it('cancels the pending frame when stopped and never calls back again', () => {
    // Arrange: a running ticker with one frame already pending.
    const frames = createHandDrivenAnimationFrames();
    let frameCount = 0;
    const ticker = createClockTicker({
      onFrame: () => (frameCount += 1),
      requestFrame: frames.requestFrame,
      cancelFrame: frames.cancelFrame,
    });
    ticker.start();
    const pendingFrameId = [...frames.pendingCallbacks.keys()][0];

    // Act: stop it, then let frames keep happening.
    ticker.stop();
    frames.runNextFrame();
    frames.runNextFrame();

    // Assert: the pending frame was cancelled and nothing was called afterwards.
    expect(frames.cancelledFrameIds, 'stop must cancel the frame that was pending').toEqual([
      pendingFrameId,
    ]);
    expect(frameCount, 'no callback may happen after stop').toBe(0);
  });
});
