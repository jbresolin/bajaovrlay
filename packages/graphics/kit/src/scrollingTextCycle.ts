/**
 * The cycle of the texts too long for their boxes in one graphic (BAJAOVRLAY-55), as plain
 * arithmetic: no page, no GSAP, no clock. Each text that does not fit holds at its start,
 * scrolls at the theme's constant speed until its end shows, holds at its end and
 * crossfades back to its start. All the texts of one graphic share one cycle, as long as
 * the longest of them needs: they start scrolling together and come back together, the
 * shorter ones waiting at their end, so a tower of 20 rows reads calm, not chaotic.
 *
 * Texts are named by a key the caller chooses (the graphic's clock numbers its boxes).
 * scrollingTextWhenTooLong.ts measures the widths, plans a cycle here and builds its GSAP
 * timeline from readPhaseMomentsOfText; readScrollingTextPhaseAt answers where a text is
 * at a moment, which the tests read and the timeline must agree with.
 */
import type { ScrollingTextTimings } from './scrollingTextTimings.js';

/** A text's width and the width of the box it is clipped in, in pixels. */
export type ScrollingTextMeasure = {
  textWidthPx: number;
  boxWidthPx: number;
};

/** One cycle of a graphic: its length and how far each text in it scrolls. */
export type ScrollingTextCycle = {
  /** The whole cycle, from the start of the first hold to the end of the return; 0: none. */
  durationMs: number;
  /** The texts that scroll in this cycle by key, each with its distance in pixels. */
  scrollDistancePxByName: ReadonlyMap<string, number>;
};

/** What a text is doing at a moment of the cycle. */
export type ScrollingTextPhaseName =
  | 'restingAtStart'
  | 'holdingAtStart'
  | 'scrolling'
  | 'holdingAtEnd'
  | 'fadingOutAtEnd'
  | 'fadingInAtStart';

/** Where a text is at a moment: its phase, how far it is moved (≤ 0) and its opacity. */
export type ScrollingTextPhase = {
  phase: ScrollingTextPhaseName;
  offsetPx: number;
  opacity: number;
};

/** The moments of one text's cycle, in milliseconds from the cycle's start. */
export type ScrollingTextPhaseMoments = {
  scrollStartsAtMs: number;
  scrollEndsAtMs: number;
  returnStartsAtMs: number;
  /** Halfway through the return: the end has faded out, the text jumps back to its start. */
  returnSwitchesAtMs: number;
  cycleEndsAtMs: number;
};

const restingAtStart: ScrollingTextPhase = { phase: 'restingAtStart', offsetPx: 0, opacity: 1 };

/**
 * How far a text scrolls: 0 when it fits its box; otherwise what is cut off plus the edge
 * fade, so its last letter comes to rest clear of the fade at the box's far edge.
 */
export function measureScrollDistancePx(measure: ScrollingTextMeasure, edgeFadePx: number): number {
  const overflowPx = measure.textWidthPx - measure.boxWidthPx;
  const isTooLong = overflowPx > 0;
  if (!isTooLong) {
    return 0;
  }
  return overflowPx + edgeFadePx;
}

/** How long a text takes to scroll `scrollDistancePx` at the theme's speed. */
function measureScrollDurationMs(scrollDistancePx: number, timings: ScrollingTextTimings): number {
  return (scrollDistancePx / timings.scrollSpeedPxPerSecond) * 1000;
}

/**
 * Plans one cycle from the texts measured at its start: the texts that do not fit join,
 * and the cycle is as long as the longest of them needs. With none, the cycle lasts 0.
 */
export function planScrollingTextCycle(
  measuresByName: ReadonlyMap<string, ScrollingTextMeasure>,
  timings: ScrollingTextTimings,
): ScrollingTextCycle {
  const scrollDistancePxByName = new Map<string, number>();
  let longestScrollMs = 0;
  for (const [name, measure] of measuresByName) {
    const scrollDistancePx = measureScrollDistancePx(measure, timings.edgeFadePx);
    if (scrollDistancePx === 0) {
      continue;
    }
    scrollDistancePxByName.set(name, scrollDistancePx);
    longestScrollMs = Math.max(longestScrollMs, measureScrollDurationMs(scrollDistancePx, timings));
  }
  if (scrollDistancePxByName.size === 0) {
    return { durationMs: 0, scrollDistancePxByName };
  }
  const durationMs = timings.holdStartMs + longestScrollMs + timings.holdEndMs + timings.returnMs;
  return { durationMs, scrollDistancePxByName };
}

/**
 * The cycle without one text (its text changed, or its box resized, during the cycle): it
 * rests at its start until the next cycle measures it again. The cycle keeps its length,
 * so no other text jumps.
 */
export function leaveTextOutOfTheCycle(
  cycle: ScrollingTextCycle,
  name: string,
): ScrollingTextCycle {
  const scrollDistancePxByName = new Map(cycle.scrollDistancePxByName);
  scrollDistancePxByName.delete(name);
  return { durationMs: cycle.durationMs, scrollDistancePxByName };
}

/** The moments of a text's cycle, or undefined for a text that is not in the cycle. */
export function readPhaseMomentsOfText(
  cycle: ScrollingTextCycle,
  name: string,
  timings: ScrollingTextTimings,
): ScrollingTextPhaseMoments | undefined {
  const scrollDistancePx = cycle.scrollDistancePxByName.get(name);
  if (scrollDistancePx === undefined) {
    return undefined;
  }
  const scrollStartsAtMs = timings.holdStartMs;
  const scrollEndsAtMs = scrollStartsAtMs + measureScrollDurationMs(scrollDistancePx, timings);
  const returnStartsAtMs = cycle.durationMs - timings.returnMs;
  const returnSwitchesAtMs = cycle.durationMs - timings.returnMs / 2;
  return {
    scrollStartsAtMs,
    scrollEndsAtMs,
    returnStartsAtMs,
    returnSwitchesAtMs,
    cycleEndsAtMs: cycle.durationMs,
  };
}

/**
 * Where a text is `msSinceCycleStart` into the cycle. A text not in the cycle (it fits,
 * or changed during it) and any text once the cycle has ended rest at their start.
 */
export function readScrollingTextPhaseAt(
  cycle: ScrollingTextCycle,
  name: string,
  msSinceCycleStart: number,
  timings: ScrollingTextTimings,
): ScrollingTextPhase {
  const moments = readPhaseMomentsOfText(cycle, name, timings);
  const scrollDistancePx = cycle.scrollDistancePxByName.get(name);
  if (moments === undefined || scrollDistancePx === undefined) {
    return restingAtStart;
  }
  const now = msSinceCycleStart;
  if (now >= moments.cycleEndsAtMs) {
    return restingAtStart;
  }
  if (now < moments.scrollStartsAtMs) {
    return { phase: 'holdingAtStart', offsetPx: 0, opacity: 1 };
  }
  if (now < moments.scrollEndsAtMs) {
    const scrolledPx = ((now - moments.scrollStartsAtMs) / 1000) * timings.scrollSpeedPxPerSecond;
    return { phase: 'scrolling', offsetPx: -scrolledPx, opacity: 1 };
  }
  if (now < moments.returnStartsAtMs) {
    return { phase: 'holdingAtEnd', offsetPx: -scrollDistancePx, opacity: 1 };
  }
  const halfReturnMs = timings.returnMs / 2;
  if (now < moments.returnSwitchesAtMs) {
    const fadedShare = (now - moments.returnStartsAtMs) / halfReturnMs;
    return { phase: 'fadingOutAtEnd', offsetPx: -scrollDistancePx, opacity: 1 - fadedShare };
  }
  const shownShare = (now - moments.returnSwitchesAtMs) / halfReturnMs;
  return { phase: 'fadingInAtStart', offsetPx: 0, opacity: shownShare };
}
