/**
 * Reads the theme's motion tokens (`--motion-*`, `--ease-*` in ardosia/tokens.css) from
 * an element's computed style, so a graphic's GSAP timelines take their durations and
 * eases from the theme like their colours. A missing or unreadable token never throws:
 * a duration reads as 0 (no motion) and an ease as `linear`, so every action still ends.
 */

/** The motion tokens as numbers (milliseconds, pixels) and ease strings. */
export type MotionTokens = {
  /** `--motion-in`: a piece entering (rise and fade up). */
  inMs: number;
  /** `--motion-out`: a piece leaving. */
  outMs: number;
  /** `--motion-row-stagger`: the delay between one tower row and the next on entry. */
  rowStaggerMs: number;
  /** `--motion-lead`: how long the tower starts after the clock. */
  leadMs: number;
  /** `--motion-swap`: two pills trading places (FLIP). */
  swapMs: number;
  /** `--motion-flag`: the new flag band crossfading over the old. */
  flagMs: number;
  /** `--motion-strip-page`: a strip or tower page turning. */
  stripPageMs: number;
  /** `--motion-strip-hold`: how long a page stays still. */
  stripHoldMs: number;
  /** `--motion-cue-hold`: how long the ▲ / ▼ and the coloured cell stay after a swap. */
  cueHoldMs: number;
  /** `--motion-in-offset`: how many pixels a piece rises on entry and lifts on exit. */
  inOffsetPx: number;
  /** `--ease-out`: the curve of every entry, as a CSS cubic-bezier string. */
  easeOut: string;
  /** `--ease-in`: the curve of every exit. */
  easeIn: string;
  /** `--ease-in-out`: the curve of a swap. */
  easeInOut: string;
};

/**
 * The ease answered when a token is missing: valid CSS, and gsapEaseOfToken turns it
 * into GSAP's `none`, so a graphic on a page without the theme still animates straight.
 */
export const fallbackEase = 'linear';

/**
 * Reads every motion token from the computed style of `element` (custom properties
 * reach inside a shadow root, so a graphic passes itself). Numbers are milliseconds
 * and pixels; a token that is missing or not a number reads as 0.
 */
export function readMotionTokens(element: Element): MotionTokens {
  const computedStyle = getComputedStyle(element);

  /** The token's value as the theme wrote it, trimmed; empty when the token is missing. */
  function readToken(tokenName: string): string {
    return computedStyle.getPropertyValue(tokenName).trim();
  }

  return {
    inMs: readDurationInMilliseconds(readToken('--motion-in')),
    outMs: readDurationInMilliseconds(readToken('--motion-out')),
    rowStaggerMs: readDurationInMilliseconds(readToken('--motion-row-stagger')),
    leadMs: readDurationInMilliseconds(readToken('--motion-lead')),
    swapMs: readDurationInMilliseconds(readToken('--motion-swap')),
    flagMs: readDurationInMilliseconds(readToken('--motion-flag')),
    stripPageMs: readDurationInMilliseconds(readToken('--motion-strip-page')),
    stripHoldMs: readDurationInMilliseconds(readToken('--motion-strip-hold')),
    cueHoldMs: readDurationInMilliseconds(readToken('--motion-cue-hold')),
    inOffsetPx: readLengthInPixels(readToken('--motion-in-offset')),
    easeOut: readEase(readToken('--ease-out')),
    easeIn: readEase(readToken('--ease-in')),
    easeInOut: readEase(readToken('--ease-in-out')),
  };
}

/**
 * Turns `400ms`, `0.4s` or a bare `400` into milliseconds. Anything that is not a
 * number (an empty value, a word) is 0: no motion is safer on air than a NaN GSAP
 * would turn into a timeline that never ends.
 */
function readDurationInMilliseconds(tokenValue: string): number {
  const isWrittenInSeconds = tokenValue.endsWith('s') && !tokenValue.endsWith('ms');
  const numberPart = Number.parseFloat(tokenValue);
  if (Number.isNaN(numberPart)) {
    return 0;
  }
  if (isWrittenInSeconds) {
    return numberPart * 1000;
  }
  return numberPart;
}

/** Turns `20px` or a bare `20` into a number of pixels; anything else is 0. */
function readLengthInPixels(tokenValue: string): number {
  const numberPart = Number.parseFloat(tokenValue);
  if (Number.isNaN(numberPart)) {
    return 0;
  }
  return numberPart;
}

/** The ease string as written, or the linear fallback when the token is missing. */
function readEase(tokenValue: string): string {
  if (tokenValue === '') {
    return fallbackEase;
  }
  return tokenValue;
}
