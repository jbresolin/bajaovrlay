/**
 * The time of the server's clock, read on a page's machine (packages/shared)
 *
 * What this module is for:
 *   A race clock on air counts from a moment the SERVER stamped with its clock, which
 *   keeps real time from NTP (BAJAOVRLAY-62). A page cannot ask NTP (a browser has no
 *   UDP), so it lines up with the server: at each `hello` it sends four clock probes, one
 *   after another, and keeps the answer with the shortest round trip, by the midpoint
 *   method (the server read its clock halfway between the send and the answer's
 *   arrival). Between answers it counts on the machine's monotonic time, which a step of
 *   the wall clock does not move. Later answers (one per ten-second `time` message)
 *   correct the page's own drift by slewing at most 0.5%, never by a jump; a difference
 *   of 2 s or more (the machine slept) is lined up at once. The graphics ask
 *   readServerAlignedTimeMs() instead of Date.now(); the renderer and each graphic are
 *   separate bundles, so the alignment is kept in one named place of the page.
 *
 * What these tests prove (on Vitest's fake Date and fake performance: a step of the wall
 *   clock moves Date.now() alone, while time passing moves both):
 *   - With no alignment (a preview page) the time read is the machine's own.
 *   - A hello's one-way sample lines the page up at once; with no time in the hello, the
 *     probes line it up alone.
 *   - Four probes at the hello: the answer with the shortest round trip wins, by its
 *     midpoint; a fifth answer is a later one.
 *   - A later answer 300 ms off is slewed, at most 5 ms per second, never jumped.
 *   - A later answer 2 s or more off (the machine slept) is lined up at once.
 *   - An answer that took more than a second is left aside.
 *   - A step of the machine's wall clock does not move the time read.
 *   - What one copy of the code lines up, a second copy reads (renderer and graphic).
 *   - The time read is a whole number of milliseconds; forgetting brings back the
 *     machine's own time.
 *
 * What these tests deliberately do not cover:
 *   - Sending the probes over a real socket; apps/renderer's and apps/control's
 *     serverConnection.serverClock tests. The race clock reading this time on air;
 *     packages/graphics/race-clock's race-clock.serverClock.test.ts.
 */
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import {
  forgetTheServerClockAlignment,
  lineUpWithTheServerClockAt,
  readServerAlignedTimeMs,
  readThisMachineMonotonicTimeMs,
  recordClockProbeAnswer,
} from './serverAlignedTime.js';

/** 9 October 2026, 14:32:05 UTC on the server's clock: the enduro is under way. */
const serverTimeMs = Date.parse('2026-10-09T14:32:05.000Z');

/** How far behind the server's the OBS machine's clock was seen to be. */
const renderMachineLagMs = 2_300;

/**
 * Holds the machine's clocks (wall and monotonic) still at the given time, and makes
 * sure the alignment and the real clocks come back when the test ends, so no test sees
 * another one's alignment.
 */
function holdTheMachineClockAt(machineTimeMs: number): void {
  vi.useFakeTimers({ toFake: ['Date', 'performance'], now: machineTimeMs });
  forgetTheServerClockAlignment();
  onTestFinished(() => {
    forgetTheServerClockAlignment();
    vi.useRealTimers();
  });
}

/**
 * A probe's whole trip: sent now, answered by a server whose clock is `serverAheadMs`
 * ahead of this machine's, the answer arriving `roundTripMs` later (half each way).
 * Time passes on the fake clocks by the round trip. Returns whether to send another.
 */
function sendAProbeAndTakeItsAnswer(serverAheadMs: number, roundTripMs: number): boolean {
  const pageSentAtMs = readThisMachineMonotonicTimeMs();
  const serverNowMs = pageSentAtMs + roundTripMs / 2 + serverAheadMs;
  vi.advanceTimersByTime(roundTripMs);
  return recordClockProbeAnswer({
    pageSentAtMs,
    serverNowMs,
    pageReceivedAtMs: readThisMachineMonotonicTimeMs(),
  }).isAnotherProbeNeeded;
}

/**
 * A probe whose answer was held up on the way back only: 2 ms there, then 2 ms plus
 * `extraWayBackMs` back, so its midpoint is off by half of the extra.
 */
function takeAnAnswerDelayedOnTheWayBack(serverAheadMs: number, extraWayBackMs: number): boolean {
  const pageSentAtMs = readThisMachineMonotonicTimeMs();
  const serverNowMs = pageSentAtMs + 2 + serverAheadMs;
  vi.advanceTimersByTime(4 + extraWayBackMs);
  return recordClockProbeAnswer({
    pageSentAtMs,
    serverNowMs,
    pageReceivedAtMs: readThisMachineMonotonicTimeMs(),
  }).isAnotherProbeNeeded;
}

/**
 * Lines the page up as at a hello, on a server ahead by this: the hello's own time
 * (20 ms late, one-way), then four probes of 6 ms.
 */
function lineUpWithFourProbes(serverAheadMs: number): void {
  const helloArrivedAtMs = readThisMachineMonotonicTimeMs();
  lineUpWithTheServerClockAt(helloArrivedAtMs + serverAheadMs - 20, helloArrivedAtMs);
  for (let probeNumber = 0; probeNumber < 4; probeNumber += 1) {
    sendAProbeAndTakeItsAnswer(serverAheadMs, 6);
  }
}

/** How far the time read is behind what the server's clock reads now (server − page). */
function measureHowFarBehindTheServer(serverAheadMs: number): number {
  return readThisMachineMonotonicTimeMs() + serverAheadMs - readServerAlignedTimeMs();
}

describe('the time read before any alignment, and at the hello', () => {
  it('is the time of the machine itself when the page never heard from the server', () => {
    // Arrange: a machine 2.3 s behind the server, on a page that never heard from it.
    holdTheMachineClockAt(serverTimeMs - renderMachineLagMs);

    // Act: ask for the time.
    const timeReadMs = readServerAlignedTimeMs();

    // Assert: the machine's own time; there is nothing to correct it with.
    expect(timeReadMs, 'with no alignment the time read must be the clock of the machine').toBe(
      serverTimeMs - renderMachineLagMs,
    );
  });

  it("is the server's at once, from the hello's own time", () => {
    // Arrange: a machine whose clock shows 14:32:02.700 when the server's shows 14:32:05.
    holdTheMachineClockAt(serverTimeMs - renderMachineLagMs);

    // Act: the hello, stamped 14:32:05, arrives; then forty seconds pass.
    lineUpWithTheServerClockAt(serverTimeMs, readThisMachineMonotonicTimeMs());
    const timeReadAtTheHelloMs = readServerAlignedTimeMs();
    vi.advanceTimersByTime(40_000);

    // Assert: 14:32:05, then 14:32:45, on the server's clock.
    expect(timeReadAtTheHelloMs, 'the hello lines the page up at once').toBe(serverTimeMs);
    expect(readServerAlignedTimeMs(), 'it carries over between messages').toBe(
      serverTimeMs + 40_000,
    );
  });

  it('keeps the probe answer with the shortest round trip of the four after a hello', () => {
    // Arrange: a machine 2.3 s behind; the hello has arrived (one-way, so 40 ms late).
    holdTheMachineClockAt(serverTimeMs - renderMachineLagMs);
    lineUpWithTheServerClockAt(serverTimeMs - 40, readThisMachineMonotonicTimeMs());

    // Act: four probes, one after another, coming back in 40, 6, 30 and 18 ms; the 30 ms
    // one was held up on the way back only, which would put it 13 ms off.
    const wantsASecond = sendAProbeAndTakeItsAnswer(renderMachineLagMs, 40);
    const wantsAThird = sendAProbeAndTakeItsAnswer(renderMachineLagMs, 6);
    const wantsAFourth = takeAnAnswerDelayedOnTheWayBack(renderMachineLagMs, 26);
    const wantsAFifth = sendAProbeAndTakeItsAnswer(renderMachineLagMs, 18);

    // Assert: another probe was asked for until the fourth; the page reads the server's
    // time exactly, as the 6 ms answer said.
    expect(
      [wantsASecond, wantsAThird, wantsAFourth, wantsAFifth],
      'four probes after a hello, no more',
    ).toEqual([true, true, true, false]);
    expect(measureHowFarBehindTheServer(renderMachineLagMs), 'the shortest round trip wins').toBe(
      0,
    );
  });

  it('lines up from the probes alone when the hello carried no time', () => {
    // Arrange: a machine 2.3 s behind whose hello (a stand-in server's) had no serverNowMs.
    holdTheMachineClockAt(serverTimeMs - renderMachineLagMs);

    // Act: the four probes are answered.
    for (let probeNumber = 0; probeNumber < 4; probeNumber += 1) {
      sendAProbeAndTakeItsAnswer(renderMachineLagMs, 6);
    }

    // Assert: the server's time.
    expect(measureHowFarBehindTheServer(renderMachineLagMs), 'the probes line up alone').toBe(0);
  });
});

describe('the time read after the hello', () => {
  it('slews a later difference of 300 ms at 0.5%, never jumping', () => {
    // Arrange: a page lined up on a server 2.3 s ahead; then the page's machine ran slow
    // and is 300 ms behind when the next answer comes.
    holdTheMachineClockAt(serverTimeMs - renderMachineLagMs);
    lineUpWithFourProbes(renderMachineLagMs);
    const serverAheadNowMs = renderMachineLagMs + 300;

    // Act: the later answer says 300 ms more; the time is read every second for a minute
    // and a half.
    sendAProbeAndTakeItsAnswer(serverAheadNowMs, 6);
    const timeReadEachSecondMs: number[] = [readServerAlignedTimeMs()];
    for (let secondsPassed = 1; secondsPassed <= 90; secondsPassed += 1) {
      vi.advanceTimersByTime(1_000);
      timeReadEachSecondMs.push(readServerAlignedTimeMs());
    }

    // Assert: each second moved the time read by 1000 to 1005 ms (no jump), and after
    // 60 s (300 ms at 5 ms a second) it reads the server's time.
    const millisecondsMovedEachSecond = timeReadEachSecondMs
      .slice(1)
      .map((timeReadMs, secondNumber) => timeReadMs - (timeReadEachSecondMs[secondNumber] ?? 0));
    expect(
      Math.min(...millisecondsMovedEachSecond),
      'never slower than real time here',
    ).toBeGreaterThanOrEqual(1_000);
    expect(
      Math.max(...millisecondsMovedEachSecond),
      'never more than 0.5% faster',
    ).toBeLessThanOrEqual(1_005);
    expect(measureHowFarBehindTheServer(serverAheadNowMs), 'the 300 ms are covered').toBe(0);
  });

  it('lines up at once with a later difference of 2 s or more: the machine slept', () => {
    // Arrange: a page lined up on a server 2.3 s ahead.
    holdTheMachineClockAt(serverTimeMs - renderMachineLagMs);
    lineUpWithFourProbes(renderMachineLagMs);

    // Act: the OBS machine slept 8 h (its monotonic time stood still): the next answer
    // says the server is 8 h further ahead.
    const eightHoursMs = 8 * 60 * 60 * 1000;
    sendAProbeAndTakeItsAnswer(renderMachineLagMs + eightHoursMs, 6);

    // Assert: on the server's time at once, not 8 h at 0.5% later.
    expect(
      measureHowFarBehindTheServer(renderMachineLagMs + eightHoursMs),
      'a gap of 2 s or more is lined up at once',
    ).toBe(0);
  });

  it('leaves aside an answer that took more than a second', () => {
    // Arrange: a page lined up on a server 2.3 s ahead.
    holdTheMachineClockAt(serverTimeMs - renderMachineLagMs);
    lineUpWithFourProbes(renderMachineLagMs);

    // Act: an answer held up 2.5 s on the way back (a frozen Wi-Fi), whose midpoint would
    // say the server is 1.25 s behind where it is; then a minute passes.
    takeAnAnswerDelayedOnTheWayBack(renderMachineLagMs, 2_500);
    vi.advanceTimersByTime(60_000);

    // Assert: the page still reads the server's time.
    expect(measureHowFarBehindTheServer(renderMachineLagMs), 'a slow answer tells no time').toBe(0);
  });

  const wallClockStepScenarios = [
    // What #52 saw under load: WSL2's time sync stepped the wall clock back.
    { name: 'back 2.3 s', stepMs: -renderMachineLagMs },
    // The same sync can step it forwards.
    { name: 'forwards 2.3 s', stepMs: renderMachineLagMs },
  ];

  it.each(wallClockStepScenarios)(
    "does not follow a step of the machine's wall clock $name",
    ({ stepMs }) => {
      // Arrange: a page lined up on a server 2.3 s ahead.
      holdTheMachineClockAt(serverTimeMs - renderMachineLagMs);
      lineUpWithFourProbes(renderMachineLagMs);

      // Act: the machine's wall clock steps; then a probe is answered.
      vi.setSystemTime(Date.now() + stepMs);
      const behindRightAfterTheStepMs = measureHowFarBehindTheServer(renderMachineLagMs);
      sendAProbeAndTakeItsAnswer(renderMachineLagMs, 6);

      // Assert: on the server's time both times; the step moved the wall clock alone.
      expect(
        behindRightAfterTheStepMs,
        'a step of the wall clock must not move the time read',
      ).toBe(0);
      expect(measureHowFarBehindTheServer(renderMachineLagMs), 'nor the next answer').toBe(0);
    },
  );
});

describe('the alignment of the page', () => {
  it('is read by a second copy of this code', async () => {
    // Arrange: a machine 2.3 s behind, and two separate copies of this module, as the
    // renderer's bundle and the graphic's bundle each carry their own.
    holdTheMachineClockAt(serverTimeMs - renderMachineLagMs);
    vi.resetModules();
    const copyInTheRendererBundle = await import('./serverAlignedTime.js');
    vi.resetModules();
    const copyInTheGraphicBundle = await import('./serverAlignedTime.js');

    // Act: the renderer's copy lines up at a hello; the graphic's copy asks for the time.
    copyInTheRendererBundle.lineUpWithTheServerClockAt(
      serverTimeMs,
      readThisMachineMonotonicTimeMs(),
    );
    const timeReadByTheGraphicMs = copyInTheGraphicBundle.readServerAlignedTimeMs();

    // Assert: they really are two copies, and the graphic still reads the server's time.
    expect(
      copyInTheGraphicBundle.readServerAlignedTimeMs,
      'the two imports must be separate copies for this test to mean anything',
    ).not.toBe(copyInTheRendererBundle.readServerAlignedTimeMs);
    expect(timeReadByTheGraphicMs, 'the graphic must read what the renderer lined up').toBe(
      serverTimeMs,
    );
  });

  it('gives whole milliseconds, though monotonic time comes with fractions', () => {
    // Arrange: lined up at a hello, then a third of a millisecond passes (a data field
    // such as a snapshot's updatedAtMs must be a whole number).
    holdTheMachineClockAt(serverTimeMs - renderMachineLagMs);
    lineUpWithTheServerClockAt(serverTimeMs, readThisMachineMonotonicTimeMs());
    vi.advanceTimersByTime(0.333);

    // Act: read the time.
    const timeReadMs = readServerAlignedTimeMs();

    // Assert: the server's time, rounded down to the millisecond.
    expect(timeReadMs, 'the time read must be a whole number of milliseconds').toBe(serverTimeMs);
  });

  it("gives the machine's own time again once forgotten", () => {
    // Arrange: lined up at a hello.
    holdTheMachineClockAt(serverTimeMs - renderMachineLagMs);
    lineUpWithTheServerClockAt(serverTimeMs, readThisMachineMonotonicTimeMs());

    // Act: forget it, as a test does when it ends.
    forgetTheServerClockAlignment();
    const timeReadMs = readServerAlignedTimeMs();

    // Assert: back to the machine's own time.
    expect(timeReadMs, 'with nothing lined up there is nothing to correct with').toBe(
      serverTimeMs - renderMachineLagMs,
    );
  });
});
