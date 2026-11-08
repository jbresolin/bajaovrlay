/**
 * The time of the server's clock, read on the renderer's machine (packages/shared)
 *
 * What this module is for:
 *   A race clock on air counts from a moment the SERVER stamped with its own clock. If
 *   the graphic then asked the OBS machine's clock "what time is it now", any difference
 *   between the two machines would show as a wrong time on air (2.3 seconds were seen on
 *   a machine whose clock stepped back). So the renderer records, for every message, what
 *   the server's clock said, and the graphic asks readServerAlignedTimeMs() instead of
 *   Date.now(). The renderer and the graphic are two separate bundles, each with its own
 *   copy of this code, so what is recorded is kept in one named place of the page that
 *   both copies reach. Between samples it counts on the machine's monotonic time
 *   (performance.timeOrigin + performance.now()), which a step of the wall clock does
 *   not move (BAJAOVRLAY-62).
 *
 * What these tests prove:
 *   - With nothing recorded (preview page, control page, a renderer that has not heard
 *     from the server yet) the time read is the machine's own.
 *   - With the machine's clock 2.3 s behind the server's, the time read after one
 *     message is the server's.
 *   - What one copy of the code records, a second copy reads (renderer and graphic).
 *   - When the machine's wall clock steps back or forwards while the page is open, the
 *     time read does not move with it, before or after new samples arrive.
 *   - Forgetting the samples brings back the machine's own time.
 *
 * The tests run on Vitest's fake Date and fake performance: a step of the wall clock
 * moves Date.now() alone, while time passing moves both.
 *
 * What these tests deliberately do not cover:
 *   - Which samples are kept and the median; serverClockOffsetSamples.test.ts.
 *   - The renderer taking samples from real messages; apps/renderer's
 *     serverConnection.serverClock.test.ts. The race clock reading this time on air;
 *     packages/graphics/race-clock's race-clock.serverClock.test.ts.
 */
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import {
  forgetServerClockSamples,
  readServerAlignedTimeMs,
  readThisMachineMonotonicTimeMs,
  recordServerClockSample,
} from './serverAlignedTime.js';

/** 9 October 2026, 14:32:05 UTC on the server's clock: the enduro is under way. */
const serverTimeMs = Date.parse('2026-10-09T14:32:05.000Z');

/** How far behind the server's the OBS machine's clock was seen to be. */
const renderMachineLagMs = 2_300;

/**
 * Holds the machine's clocks (wall and monotonic) still at the given time, and makes
 * sure the samples and the real clocks come back when the test ends, so no test sees
 * another one's offset.
 */
function holdTheMachineClockAt(machineTimeMs: number): void {
  vi.useFakeTimers({ toFake: ['Date', 'performance'], now: machineTimeMs });
  forgetServerClockSamples();
  onTestFinished(() => {
    forgetServerClockSamples();
    vi.useRealTimers();
  });
}

describe('readServerAlignedTimeMs', () => {
  it('reads the time of the machine itself when nothing was ever recorded', () => {
    // Arrange: a machine 2.3 s behind the server, on a page that never heard from it.
    holdTheMachineClockAt(serverTimeMs - renderMachineLagMs);

    // Act: ask for the time.
    const timeReadMs = readServerAlignedTimeMs();

    // Assert: the machine's own time; there is nothing to correct it with.
    expect(timeReadMs, 'with no sample the time read must be the clock of the machine').toBe(
      serverTimeMs - renderMachineLagMs,
    );
  });

  it('reads the time of the server once a message was recorded on a machine 2.3 s behind', () => {
    // Arrange: a machine whose clock shows 14:32:02.700 when the server's shows 14:32:05.
    holdTheMachineClockAt(serverTimeMs - renderMachineLagMs);

    // Act: a message stamped 14:32:05 by the server arrives, and the time is asked for.
    recordServerClockSample(serverTimeMs, readThisMachineMonotonicTimeMs());
    const timeReadMs = readServerAlignedTimeMs();

    // Assert: 14:32:05, the server's time, not the machine's.
    expect(timeReadMs, 'the time read must be the time of the server').toBe(serverTimeMs);
  });

  it('keeps following the server as the machine clock moves on', () => {
    // Arrange: the same machine, one message recorded.
    holdTheMachineClockAt(serverTimeMs - renderMachineLagMs);
    recordServerClockSample(serverTimeMs, readThisMachineMonotonicTimeMs());

    // Act: forty seconds pass on the machine with no new message.
    vi.advanceTimersByTime(40_000);
    const timeReadMs = readServerAlignedTimeMs();

    // Assert: forty seconds later on the server's clock too.
    expect(timeReadMs, 'the offset must carry over between messages').toBe(serverTimeMs + 40_000);
  });

  it('lets a second copy of this code read what the first copy recorded', async () => {
    // Arrange: a machine 2.3 s behind, and two separate copies of this module, as the
    // renderer's bundle and the graphic's bundle each carry their own.
    holdTheMachineClockAt(serverTimeMs - renderMachineLagMs);
    vi.resetModules();
    const copyInTheRendererBundle = await import('./serverAlignedTime.js');
    vi.resetModules();
    const copyInTheGraphicBundle = await import('./serverAlignedTime.js');

    // Act: the renderer's copy records a message; the graphic's copy asks for the time.
    copyInTheRendererBundle.recordServerClockSample(serverTimeMs, readThisMachineMonotonicTimeMs());
    const timeReadByTheGraphicMs = copyInTheGraphicBundle.readServerAlignedTimeMs();

    // Assert: they really are two copies, and the graphic still reads the server's time.
    expect(
      copyInTheGraphicBundle.readServerAlignedTimeMs,
      'the two imports must be separate copies for this test to mean anything',
    ).not.toBe(copyInTheRendererBundle.readServerAlignedTimeMs);
    expect(timeReadByTheGraphicMs, 'the graphic must read the offset the renderer recorded').toBe(
      serverTimeMs,
    );
  });

  const wallClockStepScenarios = [
    // What #52 saw under load: WSL2's time sync stepped the wall clock back about 2.3 s
    // at worst. Before BAJAOVRLAY-62 the time read followed it until three samples came.
    { name: 'back 2.3 s', stepMs: -renderMachineLagMs },
    // The same sync can step it forwards; the clock on air would have skipped seconds.
    { name: 'forwards 2.3 s', stepMs: renderMachineLagMs },
  ];

  for (const scenario of wallClockStepScenarios) {
    it(`does not follow a step of the machine's wall clock ${scenario.name}`, () => {
      // Arrange: a machine that agreed with the server for five messages, one a second.
      holdTheMachineClockAt(serverTimeMs);
      for (let secondsPassed = 0; secondsPassed < 5; secondsPassed += 1) {
        recordServerClockSample(
          serverTimeMs + secondsPassed * 1_000,
          readThisMachineMonotonicTimeMs(),
        );
        vi.advanceTimersByTime(1_000);
      }
      const serverTimeAtTheStepMs = serverTimeMs + 5_000;

      // Act: the machine's wall clock steps; the time is read; then three messages
      // arrive (no time passes, to keep the sums plain) and it is read again.
      vi.setSystemTime(Date.now() + scenario.stepMs);
      const timeReadRightAfterTheStepMs = readServerAlignedTimeMs();
      for (let messageCount = 0; messageCount < 3; messageCount += 1) {
        recordServerClockSample(serverTimeAtTheStepMs, readThisMachineMonotonicTimeMs());
      }
      const timeReadAfterThreeMessagesMs = readServerAlignedTimeMs();

      // Assert: the server's time both times; the step moved the wall clock alone.
      expect(
        timeReadRightAfterTheStepMs,
        'a step of the wall clock must not move the time read',
      ).toBe(serverTimeAtTheStepMs);
      expect(
        timeReadAfterThreeMessagesMs,
        'new samples after the step must agree with the old ones',
      ).toBe(serverTimeAtTheStepMs);
    });
  }

  it('reads the time of the machine again after the samples are forgotten', () => {
    // Arrange: a machine 2.3 s behind with one message recorded.
    holdTheMachineClockAt(serverTimeMs - renderMachineLagMs);
    recordServerClockSample(serverTimeMs, readThisMachineMonotonicTimeMs());

    // Act: forget the samples, as a test does when it ends.
    forgetServerClockSamples();
    const timeReadMs = readServerAlignedTimeMs();

    // Assert: back to the machine's own time.
    expect(timeReadMs, 'with the samples forgotten there is nothing to correct with').toBe(
      serverTimeMs - renderMachineLagMs,
    );
  });
});
