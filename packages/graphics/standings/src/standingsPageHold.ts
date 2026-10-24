/**
 * How long a standings page stays on air before the next: the theme's
 * `--motion-board-hold` (10 s in Ardósia), read anew before every hold so a token change
 * is followed. A missing or unreadable token gives Ardósia's 10 s, never a throw and
 * never a 0: readMotionTokens reads a missing duration as 0, right for a timeline (no
 * motion, it still ends) and wrong for a hold (pages flipping every frame).
 */
import { readMotionTokens } from '@bajaovrlay/theme/motion';

/** The page hold used when the token is missing or not a duration: Ardósia's 10 s. */
export const boardHoldMsWhenTokenMissing = 10_000;

/** Reads `--motion-board-hold` from `element`'s computed style, in milliseconds. */
export function readBoardHoldMs(element: Element): number {
  const boardHoldMs = readMotionTokens(element).boardHoldMs;
  const isBoardHoldUsable = boardHoldMs > 0;
  return isBoardHoldUsable ? boardHoldMs : boardHoldMsWhenTokenMissing;
}
