// Test support: a page's machine on Vitest's fake Date and fake performance, and the
// probes and hellos it gets from a server whose clock is ahead of the machine's by a
// chosen amount. Used by the tests of serverAlignedTime.ts; each call works on the one
// alignment of the page (globalThis), which holdTheMachineClockAt forgets at both ends.
import { onTestFinished, vi } from 'vitest';

import {
  forgetTheServerClockAlignment,
  readServerAlignedTimeMs,
  readThisMachineMonotonicTimeMs,
  recordClockProbeAnswer,
  startLiningUpAtAHello,
} from './serverAlignedTime.js';

/** 9 October 2026, 14:32:05 UTC on the server's clock: the enduro is under way. */
export const serverTimeMs = Date.parse('2026-10-09T14:32:05.000Z');

/** How far behind the server's the OBS machine's clock was seen to be. */
export const renderMachineLagMs = 2_300;

/**
 * Holds the machine's clocks (wall and monotonic) still at the given time, and makes
 * sure the alignment and the real clocks come back when the test ends, so no test sees
 * another one's alignment.
 */
export function holdTheMachineClockAt(machineTimeMs: number): void {
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
export function sendAProbeAndTakeItsAnswer(serverAheadMs: number, roundTripMs: number): boolean {
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
export function takeAnAnswerDelayedOnTheWayBack(
  serverAheadMs: number,
  extraWayBackMs: number,
): boolean {
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
 * A hello from a server ahead by this, arriving now, `lateByMs` after the server read its
 * clock (one-way: a large hello on a busy network), whose clock has stepped
 * `serverClockStepCount` times.
 */
export function takeAHello(
  serverAheadMs: number,
  hello: { lateByMs: number; serverClockStepCount?: number | undefined },
): void {
  const helloArrivedAtMs = readThisMachineMonotonicTimeMs();
  startLiningUpAtAHello(
    {
      serverNowMs: helloArrivedAtMs + serverAheadMs - hello.lateByMs,
      serverClockStepCount: hello.serverClockStepCount,
    },
    helloArrivedAtMs,
  );
}

/**
 * Lines the page up as at a hello, on a server ahead by this: the hello's own time
 * (20 ms late, one-way), then four probes of 6 ms.
 */
export function lineUpWithFourProbes(serverAheadMs: number): void {
  takeAHello(serverAheadMs, { lateByMs: 20, serverClockStepCount: 0 });
  for (let probeNumber = 0; probeNumber < 4; probeNumber += 1) {
    sendAProbeAndTakeItsAnswer(serverAheadMs, 6);
  }
}

/** How far the time read is behind what the server's clock reads now (server − page). */
export function measureHowFarBehindTheServer(serverAheadMs: number): number {
  return readThisMachineMonotonicTimeMs() + serverAheadMs - readServerAlignedTimeMs();
}
