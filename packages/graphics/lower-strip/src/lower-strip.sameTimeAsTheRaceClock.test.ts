/**
 * The strip's clock block and the race clock show the same time
 * (packages/graphics/lower-strip)
 *
 * What this module is for:
 *   A race clock card top-right and the strip's clock block along the bottom may be on air
 *   together (the design's catalogue, "What can share the screen"); a viewer must never see
 *   them disagree. Both write their time from the kit's raceClockReading with the
 *   server-aligned "now", and this test puts the real race clock beside the strip.
 *
 * What these tests prove:
 *   - Fed the same reading, the strip's block and the race clock's card show the same text
 *     at the same moment: on air, and after time passes and a frame runs, also with the
 *     machine's clock 2.3 s behind the server's once the renderer has recorded a message.
 *   - Under a countdown the two agree too, the second rounded the same way.
 *
 * What these tests deliberately do not cover:
 *   - The sum and the rounding themselves; packages/shared/src/clock tests them.
 *   - Two graphics in the real renderer; the control page's e2e walk shows both on air.
 */
import RaceClockGraphic from '@bajaovrlay/race-clock/src/race-clock';
import { forgetServerClockSamples, recordServerClockSample } from '@bajaovrlay/shared/clock';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import type LowerStripGraphic from './lower-strip.js';
import {
  createLowerStripOnThePage,
  createRealEnduroStripData,
  findPartOfLowerStrip,
  twoInTheAfternoonMs,
} from './lowerStripOnThePage.testSupport.js';

// The renderer, not the graphic, picks the tag name; this test picks its own.
customElements.define('baja-race-clock-beside-the-strip', RaceClockGraphic);

/** The race clock's own data for the same reading as the strip's. */
function createRaceClockDataForTheSameReading(
  stripData: ReturnType<typeof createRealEnduroStripData>,
) {
  return {
    sessionName: 'Enduro de Resistência',
    state: stripData.state,
    clockMode: stripData.clockMode,
    referenceTimeMs: stripData.referenceTimeMs,
    referenceWallClockMs: stripData.referenceWallClockMs,
    running: stripData.running,
  };
}

/**
 * Takes control of the machine's clock and of animation frames (run only when the test
 * says), and forgets any server clock sample before and after, so no test sees another's.
 */
function takeControlOfFramesAndTime() {
  vi.useFakeTimers({ toFake: ['Date'] });
  forgetServerClockSamples();
  const pendingCallbacks = new Map<number, FrameRequestCallback>();
  let lastFrameId = 0;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    lastFrameId += 1;
    pendingCallbacks.set(lastFrameId, callback);
    return lastFrameId;
  });
  vi.stubGlobal('cancelAnimationFrame', (frameId: number) => pendingCallbacks.delete(frameId));
  onTestFinished(() => {
    forgetServerClockSamples();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  return {
    runPendingFrames(): void {
      const callbacksDueNow = [...pendingCallbacks.values()];
      pendingCallbacks.clear();
      for (const callback of callbacksDueNow) {
        callback(performance.now());
      }
    },
  };
}

/** Puts a race clock on the page, disposed and removed when the test ends. */
function createRaceClockOnThePage(): RaceClockGraphic {
  const raceClock = document.createElement('baja-race-clock-beside-the-strip') as RaceClockGraphic;
  document.body.append(raceClock);
  onTestFinished(async () => {
    await raceClock.dispose();
    raceClock.remove();
  });
  return raceClock;
}

/** Loads a graphic the way an OBS renderer does and plays it in at once. */
async function loadAndPlay(
  graphic: { load: RaceClockGraphic['load']; playAction: RaceClockGraphic['playAction'] },
  data: unknown,
) {
  await graphic.load({
    data,
    renderType: 'realtime',
    renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
  });
  await graphic.playAction({ skipAnimation: true });
}

/** Reads the time each graphic shows now: [the strip's block, the race clock's card]. */
function readBothTimes(
  lowerStrip: LowerStripGraphic,
  raceClock: RaceClockGraphic,
): Array<string | null> {
  const stripTime = findPartOfLowerStrip(lowerStrip, 'clock-block-time')?.textContent;
  const raceClockTime = raceClock.shadowRoot?.querySelector(
    '[data-testid="race-clock-time"]',
  )?.textContent;
  return [stripTime ?? null, raceClockTime ?? null];
}

describe('the strip’s clock block beside the race clock', () => {
  it('shows the same time as the race clock, on air and after time passes', async () => {
    // Arrange: the machine's clock 1 h 23 min 45.6 s after the reading; both graphics on
    // air with the same running reading (1:00:00 at the reading, counting up).
    const framesAndTime = takeControlOfFramesAndTime();
    vi.setSystemTime(twoInTheAfternoonMs + 5_025_600);
    const stripData = { ...createRealEnduroStripData(), running: true };
    const lowerStrip = createLowerStripOnThePage();
    const raceClock = createRaceClockOnThePage();
    await loadAndPlay(lowerStrip, stripData);
    await loadAndPlay(raceClock, createRaceClockDataForTheSameReading(stripData));

    // Act: note both, then let 1.5 s pass and a frame run.
    const timesOnAir = readBothTimes(lowerStrip, raceClock);
    vi.setSystemTime(Date.now() + 1500);
    framesAndTime.runPendingFrames();
    const timesAfterTheFrame = readBothTimes(lowerStrip, raceClock);

    // Assert: the same text on both, at both moments.
    expect(timesOnAir, 'both show the same time on air').toEqual(['2:23:45', '2:23:45']);
    expect(timesAfterTheFrame, 'both moved on together').toEqual(['2:23:47', '2:23:47']);
  });

  it('agrees with the race clock on a machine 2.3 s behind the server', async () => {
    // Arrange: the machine 2.3 s behind; the renderer recorded a message in which the
    // server's clock read ten seconds past the reading. Both on air with the same reading.
    const framesAndTime = takeControlOfFramesAndTime();
    const serverTimeMs = twoInTheAfternoonMs + 10_000;
    vi.setSystemTime(serverTimeMs - 2300);
    recordServerClockSample(serverTimeMs, Date.now());
    const stripData = { ...createRealEnduroStripData(), running: true };
    const lowerStrip = createLowerStripOnThePage();
    const raceClock = createRaceClockOnThePage();
    await loadAndPlay(lowerStrip, stripData);
    await loadAndPlay(raceClock, createRaceClockDataForTheSameReading(stripData));

    // Act: a frame runs.
    framesAndTime.runPendingFrames();

    // Assert: both read the server's time, ten seconds past 1:00:00.
    expect(readBothTimes(lowerStrip, raceClock), 'both follow the server’s clock').toEqual([
      '1:00:10',
      '1:00:10',
    ]);
  });

  it('agrees with the race clock under a countdown, the second rounded alike', async () => {
    // Arrange: a 30-minute countdown, half a second after its reading.
    takeControlOfFramesAndTime();
    vi.setSystemTime(twoInTheAfternoonMs + 500);
    const stripData = {
      ...createRealEnduroStripData(),
      clockMode: 'remaining' as const,
      referenceTimeMs: 1_800_000,
      running: true,
    };
    const lowerStrip = createLowerStripOnThePage();
    const raceClock = createRaceClockOnThePage();

    // Act: both on air with that reading.
    await loadAndPlay(lowerStrip, stripData);
    await loadAndPlay(raceClock, createRaceClockDataForTheSameReading(stripData));

    // Assert: the same second on both (a countdown rounds the part of a second up).
    expect(readBothTimes(lowerStrip, raceClock), 'both show the same second').toEqual([
      '30:00',
      '30:00',
    ]);
  });
});
