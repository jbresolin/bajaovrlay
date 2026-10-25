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
  /** `--motion-notice-hold`: how long a notice (fastest lap, penalty) is meant to stay up. */
  noticeHoldMs: number;
  /** `--motion-board-hold`: how long a standings page stays still. */
  boardHoldMs: number;
  /** `--motion-page-stagger`: the delay between pieces when a page turns in place. */
  pageStaggerMs: number;
  /** `--motion-sponsor-hold`: a sponsor page of a level with no hold of its own (Bronze). */
  sponsorHoldMs: number;
  /** `--motion-sponsor-hold-diamante`: how long a Diamante sponsor page stays (BAJAOVRLAY-46). */
  sponsorHoldDiamanteMs: number;
  /** `--motion-sponsor-hold-ouro`: an Ouro page. */
  sponsorHoldOuroMs: number;
  /** `--motion-sponsor-hold-prata`: a Prata page. */
  sponsorHoldPrataMs: number;
  /** `--motion-sponsor-hold-apoio`: an Apoio page. */
  sponsorHoldApoioMs: number;
  /** `--motion-sponsor-hold-realizacao`: the organiser's page, last in every round. */
  sponsorHoldRealizacaoMs: number;
  /** `--motion-in-offset`: how many pixels a piece rises on entry and lifts on exit. */
  inOffsetPx: number;
  /** `--motion-podium-offset`: how many pixels a podium card rises when it is revealed. */
  podiumOffsetPx: number;
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
 * The CSS custom property each field of MotionTokens is read from. `readMotionTokens`
 * reads through this very list, and motionTokensDeclaredInTheme.test.ts checks every
 * name here is declared in ardosia/tokens.css, so a token read by a graphic but missing
 * from the theme (which would silently animate at 0 ms) is caught by a test, not on air.
 */
export const motionTokenNames: Record<keyof MotionTokens, string> = {
  inMs: '--motion-in',
  outMs: '--motion-out',
  rowStaggerMs: '--motion-row-stagger',
  leadMs: '--motion-lead',
  swapMs: '--motion-swap',
  flagMs: '--motion-flag',
  stripPageMs: '--motion-strip-page',
  stripHoldMs: '--motion-strip-hold',
  cueHoldMs: '--motion-cue-hold',
  noticeHoldMs: '--motion-notice-hold',
  boardHoldMs: '--motion-board-hold',
  pageStaggerMs: '--motion-page-stagger',
  sponsorHoldMs: '--motion-sponsor-hold',
  sponsorHoldDiamanteMs: '--motion-sponsor-hold-diamante',
  sponsorHoldOuroMs: '--motion-sponsor-hold-ouro',
  sponsorHoldPrataMs: '--motion-sponsor-hold-prata',
  sponsorHoldApoioMs: '--motion-sponsor-hold-apoio',
  sponsorHoldRealizacaoMs: '--motion-sponsor-hold-realizacao',
  inOffsetPx: '--motion-in-offset',
  podiumOffsetPx: '--motion-podium-offset',
  easeOut: '--ease-out',
  easeIn: '--ease-in',
  easeInOut: '--ease-in-out',
};

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
    inMs: readDurationInMilliseconds(readToken(motionTokenNames.inMs)),
    outMs: readDurationInMilliseconds(readToken(motionTokenNames.outMs)),
    rowStaggerMs: readDurationInMilliseconds(readToken(motionTokenNames.rowStaggerMs)),
    leadMs: readDurationInMilliseconds(readToken(motionTokenNames.leadMs)),
    swapMs: readDurationInMilliseconds(readToken(motionTokenNames.swapMs)),
    flagMs: readDurationInMilliseconds(readToken(motionTokenNames.flagMs)),
    stripPageMs: readDurationInMilliseconds(readToken(motionTokenNames.stripPageMs)),
    stripHoldMs: readDurationInMilliseconds(readToken(motionTokenNames.stripHoldMs)),
    cueHoldMs: readDurationInMilliseconds(readToken(motionTokenNames.cueHoldMs)),
    noticeHoldMs: readDurationInMilliseconds(readToken(motionTokenNames.noticeHoldMs)),
    boardHoldMs: readDurationInMilliseconds(readToken(motionTokenNames.boardHoldMs)),
    pageStaggerMs: readDurationInMilliseconds(readToken(motionTokenNames.pageStaggerMs)),
    sponsorHoldMs: readDurationInMilliseconds(readToken(motionTokenNames.sponsorHoldMs)),
    sponsorHoldDiamanteMs: readDurationInMilliseconds(
      readToken(motionTokenNames.sponsorHoldDiamanteMs),
    ),
    sponsorHoldOuroMs: readDurationInMilliseconds(readToken(motionTokenNames.sponsorHoldOuroMs)),
    sponsorHoldPrataMs: readDurationInMilliseconds(readToken(motionTokenNames.sponsorHoldPrataMs)),
    sponsorHoldApoioMs: readDurationInMilliseconds(readToken(motionTokenNames.sponsorHoldApoioMs)),
    sponsorHoldRealizacaoMs: readDurationInMilliseconds(
      readToken(motionTokenNames.sponsorHoldRealizacaoMs),
    ),
    inOffsetPx: readLengthInPixels(readToken(motionTokenNames.inOffsetPx)),
    podiumOffsetPx: readLengthInPixels(readToken(motionTokenNames.podiumOffsetPx)),
    easeOut: readEase(readToken(motionTokenNames.easeOut)),
    easeIn: readEase(readToken(motionTokenNames.easeIn)),
    easeInOut: readEase(readToken(motionTokenNames.easeInOut)),
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
