/**
 * The server clock, as well as a page can know it. The graphics (and the control page's
 * "Edição rápida") read "now" through here instead of Date.now(). A race clock counts
 * from a moment the SERVER stamped, so it must also ask for "now" on the server's clock,
 * or the difference between the two machines shows as a wrong time on air.
 *
 * How a page lines up (BAJAOVRLAY-62): the server keeps real time from NTP, which a
 * browser cannot ask (no UDP), so the page asks the server. At each `hello` it lines up
 * at once with the hello's own time (one-way, so a few ms late), then sends four clock
 * probes, one after another, and keeps the answer with the shortest round trip, by the
 * midpoint method: the server read its clock halfway between the probe's send and the
 * answer's arrival. Between answers it counts on this machine's monotonic time, never on
 * its wall clock, which WSL2's and Docker Desktop's time sync step under load.
 * After those four, one probe per ten-second `time` message corrects the page's own drift
 * by slewing at most 0.5% of the time passing, so a second on air never visibly
 * stretches; a difference of 2 s or more (this machine slept) is lined up at once.
 *
 * Deliberate: the alignment lives in one named property of `globalThis`, not in a
 * variable of this module. The renderer and each graphic are separate bundles, each with
 * its own copy of this file; a module variable would exist once per copy, and the graphic
 * would never see what the renderer lined up. One page has one `globalThis`.
 *
 * What could go wrong:
 * - A page with no alignment yet (a graphic's preview page) reads its own machine's
 *   clock, uncorrected.
 * - The midpoint assumes the probe took as long each way; a delay on one way only makes
 *   it wrong by half that delay. The shortest of four round trips leaves the least room,
 *   and an answer that took more than a second is left aside.
 * - It imports nothing on purpose: graphics bundle this folder.
 */

/** How many probes a page sends after each hello, keeping the shortest round trip. */
export const probesAfterAHello = 4;

/** A later difference this large is lined up at once (the machine slept), not slewed. */
const differenceLinedUpAtOnceMs = 2_000;

/** The most a slew moves the page's time, as a share of the time passing: 0.5%. */
const largestSlewShare = 0.005;

/** An answer slower than this tells no time: its midpoint could be off by half of it. */
const longestRoundTripTakenMs = 1_000;

/** What the page keeps between answers: the offset in use, and where it is slewing to. */
type ServerClockAlignmentOfThePage = {
  /** Server clock minus this machine's monotonic time, at the anchor. */
  offsetAtTheAnchorMs: number;
  /** This machine's monotonic time when the offset was last set. */
  anchorMs: number;
  /** The offset the slew is heading for; the same as offsetAtTheAnchorMs when none. */
  targetOffsetMs: number;
  /** Probe answers taken since the hello; up to four, they line up at once. */
  probeAnswersSinceTheHello: number;
  /** The shortest round trip since the hello; Infinity for the hello's one-way time. */
  shortestRoundTripMs: number;
};

/** `globalThis` with the one property this file keeps on it. */
type GlobalThatMayHoldTheAlignment = typeof globalThis & {
  __bajaovrlayServerClockAlignment?: ServerClockAlignmentOfThePage | undefined;
};

const globalThatMayHoldTheAlignment: GlobalThatMayHoldTheAlignment = globalThis;

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
 * opened plus the time since, which a step of the wall clock never moves. A probe's
 * `pageSentAtMs`, and the arrival of every message, are read here.
 */
export function readThisMachineMonotonicTimeMs(): number {
  const { performance } = globalWithPerformance;
  // Rounded down: a moment read here may become data (a snapshot's updatedAtMs), which
  // must be a whole number, and rounding down never makes the time move back.
  return Math.floor(performance.timeOrigin + performance.now());
}

/** The offset in use at a moment of monotonic time: the anchor's, plus the slew so far. */
function readOffsetAt(alignment: ServerClockAlignmentOfThePage, localNowMs: number): number {
  const differenceLeftMs = alignment.targetOffsetMs - alignment.offsetAtTheAnchorMs;
  const timeSinceTheAnchorMs = Math.max(localNowMs - alignment.anchorMs, 0);
  const mostTheSlewMovesMs = timeSinceTheAnchorMs * largestSlewShare;
  const slewSoFarMs = Math.min(Math.abs(differenceLeftMs), mostTheSlewMovesMs);
  return alignment.offsetAtTheAnchorMs + Math.sign(differenceLeftMs) * slewSoFarMs;
}

/**
 * Lines the page up at once with one time the server sent (a hello's `serverNowMs`,
 * which arrived when this machine's monotonic time read `localNowMs`), forgetting what
 * came before: a page whose machine slept starts afresh at the reconnect's hello. The
 * probes that follow replace it, since any round trip is shorter than an unknown one.
 * Tests call it to set the server's time.
 */
export function lineUpWithTheServerClockAt(serverNowMs: number, localNowMs: number): void {
  const offsetMs = serverNowMs - localNowMs;
  globalThatMayHoldTheAlignment.__bajaovrlayServerClockAlignment = {
    offsetAtTheAnchorMs: offsetMs,
    anchorMs: localNowMs,
    targetOffsetMs: offsetMs,
    probeAnswersSinceTheHello: 0,
    shortestRoundTripMs: Number.POSITIVE_INFINITY,
  };
}

/** A probe's answer as the page saw it: when it sent it, what the server said, when it came. */
export type ClockProbeAnswerAsSeen = {
  pageSentAtMs: number;
  serverNowMs: number;
  pageReceivedAtMs: number;
};

/**
 * Takes one probe's answer. Until four have come since the hello, each one with the
 * shortest round trip so far lines the page up at once, and another probe is asked for.
 * After that: a difference of 2 s or more lines up at once; a smaller one is slewed, at
 * most 0.5% of the time passing; an answer slower than a second is left aside.
 */
export function recordClockProbeAnswer(answer: ClockProbeAnswerAsSeen): {
  isAnotherProbeNeeded: boolean;
} {
  const roundTripMs = answer.pageReceivedAtMs - answer.pageSentAtMs;
  const midpointMs = (answer.pageSentAtMs + answer.pageReceivedAtMs) / 2;
  const measuredOffsetMs = answer.serverNowMs - midpointMs;
  if (roundTripMs < 0) {
    // An answer received before it was sent cannot be: nothing to learn from it.
    return { isAnotherProbeNeeded: false };
  }
  // A hello that carried no time (a stand-in server's) lined nothing up: the answers
  // after it line up as after any hello, the first one at once.
  const alignment =
    globalThatMayHoldTheAlignment.__bajaovrlayServerClockAlignment ??
    ({
      offsetAtTheAnchorMs: measuredOffsetMs,
      anchorMs: answer.pageReceivedAtMs,
      targetOffsetMs: measuredOffsetMs,
      probeAnswersSinceTheHello: 0,
      shortestRoundTripMs: Number.POSITIVE_INFINITY,
    } satisfies ServerClockAlignmentOfThePage);

  const isStillLiningUpAfterTheHello = alignment.probeAnswersSinceTheHello < probesAfterAHello;
  if (isStillLiningUpAfterTheHello) {
    const probeAnswersSinceTheHello = alignment.probeAnswersSinceTheHello + 1;
    const isTheShortestRoundTripYet = roundTripMs <= alignment.shortestRoundTripMs;
    globalThatMayHoldTheAlignment.__bajaovrlayServerClockAlignment = isTheShortestRoundTripYet
      ? {
          offsetAtTheAnchorMs: measuredOffsetMs,
          anchorMs: answer.pageReceivedAtMs,
          targetOffsetMs: measuredOffsetMs,
          probeAnswersSinceTheHello,
          shortestRoundTripMs: roundTripMs,
        }
      : { ...alignment, probeAnswersSinceTheHello };
    return { isAnotherProbeNeeded: probeAnswersSinceTheHello < probesAfterAHello };
  }

  if (roundTripMs > longestRoundTripTakenMs) {
    return { isAnotherProbeNeeded: false };
  }
  const offsetNowMs = readOffsetAt(alignment, answer.pageReceivedAtMs);
  const isTheDifferenceLarge =
    Math.abs(measuredOffsetMs - offsetNowMs) >= differenceLinedUpAtOnceMs;
  globalThatMayHoldTheAlignment.__bajaovrlayServerClockAlignment = {
    ...alignment,
    offsetAtTheAnchorMs: isTheDifferenceLarge ? measuredOffsetMs : offsetNowMs,
    anchorMs: answer.pageReceivedAtMs,
    targetOffsetMs: measuredOffsetMs,
  };
  return { isAnotherProbeNeeded: false };
}

/**
 * The shared "now": this machine's monotonic time plus the offset in use, which is the
 * server clock in whole milliseconds since 1970; or this machine's wall clock when the
 * page was never lined up (a preview page). Cheap enough to call on every frame.
 */
export function readServerAlignedTimeMs(): number {
  const alignment = globalThatMayHoldTheAlignment.__bajaovrlayServerClockAlignment;
  if (alignment === undefined) {
    return Date.now();
  }
  const localNowMs = readThisMachineMonotonicTimeMs();
  return Math.floor(localNowMs + readOffsetAt(alignment, localNowMs));
}

/**
 * Forgets the alignment, so the time read is this machine's own again. For tests, which
 * share one `globalThis` per file and must not see each other's alignment.
 */
export function forgetTheServerClockAlignment(): void {
  globalThatMayHoldTheAlignment.__bajaovrlayServerClockAlignment = undefined;
}
