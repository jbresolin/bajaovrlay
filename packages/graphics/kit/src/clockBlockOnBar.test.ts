/**
 * The clock block as a bar runs it (packages/graphics/kit)
 *
 * What this module is for:
 *   The lower strip and the message ticker draw the kit's clock block and run it alike:
 *   redrawn every frame on air at the server-aligned "now", stopped with the bar, and
 *   switched on and off by "Mostrar o relógio".
 *
 * What these tests prove:
 *   - A redraw writes the reading's time; ticking redraws on every frame, and stopping
 *     cancels the pending frame, so nothing is left booked.
 *   - The switch marks the bar and hides the block; switched on while on air, the block is
 *     put in its place at once; switched on off air it is left for the play-in.
 *   - readClockReadingFrom keeps the five clock fields and drops the rest of the data.
 *
 * What these tests deliberately do not cover:
 *   - The block's markup and its writer; clockBlock.test.ts.
 *   - Two graphics showing the same time; the lower strip's sameTimeAsTheRaceClock test.
 */
import { render } from 'lit';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { findClockBlockParts, renderClockBlockTemplate } from './clockBlock.js';
import { createClockBlockOnBar, readClockReadingFrom } from './clockBlockOnBar.js';
import type { RaceClockReading } from './raceClockReading.js';

// 14:00:00 on the enduro's day, as the server's clock read it.
const twoInTheAfternoonMs = Date.UTC(2026, 2, 8, 17, 0, 0);

/** The enduro an hour in, green flag, counting up. */
function createEnduroOneHourInReading(): RaceClockReading {
  return {
    state: 'green',
    clockMode: 'elapsed',
    referenceTimeMs: 3_600_000,
    referenceWallClockMs: twoInTheAfternoonMs,
    running: true,
  };
}

/**
 * A bar with the block drawn in it, the machine's clock at the reading, and hand-driven
 * frames, all undone when the test ends.
 */
function createBarWithAClockBlock() {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(twoInTheAfternoonMs);
  onTestFinished(() => {
    vi.useRealTimers();
  });
  const bar = document.createElement('section');
  render(renderClockBlockTemplate(), bar);
  const clockBlock = findClockBlockParts(bar);
  const pendingFrames = new Map<number, () => void>();
  let lastFrameId = 0;
  const clockBlockOnBar = createClockBlockOnBar({
    readBar: () => bar,
    readClockBlock: () => clockBlock,
    readReading: () => createEnduroOneHourInReading(),
    requestFrame: (callback) => {
      lastFrameId += 1;
      pendingFrames.set(lastFrameId, callback);
      return lastFrameId;
    },
    cancelFrame: (frameId) => pendingFrames.delete(frameId),
  });
  const runPendingFrames = () => {
    const callbacks = [...pendingFrames.values()];
    pendingFrames.clear();
    for (const callback of callbacks) {
      callback();
    }
  };
  return { bar, clockBlock, clockBlockOnBar, pendingFrames, runPendingFrames };
}

describe('the clock block on a bar', () => {
  it('redraws every frame while ticking, and books no frame once stopped', () => {
    // Arrange: the bar, its block drawn at the reading.
    const { clockBlock, clockBlockOnBar, pendingFrames, runPendingFrames } =
      createBarWithAClockBlock();
    clockBlockOnBar.redraw();
    const timeAtTheReading = clockBlock.time.textContent;

    // Act: tick, let 2 s pass and a frame run, then stop.
    clockBlockOnBar.startTicking();
    vi.setSystemTime(twoInTheAfternoonMs + 2000);
    runPendingFrames();
    const timeAfterAFrame = clockBlock.time.textContent;
    clockBlockOnBar.stopTicking();

    // Assert: the time moved with the frame, and no frame is left booked.
    expect(timeAtTheReading, 'the redraw writes the reading').toBe('1:00:00');
    expect(timeAfterAFrame, 'a frame redraws the time').toBe('1:00:02');
    expect(pendingFrames.size, 'stopping leaves no frame booked').toBe(0);
  });

  it('marks the bar and hides the block when switched off', () => {
    // Arrange: the bar with its block.
    const { bar, clockBlock, clockBlockOnBar } = createBarWithAClockBlock();

    // Act: switch the block off.
    clockBlockOnBar.writeSwitch(false, true);

    // Assert: the bar loses its column, the block is hidden.
    expect(bar.dataset.clockBlock, 'the bar is marked without its block').toBe('hidden');
    expect(clockBlock.block.hidden, 'the block is hidden').toBe(true);
  });

  it('puts the block in its place at once when switched on on air, and not off air', () => {
    // Arrange: two bars, each block hidden and off air (invisible).
    const onAir = createBarWithAClockBlock();
    const offAir = createBarWithAClockBlock();
    for (const { clockBlock } of [onAir, offAir]) {
      clockBlock.block.style.opacity = '0';
    }

    // Act: switch both on, one on air and one off.
    onAir.clockBlockOnBar.writeSwitch(true, true);
    offAir.clockBlockOnBar.writeSwitch(true, false);

    // Assert: shown in both; visible at once only on air.
    expect(onAir.clockBlock.block.hidden, 'shown on air').toBe(false);
    expect(onAir.clockBlock.block.style.opacity, 'visible at once on air').toBe('1');
    expect(offAir.clockBlock.block.style.opacity, 'off air it waits for the play-in').toBe('0');
  });
});

describe('readClockReadingFrom', () => {
  it('keeps the five clock fields of a bar’s data and drops the rest', () => {
    // Arrange: a ticker's data, with its label and messages.
    const tickerData = {
      ...createEnduroOneHourInReading(),
      label: 'AVISO',
      messages: ['Largada do enduro às 10h00'],
    };

    // Act: read the clock out of it.
    const reading = readClockReadingFrom(tickerData);

    // Assert: exactly the reading.
    expect(reading, 'the five clock fields alone').toEqual(createEnduroOneHourInReading());
  });
});
