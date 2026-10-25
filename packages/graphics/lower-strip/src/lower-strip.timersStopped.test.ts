/**
 * Nothing keeps running once the lower strip stops, is disposed or leaves the page
 * (packages/graphics/lower-strip)
 *
 * What this module is for:
 *   On air the strip runs two timers: the page timer (a setTimeout per hold) and the clock
 *   block's frame loop (requestAnimationFrame). Inside OBS a page runs all day, so a timer
 *   left behind by stop, dispose or a renderer removing the layer would go on turning pages
 *   or drawing frames for a strip nobody sees.
 *
 * What these tests prove (fake time, frames run by hand):
 *   - After stop, after dispose and after the element leaves the page, no timer is pending.
 *   - After each of the three, the clock block is never redrawn again however much time
 *     passes and however many frames run.
 *   Each test fails when the stop() it is about is removed from lower-strip.ts (checked by
 *   hand at gate 2 of PR #26).
 *
 * What these tests deliberately do not cover:
 *   - Which page shows after the holds; lower-strip.paging.test.ts.
 */
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import type LowerStripGraphic from './lower-strip.js';
import {
  createLowerStripOnThePage,
  createRealEnduroStripData,
  findPartOfLowerStrip,
  loadLowerStripWithData,
  twoInTheAfternoonMs,
} from './lowerStripOnThePage.testSupport.js';

/**
 * Takes control of the page's timers, the machine's clock and the animation frames (run
 * only when the test says), all given back when the test ends.
 */
function takeControlOfTimersClockAndFrames() {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  vi.setSystemTime(twoInTheAfternoonMs);
  const pendingFrames = new Map<number, FrameRequestCallback>();
  let lastFrameId = 0;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    lastFrameId += 1;
    pendingFrames.set(lastFrameId, callback);
    return lastFrameId;
  });
  vi.stubGlobal('cancelAnimationFrame', (frameId: number) => pendingFrames.delete(frameId));
  onTestFinished(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  return {
    runPendingFrames(): void {
      const callbacks = [...pendingFrames.values()];
      pendingFrames.clear();
      for (const callback of callbacks) {
        callback(performance.now());
      }
    },
  };
}

/** The real field on air with a running clock, both timers armed and a frame run. */
async function putTheStripOnAirWithItsTimersRunning(
  framesAndTime: ReturnType<typeof takeControlOfTimersClockAndFrames>,
): Promise<LowerStripGraphic> {
  const lowerStrip = createLowerStripOnThePage();
  await loadLowerStripWithData(lowerStrip, { ...createRealEnduroStripData(), running: true });
  await lowerStrip.playAction({ skipAnimation: true });
  framesAndTime.runPendingFrames();
  return lowerStrip;
}

/** The clock block's time on screen now. */
function readClockTime(lowerStrip: LowerStripGraphic): string | null | undefined {
  return findPartOfLowerStrip(lowerStrip, 'clock-block-time')?.textContent;
}

const waysToEndTheStrip = [
  // The operator takes it off.
  {
    name: 'stop',
    end: async (lowerStrip: LowerStripGraphic) => {
      await lowerStrip.stopAction({ skipAnimation: true });
    },
  },
  // The renderer throws the layer away.
  {
    name: 'dispose',
    end: async (lowerStrip: LowerStripGraphic) => {
      await lowerStrip.dispose();
    },
  },
  // The renderer removes the element without dispose.
  {
    name: 'removal from the page',
    end: async (lowerStrip: LowerStripGraphic) => {
      lowerStrip.remove();
      await Promise.resolve();
    },
  },
];

describe('the strip’s timers once it ends', () => {
  it.each(waysToEndTheStrip)('leaves no timer pending after $name', async ({ end }) => {
    // Arrange: the strip on air, its page timer armed.
    const framesAndTime = takeControlOfTimersClockAndFrames();
    const lowerStrip = await putTheStripOnAirWithItsTimersRunning(framesAndTime);
    const timersWhileOnAir = vi.getTimerCount();

    // Act: end it this way.
    await end(lowerStrip);

    // Assert: the hold was booked on air, and nothing is booked any more.
    expect(timersWhileOnAir, 'on air the page timer holds one wait').toBe(1);
    expect(vi.getTimerCount(), 'no timer may be left pending').toBe(0);
  });

  it.each(waysToEndTheStrip)('never redraws the clock after $name', async ({ end }) => {
    // Arrange: the strip on air, its clock at 1:00:00 and its frame loop running.
    const framesAndTime = takeControlOfTimersClockAndFrames();
    const lowerStrip = await putTheStripOnAirWithItsTimersRunning(framesAndTime);
    const timeWhileOnAir = readClockTime(lowerStrip);

    // Act: end it this way, then let ten seconds pass and frames run.
    await end(lowerStrip);
    vi.setSystemTime(twoInTheAfternoonMs + 10_000);
    framesAndTime.runPendingFrames();
    framesAndTime.runPendingFrames();

    // Assert: the clock read 1:00:00 on air and never moved again.
    expect(timeWhileOnAir, 'on air the clock read the reading').toBe('1:00:00');
    expect(readClockTime(lowerStrip), 'no frame may redraw the clock').toBe('1:00:00');
  });
});
