/**
 * How long a page of the lower strip or the message ticker stays on air before the next:
 * the theme's `--motion-strip-hold` (7 s in Ardósia), read anew before every hold so a
 * token change is followed. A missing or unreadable token gives Ardósia's 7 s, never a
 * throw and never a 0: readMotionTokens reads a missing duration as 0, right for a
 * timeline (no motion, it still ends) and wrong for a hold (pages flipping every frame).
 * The standings' standingsPageHold.ts is the same rule for `--motion-board-hold`.
 */
import { readMotionTokens } from '@bajaovrlay/theme/motion';

/** The page hold used when the token is missing or not a duration: Ardósia's 7 s. */
export const stripHoldMsWhenTokenMissing = 7000;

/** Reads `--motion-strip-hold` from `element`'s computed style, in milliseconds. */
export function readStripHoldMs(element: Element): number {
  const stripHoldMs = readMotionTokens(element).stripHoldMs;
  const isStripHoldUsable = stripHoldMs > 0;
  return isStripHoldUsable ? stripHoldMs : stripHoldMsWhenTokenMissing;
}
