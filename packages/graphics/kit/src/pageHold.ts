/**
 * How long a page stays on air before the next, for every graphic that turns pages: the
 * lower strip and the message ticker read `--motion-strip-hold` (7 s in Ardósia), the
 * standings `--motion-board-hold` (10 s), the sponsor rounds their level's hold
 * (sponsorRound.ts). The hold is read anew before every wait, so a
 * token change is followed. A missing or unreadable token gives the graphic's fallback,
 * never a throw and never a 0: readMotionTokens reads a missing duration as 0, right for a
 * timeline (no motion, it still ends) and wrong for a hold (pages flipping every frame).
 */
import { type MotionTokens, readMotionTokens } from '@bajaovrlay/theme/motion';

/** The strip's and the ticker's hold when the token is missing: Ardósia's 7 s. */
export const stripHoldMsWhenTokenMissing = 7000;

/** The standings' hold when the token is missing: Ardósia's 10 s. */
export const boardHoldMsWhenTokenMissing = 10_000;

/**
 * The motion tokens that are page holds, by the name readMotionTokens gives them: the
 * strip's, the standings' and the sponsor rounds' (sponsorRound.ts, BAJAOVRLAY-46).
 */
export type PageHoldTokenKey =
  | 'stripHoldMs'
  | 'boardHoldMs'
  | 'sponsorHoldMs'
  | 'sponsorHoldDiamanteMs'
  | 'sponsorHoldOuroMs'
  | 'sponsorHoldPrataMs'
  | 'sponsorHoldApoioMs'
  | 'sponsorHoldRealizacaoMs';

/**
 * Reads a page hold from `element`'s computed style, in milliseconds, or `fallbackMs` when
 * the token is missing or not a positive duration.
 */
export function readHoldMsOrFallback(
  element: Element,
  tokenKey: PageHoldTokenKey,
  fallbackMs: number,
): number {
  const motionTokens: MotionTokens = readMotionTokens(element);
  const holdMs = motionTokens[tokenKey];
  const isHoldUsable = holdMs > 0;
  return isHoldUsable ? holdMs : fallbackMs;
}
