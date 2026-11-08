/**
 * The server's wall clock, as well as a page can know it: the renderer and the control
 * page record what the server's clock said in each message, and the graphics (and the
 * control page's "Edição rápida") read "now" through here instead of Date.now(). A race
 * clock counts from a moment the SERVER stamped, so it must also ask for "now" on the
 * server's clock, or the difference between the two machines shows as a wrong time on air.
 *
 * Between samples it counts on this machine's monotonic time, never on its wall clock:
 * under load the time sync of WSL2 (and of Docker Desktop's VM, on the stream PC) steps
 * the wall clock by about a second every thirty, and a page counting on the wall clock
 * showed the step on air until new samples outvoted it (BAJAOVRLAY-62). The server's
 * side counts on monotonic time too (apps/server's core/time/serverClock.ts).
 *
 * Deliberate: what is recorded lives in one named property of `globalThis`, not in a
 * variable of this module. The renderer and each graphic are separate bundles, each
 * with its own copy of this file; a module variable would exist once per copy, and the
 * graphic would never see what the renderer recorded. One page has one `globalThis`.
 *
 * What could go wrong:
 * - A page that has recorded nothing (the preview page, a renderer or the control page
 *   before its first message) reads its own machine's clock, uncorrected.
 * - Every sample is late by the time its message spent on the network, so the time read
 *   is behind the server's by about that much (a few milliseconds on a local network).
 * - The offset only moves when messages arrive; the server sends a `time` message every
 *   ten seconds. If the two machines' monotonic times run at slightly different rates,
 *   the time read drifts between samples by that much (milliseconds a minute at most).
 * - It imports nothing but its neighbour on purpose: graphics bundle this folder.
 */
import {
  computeMedianOfOffsetSamples,
  keepLatestOffsetSamples,
} from './serverClockOffsetSamples.js';

/** What the page keeps between messages: the latest samples and the offset in use. */
type ServerClockOffsetOfThePage = {
  /** Server clock minus this machine's monotonic time, one per message, oldest first. */
  offsetSamplesMs: number[];
  /** The median of those samples: what is added to this machine's monotonic time. */
  offsetMs: number;
};

/** `globalThis` with the one property this file keeps on it. */
type GlobalThatMayHoldTheOffset = typeof globalThis & {
  __bajaovrlayServerClockOffset?: ServerClockOffsetOfThePage | undefined;
};

const globalThatMayHoldTheOffset: GlobalThatMayHoldTheOffset = globalThis;

/**
 * The part of `performance` read here. Every page and Node have it, but this package is
 * built with neither the DOM's types nor Node's, so it is named here instead.
 */
type MonotonicTimeOfThisMachine = { timeOrigin: number; now: () => number };

/** `globalThis` with the `performance` every page and Node give it. */
const globalWithPerformance = globalThis as typeof globalThis & {
  performance: MonotonicTimeOfThisMachine;
};

/**
 * This machine's monotonic time, in whole milliseconds since 1970: the moment the page
 * opened plus the time since, which a step of the wall clock never moves. Pass it as the
 * `localNowMs` of recordServerClockSample.
 */
export function readThisMachineMonotonicTimeMs(): number {
  const { performance } = globalWithPerformance;
  // Rounded down: a moment read here may become data (a snapshot's updatedAtMs), which
  // must be a whole number, and rounding down never makes the time move back.
  return Math.floor(performance.timeOrigin + performance.now());
}

/**
 * Records one sample: the server's clock read `serverNowMs` in a message that arrived
 * when this machine's monotonic time (readThisMachineMonotonicTimeMs) read `localNowMs`.
 * The renderer and the control page call it
 * for every `hello`, `slice` and `time` message that carries the server's time, and not
 * at all for one that does not. The offset in use becomes the median of the last five
 * samples.
 */
export function recordServerClockSample(serverNowMs: number, localNowMs: number): void {
  const offsetBefore = globalThatMayHoldTheOffset.__bajaovrlayServerClockOffset;
  const offsetSamplesMs = keepLatestOffsetSamples(
    offsetBefore?.offsetSamplesMs ?? [],
    serverNowMs - localNowMs,
  );
  // Never undefined here, since a sample was just added; zero only satisfies the type.
  const offsetMs = computeMedianOfOffsetSamples(offsetSamplesMs) ?? 0;
  globalThatMayHoldTheOffset.__bajaovrlayServerClockOffset = { offsetSamplesMs, offsetMs };
}

/**
 * The shared "now": this machine's monotonic time plus the recorded offset, which is the
 * server clock in milliseconds since 1970; or this machine's wall clock when no sample
 * was ever recorded on the page (a preview page). Cheap enough to call on every frame.
 */
export function readServerAlignedTimeMs(): number {
  const offsetOfThePage = globalThatMayHoldTheOffset.__bajaovrlayServerClockOffset;
  if (offsetOfThePage === undefined) {
    return Date.now();
  }
  return readThisMachineMonotonicTimeMs() + offsetOfThePage.offsetMs;
}

/**
 * Forgets every sample, so the time read is this machine's own again. For tests, which
 * share one `globalThis` per file and must not see each other's offset.
 */
export function forgetServerClockSamples(): void {
  globalThatMayHoldTheOffset.__bajaovrlayServerClockOffset = undefined;
}
