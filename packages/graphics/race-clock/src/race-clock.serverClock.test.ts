/**
 * The race clock on air counts on the server's clock (packages/graphics/race-clock)
 *
 * What this module is for:
 *   The server stamps a clock reading with ITS wall clock ("at 14:30:00 the race clock
 *   read 1:05:00"). The graphic works out the time on air from that reading and "now".
 *   If "now" came from the OBS machine's own clock, a machine 2.3 seconds behind the
 *   server would show the race 2.3 seconds behind. So the graphic asks the shared
 *   readServerAlignedTimeMs() for "now": the machine's clock plus the difference the
 *   renderer measured from the server's messages.
 *
 * What these tests prove (on a machine whose clock is 2.3 s behind the server's):
 *   - Once the renderer has recorded a message from the server, the clock on air shows
 *     the server's time: 1:05:10 ten seconds after the reading, not 1:05:07.
 *   - With nothing recorded (the preview page, or a renderer before its first message)
 *     the clock shows the machine's own time, 1:05:07. This is the fault being corrected,
 *     written down so that it is known and deliberate.
 *   - A sample that arrives while the clock is on air corrects it on the next frame.
 *   - The time drawn at load (before play) is on the server's clock as well.
 *
 * What these tests deliberately do not cover:
 *   - How the difference is measured and smoothed; packages/shared/src/clock tests, and
 *     apps/renderer's serverConnection.serverClock.test.ts for the renderer's side.
 *   - Real rendering; jsdom draws nothing and has no `document.fonts`, so load's wait
 *     for the theme's font ends at once.
 */
import {
  forgetServerClockSamples,
  readThisMachineMonotonicTimeMs,
  recordServerClockSample,
} from '@bajaovrlay/shared/clock';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import {
  createGreenFlagEnduroData,
  createRaceClockOnThePage,
  loadRaceClockWithData,
  readingWallClockMs,
  readShownText,
  takeControlOfFramesAndTime,
} from './raceClockOnThePage.testSupport.js';

/** How far behind the server's the OBS machine's clock was seen to be. */
const renderMachineLagMs = 2_300;

/** Ten seconds after the reading, on the server's clock: the race clock must read 1:05:10. */
const serverTimeTenSecondsAfterTheReadingMs = readingWallClockMs + 10_000;

/**
 * Takes control of frames and time, and sets the machine's clock to what a machine 2.3 s
 * behind shows when the server's clock is ten seconds past the reading. Whatever the
 * renderer recorded is forgotten before and after, so no test sees another one's offset.
 */
function takeControlOnAMachineBehindTheServer() {
  const framesAndTime = takeControlOfFramesAndTime();
  forgetServerClockSamples();
  onTestFinished(() => forgetServerClockSamples());
  vi.setSystemTime(serverTimeTenSecondsAfterTheReadingMs - renderMachineLagMs);
  return framesAndTime;
}

describe('the race clock on a machine whose clock is 2.3 s behind the server', () => {
  it('shows the time of the server once the renderer has recorded a message', async () => {
    // Arrange: the machine 2.3 s behind, and the renderer has just received a message in
    // which the server said what its clock showed.
    const framesAndTime = takeControlOnAMachineBehindTheServer();
    recordServerClockSample(
      serverTimeTenSecondsAfterTheReadingMs,
      readThisMachineMonotonicTimeMs(),
    );
    const raceClock = createRaceClockOnThePage();

    // Act: the enduro clock (1:05:00 at the reading, running) goes on air and a frame runs.
    await loadRaceClockWithData(raceClock, createGreenFlagEnduroData());
    await raceClock.playAction({ skipAnimation: true });
    framesAndTime.runPendingFrames();

    // Assert: ten seconds after the reading on the SERVER's clock, so 1:05:10.
    expect(
      readShownText(raceClock, 'race-clock-time'),
      'the clock on air must read the server time, not the time of a machine 2.3 s behind',
    ).toBe('1:05:10');
  });

  it('shows the time of the machine itself when the renderer has recorded nothing', async () => {
    // Arrange: the same machine, on a page that never heard from the server (the
    // preview page, or the renderer before its first message).
    const framesAndTime = takeControlOnAMachineBehindTheServer();
    const raceClock = createRaceClockOnThePage();

    // Act: the same clock goes on air and a frame runs.
    await loadRaceClockWithData(raceClock, createGreenFlagEnduroData());
    await raceClock.playAction({ skipAnimation: true });
    framesAndTime.runPendingFrames();

    // Assert: 7.7 s after the reading on the machine's clock, which shows as 1:05:07,
    // three whole seconds short of the server's 1:05:10.
    expect(
      readShownText(raceClock, 'race-clock-time'),
      'with nothing recorded the clock can only read the clock of its machine',
    ).toBe('1:05:07');
  });

  it('is corrected on the next frame when a message is recorded while it is on air', async () => {
    // Arrange: the clock on air on the machine 2.3 s behind, nothing recorded yet.
    const framesAndTime = takeControlOnAMachineBehindTheServer();
    const raceClock = createRaceClockOnThePage();
    await loadRaceClockWithData(raceClock, createGreenFlagEnduroData());
    await raceClock.playAction({ skipAnimation: true });
    framesAndTime.runPendingFrames();
    const clockTextBeforeTheMessage = readShownText(raceClock, 'race-clock-time');

    // Act: the renderer records a message from the server, and the next frame runs.
    recordServerClockSample(
      serverTimeTenSecondsAfterTheReadingMs,
      readThisMachineMonotonicTimeMs(),
    );
    framesAndTime.runPendingFrames();

    // Assert: the clock moved from the machine's time to the server's, without any
    // update of the graphic's data.
    expect(clockTextBeforeTheMessage, 'before the message the clock read the machine').toBe(
      '1:05:07',
    );
    expect(
      readShownText(raceClock, 'race-clock-time'),
      'after the message the clock on air must read the server time',
    ).toBe('1:05:10');
  });

  it('draws the time of the server at load already, before it is played', async () => {
    // Arrange: the machine 2.3 s behind, with a message recorded.
    takeControlOnAMachineBehindTheServer();
    recordServerClockSample(
      serverTimeTenSecondsAfterTheReadingMs,
      readThisMachineMonotonicTimeMs(),
    );
    const raceClock = createRaceClockOnThePage();

    // Act: load the clock without playing it.
    await loadRaceClockWithData(raceClock, createGreenFlagEnduroData());

    // Assert: the text waiting off air is already the server's 1:05:10.
    expect(
      readShownText(raceClock, 'race-clock-time'),
      'the time drawn at load must be on the server clock too',
    ).toBe('1:05:10');
  });
});
