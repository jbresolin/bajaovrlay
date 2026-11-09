/**
 * The page's alignment across a reconnect and a step of the server clock (packages/shared)
 *
 * What this module is for:
 *   A page lines up with the server clock (serverAlignedTime.ts, BAJAOVRLAY-62). Two
 *   moments can make a clock on air jump: a WebSocket reconnect mid-race, whose hello
 *   arrives late and whose probes may be uneven; and a step of the server clock to NTP,
 *   after which every page must follow at once, or a race clock taken next shows the old
 *   time for minutes.
 *
 * What these tests prove (on Vitest's fake Date and fake performance):
 *   - A page already lined up never shows time going back across a new hello, late as the
 *     hello is and uneven as the probes are; it slews to the best probe instead. A hello
 *     with no time changes nothing.
 *   - A step of the server clock (a new step count, in a `time` message or the next hello)
 *     lines the page up at once after its four probes, even for 1.5 s; the same count
 *     leaves a difference under 2 s to the slew.
 *
 * What these tests deliberately do not cover:
 *   - The first hello, later probes, and a sleep of the page's machine;
 *     serverAlignedTime.test.ts.
 */
import { describe, expect, it, vi } from 'vitest';

import {
  readServerAlignedTimeMs,
  readThisMachineMonotonicTimeMs,
  startLiningUpAgainIfTheServerClockStepped,
  startLiningUpAtAHello,
} from './serverAlignedTime.js';
import {
  holdTheMachineClockAt,
  lineUpWithFourProbes,
  measureHowFarBehindTheServer,
  renderMachineLagMs,
  sendAProbeAndTakeItsAnswer,
  serverTimeMs,
  takeAHello,
  takeAnAnswerDelayedOnTheWayBack,
} from './serverAlignedTime.testSupport.js';

describe('a new hello on a page already lined up', () => {
  it('never shows time going back, late as the hello is and uneven as the probes are', () => {
    // Arrange: a page lined up on a server 2.3 s ahead; the time read is written down
    // every 5 ms from here on.
    holdTheMachineClockAt(serverTimeMs - renderMachineLagMs);
    lineUpWithFourProbes(renderMachineLagMs);
    const timesReadMs: number[] = [readServerAlignedTimeMs()];
    function letTimePassReadingEvery5Ms(durationMs: number): void {
      for (let passedMs = 0; passedMs < durationMs; passedMs += 5) {
        vi.advanceTimersByTime(5);
        timesReadMs.push(readServerAlignedTimeMs());
      }
    }

    // Act: the WebSocket drops and reconnects mid-race. The new hello was 400 ms on its
    // way (a full hello on a busy network); meanwhile this machine drifted 300 ms behind.
    // Its four probes come back unevenly: one held up 80 ms on the way back only.
    letTimePassReadingEvery5Ms(1_000);
    const serverAheadAfterTheDriftMs = renderMachineLagMs + 300;
    takeAHello(serverAheadAfterTheDriftMs, { lateByMs: 400, serverClockStepCount: 0 });
    timesReadMs.push(readServerAlignedTimeMs());
    sendAProbeAndTakeItsAnswer(serverAheadAfterTheDriftMs, 30);
    takeAnAnswerDelayedOnTheWayBack(serverAheadAfterTheDriftMs, 80);
    sendAProbeAndTakeItsAnswer(serverAheadAfterTheDriftMs, 8);
    sendAProbeAndTakeItsAnswer(serverAheadAfterTheDriftMs, 12);
    timesReadMs.push(readServerAlignedTimeMs());
    letTimePassReadingEvery5Ms(90_000);

    // Assert: every reading at or after the one before (the 12:38 → 12:37 → 12:38 this
    // item exists to remove); and after the minute the slew needs, the server's time.
    const stepsBack = timesReadMs
      .slice(1)
      .filter((timeReadMs, readingNumber) => timeReadMs < (timesReadMs[readingNumber] ?? 0));
    expect(stepsBack, 'time on air must never go back across a reconnect').toEqual([]);
    expect(
      measureHowFarBehindTheServer(serverAheadAfterTheDriftMs),
      'the 300 ms are slewed, from the best probe',
    ).toBe(0);
  });

  it('keeps the alignment through a hello with no time in it', () => {
    // Arrange: a page lined up on a server 2.3 s ahead.
    holdTheMachineClockAt(serverTimeMs - renderMachineLagMs);
    lineUpWithFourProbes(renderMachineLagMs);

    // Act: a stand-in server's hello, with no serverNowMs and no step count.
    startLiningUpAtAHello(
      { serverNowMs: undefined, serverClockStepCount: undefined },
      readThisMachineMonotonicTimeMs(),
    );

    // Assert: still the server's time.
    expect(measureHowFarBehindTheServer(renderMachineLagMs), 'nothing to line up with').toBe(0);
  });
});

describe('a step of the server clock', () => {
  const stepScenarios = [
    // The step is told by the `time` message the server sends at once after it.
    { name: 'told by a time message', isToldByAHello: false },
    // A page that was reconnecting at the step hears of it in its next hello.
    { name: 'told by the next hello', isToldByAHello: true },
  ];

  it.each(stepScenarios)(
    'lines the page up at once after four probes, even for 1.5 s, $name',
    ({ isToldByAHello }) => {
      // Arrange: a page lined up on a server 2.3 s ahead, whose clock has stepped 0 times.
      holdTheMachineClockAt(serverTimeMs - renderMachineLagMs);
      lineUpWithFourProbes(renderMachineLagMs);

      // Act: the server clock steps 1.5 s forwards ("Acertar relógio agora"); the page
      // hears the new step count, then its four probes are answered.
      const serverAheadAfterTheStepMs = renderMachineLagMs + 1_500;
      if (isToldByAHello) {
        takeAHello(serverAheadAfterTheStepMs, { lateByMs: 20, serverClockStepCount: 1 });
      } else {
        startLiningUpAgainIfTheServerClockStepped(1);
      }
      for (let probeNumber = 0; probeNumber < 4; probeNumber += 1) {
        sendAProbeAndTakeItsAnswer(serverAheadAfterTheStepMs, 6);
      }

      // Assert: on the server's new time at once, as everything else on air.
      expect(
        measureHowFarBehindTheServer(serverAheadAfterTheStepMs),
        'a race clock taken now must not show 1.5 s wrong for five minutes',
      ).toBe(0);
    },
  );

  it('slews as usual when the time message brings the same step count', () => {
    // Arrange: a page lined up on a server 2.3 s ahead, whose clock has stepped 0 times.
    holdTheMachineClockAt(serverTimeMs - renderMachineLagMs);
    lineUpWithFourProbes(renderMachineLagMs);

    // Act: a time message with the same count; its probe finds the page 1.5 s behind.
    startLiningUpAgainIfTheServerClockStepped(0);
    sendAProbeAndTakeItsAnswer(renderMachineLagMs + 1_500, 6);
    vi.advanceTimersByTime(1_000);

    // Assert: 5 ms of the 1.5 s covered in that second: slewed, not jumped.
    expect(
      measureHowFarBehindTheServer(renderMachineLagMs + 1_500),
      'without a step of the server clock, under 2 s is the page drifting: slewed',
    ).toBe(1_495);
  });
});
