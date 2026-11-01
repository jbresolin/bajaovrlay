/**
 * The timings of a text too long for its box (BAJAOVRLAY-55), read from the theme's
 * `--motion-text-*` tokens: the hold at its start, the scroll speed, the hold at its end,
 * the crossfade back and the width of the soft fade at the box's edges. Read anew at the
 * start of every cycle, so a token João tunes is followed on the next cycle.
 *
 * What could go wrong: readMotionTokens reads a missing token as 0. A speed of 0 would
 * leave a long name frozen at its start (a scroll of infinite length), and holds of 0 a
 * name never still long enough to read; so each timing that is not a positive number
 * falls back alone to Ardósia's starting value.
 */
import { readMotionTokens } from '@bajaovrlay/theme/motion';

/** How a scrolling text moves, in milliseconds and pixels. */
export type ScrollingTextTimings = {
  /** How long the text holds at its start before it scrolls. */
  holdStartMs: number;
  /** How fast it scrolls, constant: a longer text takes longer, never faster. */
  scrollSpeedPxPerSecond: number;
  /** How long it holds once its end shows. */
  holdEndMs: number;
  /** The crossfade back to its start: half a fade out at the end, half a fade in at the start. */
  returnMs: number;
  /** How wide the soft fade at the box's edges is while the text scrolls. */
  edgeFadePx: number;
};

/** Ardósia's starting values (ardosia/tokens.css), used for a token that is missing. */
export const scrollingTextTimingsWhenTokensMissing: ScrollingTextTimings = {
  holdStartMs: 2500,
  scrollSpeedPxPerSecond: 60,
  holdEndMs: 1500,
  returnMs: 250,
  edgeFadePx: 24,
};

/** Reads the scrolling text's timings from `element`'s computed style, each with its fallback. */
export function readScrollingTextTimings(element: Element): ScrollingTextTimings {
  const motionTokens = readMotionTokens(element);
  const fallbacks = scrollingTextTimingsWhenTokensMissing;
  return {
    holdStartMs: keepPositiveOrFallBack(motionTokens.textHoldStartMs, fallbacks.holdStartMs),
    scrollSpeedPxPerSecond: keepPositiveOrFallBack(
      motionTokens.textScrollSpeedPxPerSecond,
      fallbacks.scrollSpeedPxPerSecond,
    ),
    holdEndMs: keepPositiveOrFallBack(motionTokens.textHoldEndMs, fallbacks.holdEndMs),
    returnMs: keepPositiveOrFallBack(motionTokens.textReturnMs, fallbacks.returnMs),
    edgeFadePx: keepPositiveOrFallBack(motionTokens.textEdgeFadePx, fallbacks.edgeFadePx),
  };
}

/** The value read when it is a positive number, otherwise the fallback. */
function keepPositiveOrFallBack(valueRead: number, fallback: number): number {
  const isUsable = valueRead > 0;
  return isUsable ? valueRead : fallback;
}
