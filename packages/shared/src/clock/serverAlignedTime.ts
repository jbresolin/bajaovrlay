/**
 * The server clock, as well as a page can know it. The graphics (and the control page's
 * "Edição rápida") read "now" through here instead of Date.now(). A race clock counts
 * from a moment the SERVER stamped, so it must also ask for "now" on the server's clock,
 * or the difference between the two machines shows as a wrong time on air.
 *
 * How a page lines up (BAJAOVRLAY-62): the server keeps real time from NTP, which a
 * browser cannot ask (no UDP), so the page asks the server. At each `hello` it sends four
 * clock probes, one after another, and keeps the answer with the shortest round trip, by
 * the midpoint method: the server read its clock halfway between the probe's send and
 * the answer's arrival. What it does with that best answer depends on the page:
 * - not lined up yet: it lines up at once (until then the hello's own time holds it,
 *   one-way, so a few ms late);
 * - already lined up (a reconnect mid-race): the hello's time is ignored, being late by
 *   the hello's size and transit, and the best answer is slewed to, or lined up with at
 *   once from 2 s on (this machine slept), so a clock on air never goes back;
 * - after a step of the server clock to NTP (the step count of a `hello` or `time` is not
 *   the one seen last): lined up at once, as the server's own clock was.
 * Between answers it counts on this machine's monotonic time, never on its wall clock,
 * which WSL2's and Docker Desktop's time sync step under load. After the four, one probe
 * per ten-second `time` message corrects the page's own drift the same way: slewed at
 * most 0.5% of the time passing, lined up at once from 2 s on.
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

/** The offset in use, and where it is slewing to. */
type ServerClockAlignmentOfThePage = {
  /** Server clock minus this machine's monotonic time, at the anchor. */
  offsetAtTheAnchorMs: number;
  /** This machine's monotonic time when the offset was last set. */
  anchorMs: number;
  /** The offset the slew is heading for; the same as offsetAtTheAnchorMs when none. */
  targetOffsetMs: number;
  /** False while only a hello's one-way time lined it up; true once a probe did. */
  isLinedUpByAProbe: boolean;
};

/** The best probe answer so far: the offset it measured, its round trip, its arrival. */
type ProbeMeasurement = { measuredOffsetMs: number; roundTripMs: number; receivedAtMs: number };

/** The probes after a hello or a step: how many answered, the best yet, how it ends. */
type ProbeRound = {
  answersTaken: number;
  bestAnswer: ProbeMeasurement | undefined;
  /** True for a page not lined up by a probe yet, and after a step of the server clock. */
  isLiningUpAtOnce: boolean;
};

/** All the page keeps of the server clock. */
type ServerClockOfThePage = {
  alignment: ServerClockAlignmentOfThePage | undefined;
  probeRound: ProbeRound | undefined;
  /** The step count of the last `hello` or `time` that carried one. */
  serverClockStepCountSeen: number | undefined;
};

/** `globalThis` with the one property this file keeps on it. */
type GlobalThatMayHoldTheAlignment = typeof globalThis & {
  __bajaovrlayServerClockOfThePage?: ServerClockOfThePage | undefined;
};

const globalThatMayHoldTheAlignment: GlobalThatMayHoldTheAlignment = globalThis;

/** What the page keeps, or nothing yet. */
function readServerClockOfThePage(): ServerClockOfThePage {
  return (
    globalThatMayHoldTheAlignment.__bajaovrlayServerClockOfThePage ?? {
      alignment: undefined,
      probeRound: undefined,
      serverClockStepCountSeen: undefined,
    }
  );
}

/** Keeps what the page knows of the server clock, for every copy of this code to read. */
function keepServerClockOfThePage(serverClockOfThePage: ServerClockOfThePage): void {
  globalThatMayHoldTheAlignment.__bajaovrlayServerClockOfThePage = serverClockOfThePage;
}

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
 * Lines the page up at once with one time the server sent (`serverNowMs`, which arrived
 * when this machine's monotonic time read `localNowMs`), forgetting what came before.
 * Tests call it to set the server's time; a page calls startLiningUpAtAHello.
 */
export function lineUpWithTheServerClockAt(serverNowMs: number, localNowMs: number): void {
  const offsetMs = serverNowMs - localNowMs;
  keepServerClockOfThePage({
    alignment: {
      offsetAtTheAnchorMs: offsetMs,
      anchorMs: localNowMs,
      targetOffsetMs: offsetMs,
      isLinedUpByAProbe: false,
    },
    probeRound: undefined,
    serverClockStepCountSeen: undefined,
  });
}

/** A hello as the alignment reads it; both fields are missing in a stand-in server's. */
export type HelloAsSeen = {
  serverNowMs?: number | undefined;
  serverClockStepCount?: number | undefined;
};

/**
 * Starts the four probes of a hello that arrived when this machine's monotonic time read
 * `localNowMs` (the page then sends the first probe). A page not lined up yet lines up at
 * once with the hello's own time, to hold it until the probes answer; a page already
 * lined up keeps its offset, so a late hello never moves a clock on air.
 */
export function startLiningUpAtAHello(hello: HelloAsSeen, localNowMs: number): void {
  const { alignment, serverClockStepCountSeen } = readServerClockOfThePage();
  const hasTheServerClockStepped = isANewStepCount(
    serverClockStepCountSeen,
    hello.serverClockStepCount,
  );
  const isLinedUpByAProbe = alignment?.isLinedUpByAProbe === true;
  const offsetFromTheHelloMs =
    hello.serverNowMs === undefined ? undefined : hello.serverNowMs - localNowMs;
  const alignmentUntilTheProbes =
    isLinedUpByAProbe || offsetFromTheHelloMs === undefined
      ? alignment
      : {
          offsetAtTheAnchorMs: offsetFromTheHelloMs,
          anchorMs: localNowMs,
          targetOffsetMs: offsetFromTheHelloMs,
          isLinedUpByAProbe: false,
        };
  keepServerClockOfThePage({
    alignment: alignmentUntilTheProbes,
    probeRound: {
      answersTaken: 0,
      bestAnswer: undefined,
      isLiningUpAtOnce: !isLinedUpByAProbe || hasTheServerClockStepped,
    },
    serverClockStepCountSeen: hello.serverClockStepCount ?? serverClockStepCountSeen,
  });
}

/**
 * Reads the step count of a `time` message: a count other than the one seen last means
 * the server clock stepped, and four probes line the page up at once, as after a first
 * hello. The page sends its probe for the `time` message either way.
 */
export function startLiningUpAgainIfTheServerClockStepped(
  serverClockStepCount: number | undefined,
): void {
  const serverClockOfThePage = readServerClockOfThePage();
  const { serverClockStepCountSeen } = serverClockOfThePage;
  if (serverClockStepCount === undefined) {
    return;
  }
  const hasTheServerClockStepped = isANewStepCount(serverClockStepCountSeen, serverClockStepCount);
  keepServerClockOfThePage({
    ...serverClockOfThePage,
    probeRound: hasTheServerClockStepped
      ? { answersTaken: 0, bestAnswer: undefined, isLiningUpAtOnce: true }
      : serverClockOfThePage.probeRound,
    serverClockStepCountSeen: serverClockStepCount,
  });
}

/** Whether a step count differs from the one seen last (never, when either is unknown). */
function isANewStepCount(countSeen: number | undefined, countNow: number | undefined): boolean {
  return countSeen !== undefined && countNow !== undefined && countSeen !== countNow;
}

/** A probe's answer as the page saw it: when it sent it, what the server said, when it came. */
export type ClockProbeAnswerAsSeen = {
  pageSentAtMs: number;
  serverNowMs: number;
  pageReceivedAtMs: number;
};

/**
 * Takes one probe's answer. During the four probes of a hello or a step, it keeps the
 * one with the shortest round trip and asks for another; at the fourth it acts on the
 * best. A later answer (one per `time` message) is acted on alone. Acting on an answer:
 * lined up at once when the round says so; otherwise a difference of 2 s or more lines up
 * at once, a smaller one is slewed, at most 0.5% of the time passing. An answer slower
 * than a second is left aside, unless the page has nothing better.
 */
export function recordClockProbeAnswer(answer: ClockProbeAnswerAsSeen): {
  isAnotherProbeNeeded: boolean;
} {
  const roundTripMs = answer.pageReceivedAtMs - answer.pageSentAtMs;
  if (roundTripMs < 0) {
    // An answer received before it was sent cannot be: nothing to learn from it.
    return { isAnotherProbeNeeded: false };
  }
  const midpointMs = (answer.pageSentAtMs + answer.pageReceivedAtMs) / 2;
  const measurement: ProbeMeasurement = {
    measuredOffsetMs: answer.serverNowMs - midpointMs,
    roundTripMs,
    receivedAtMs: answer.pageReceivedAtMs,
  };
  const serverClockOfThePage = readServerClockOfThePage();
  // An answer with no round going and no alignment (a probe sent before any hello) starts
  // a round, as a hello with no time would.
  const probeRound =
    serverClockOfThePage.probeRound ??
    (serverClockOfThePage.alignment === undefined
      ? { answersTaken: 0, bestAnswer: undefined, isLiningUpAtOnce: true }
      : undefined);
  if (probeRound === undefined) {
    keepServerClockOfThePage({
      ...serverClockOfThePage,
      alignment: actOnAMeasurement(serverClockOfThePage.alignment, measurement, false),
    });
    return { isAnotherProbeNeeded: false };
  }

  const answersTaken = probeRound.answersTaken + 1;
  const isTheBestYet =
    probeRound.bestAnswer === undefined || roundTripMs <= probeRound.bestAnswer.roundTripMs;
  const bestAnswer = isTheBestYet ? measurement : probeRound.bestAnswer;
  if (answersTaken < probesAfterAHello || bestAnswer === undefined) {
    keepServerClockOfThePage({
      ...serverClockOfThePage,
      probeRound: { ...probeRound, answersTaken, bestAnswer },
    });
    return { isAnotherProbeNeeded: true };
  }
  keepServerClockOfThePage({
    ...serverClockOfThePage,
    alignment: actOnAMeasurement(
      serverClockOfThePage.alignment,
      bestAnswer,
      probeRound.isLiningUpAtOnce,
    ),
    probeRound: undefined,
  });
  return { isAnotherProbeNeeded: false };
}

/**
 * The alignment after one measurement: lined up at once with it when asked to, or when
 * there is nothing to slew from, or when it is 2 s or more away; otherwise slewing to it
 * from the offset in use. A measurement over a second of round trip changes nothing on a
 * page already lined up.
 */
function actOnAMeasurement(
  alignment: ServerClockAlignmentOfThePage | undefined,
  measurement: ProbeMeasurement,
  isLiningUpAtOnce: boolean,
): ServerClockAlignmentOfThePage {
  const linedUpAtOnce: ServerClockAlignmentOfThePage = {
    offsetAtTheAnchorMs: measurement.measuredOffsetMs,
    anchorMs: measurement.receivedAtMs,
    targetOffsetMs: measurement.measuredOffsetMs,
    isLinedUpByAProbe: true,
  };
  if (alignment === undefined || isLiningUpAtOnce) {
    return linedUpAtOnce;
  }
  if (measurement.roundTripMs > longestRoundTripTakenMs) {
    return alignment;
  }
  const offsetNowMs = readOffsetAt(alignment, measurement.receivedAtMs);
  const differenceMs = measurement.measuredOffsetMs - offsetNowMs;
  if (Math.abs(differenceMs) >= differenceLinedUpAtOnceMs) {
    return linedUpAtOnce;
  }
  return {
    offsetAtTheAnchorMs: offsetNowMs,
    anchorMs: measurement.receivedAtMs,
    targetOffsetMs: measurement.measuredOffsetMs,
    isLinedUpByAProbe: true,
  };
}

/**
 * The shared "now": this machine's monotonic time plus the offset in use, which is the
 * server clock in whole milliseconds since 1970; or this machine's wall clock when the
 * page was never lined up (a preview page). Cheap enough to call on every frame.
 */
export function readServerAlignedTimeMs(): number {
  const { alignment } = readServerClockOfThePage();
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
  globalThatMayHoldTheAlignment.__bajaovrlayServerClockOfThePage = undefined;
}
