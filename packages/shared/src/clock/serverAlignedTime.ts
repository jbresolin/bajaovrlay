/**
 * The server's wall clock, as well as a page can know it: the renderer and the control
 * page record what the server's clock said in each message, and the graphics (and the
 * control page's "Edição rápida") read "now" through here instead of Date.now(). A race clock counts from a moment the SERVER stamped, so it must also
 * ask for "now" on the server's clock, or the difference between the two machines shows
 * as a wrong time on air.
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
 * - The offset only moves when messages arrive. The server sends a `time` message every
 *   ten seconds for exactly that, so if the machine's clock steps, the time read stays
 *   wrong until three of them have come (the median of five), about thirty seconds.
 * - It imports nothing but its neighbour on purpose: graphics bundle this folder.
 */
import {
  computeMedianOfOffsetSamples,
  keepLatestOffsetSamples,
} from './serverClockOffsetSamples.js';

/** What the page keeps between messages: the latest samples and the offset in use. */
type ServerClockOffsetOfThePage = {
  /** Server clock minus this machine's clock, one per message, oldest first, in ms. */
  offsetSamplesMs: number[];
  /** The median of those samples: what is added to this machine's clock. */
  offsetMs: number;
};

/** `globalThis` with the one property this file keeps on it. */
type GlobalThatMayHoldTheOffset = typeof globalThis & {
  __bajaovrlayServerClockOffset?: ServerClockOffsetOfThePage | undefined;
};

const globalThatMayHoldTheOffset: GlobalThatMayHoldTheOffset = globalThis;

/**
 * Records one sample: the server's clock read `serverNowMs` in a message that arrived
 * when this machine's clock read `localNowMs`. The renderer and the control page call it
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
 * The shared "now": this machine's clock plus the recorded offset, which is the server's
 * wall clock in milliseconds since 1970; or this machine's clock as it is when no sample
 * was ever recorded on the page. Cheap enough to call on every frame.
 */
export function readServerAlignedTimeMs(): number {
  const localNowMs = Date.now();
  const offsetOfThePage = globalThatMayHoldTheOffset.__bajaovrlayServerClockOffset;
  if (offsetOfThePage === undefined) {
    return localNowMs;
  }
  return localNowMs + offsetOfThePage.offsetMs;
}

/**
 * Forgets every sample, so the time read is this machine's own again. For tests, which
 * share one `globalThis` per file and must not see each other's offset.
 */
export function forgetServerClockSamples(): void {
  globalThatMayHoldTheOffset.__bajaovrlayServerClockOffset = undefined;
}
