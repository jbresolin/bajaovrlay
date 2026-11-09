/**
 * A graphic in a corner of the screen: the four corners an operator can pick and, for
 * each, the CSS offsets that hold an absolutely placed box on two edges of the title-safe
 * area every graphic already keeps (the theme's --stage-safe-top, --stage-safe-bottom and
 * --stage-safe-side: x 96..1824, y 54..1026). First used by the channel logo
 * (BAJAOVRLAY-63); the plain sponsor roll (BAJAOVRLAY-64) and the match bug (BAJAOVRLAY-65)
 * are meant to place themselves with it too, so the three agree on where a corner is.
 *
 * How to use it: give the box `position: absolute` inside a host that covers the whole
 * 1920x1080 stage (`position: absolute; inset: 0`), validate the operator's choice with
 * `ScreenCornerSchema`, and put `describeScreenCornerPosition(corner)` on the box with
 * Lit's `styleMap`. The two offsets a corner does not use are `auto`, so the box keeps its
 * own width and height. The margins are tokens, never numbers here: a theme that moves
 * the safe area moves every corner graphic with it.
 */
import { z } from 'zod';

/** The four corners, in the order a form offers them: top before bottom, left before right. */
export const screenCorners = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const;

/** One of the four corners; the data check for a graphic's position field. */
export const ScreenCornerSchema = z.enum(screenCorners);

/** One of the four corners of the screen. */
export type ScreenCorner = z.infer<typeof ScreenCornerSchema>;

/** The four CSS offsets of an absolutely placed box, each a token or `auto`. */
export type ScreenCornerOffsets = {
  top: string;
  right: string;
  bottom: string;
  left: string;
};

const safeTopEdge = 'var(--stage-safe-top)';
const safeBottomEdge = 'var(--stage-safe-bottom)';
const safeSide = 'var(--stage-safe-side)';
const unusedOffset = 'auto';

/**
 * The offsets that put a box in the given corner, on the title-safe edges: a top corner
 * at --stage-safe-top, a bottom one at --stage-safe-bottom, either side at --stage-safe-side.
 */
export function describeScreenCornerPosition(corner: ScreenCorner): ScreenCornerOffsets {
  const isTopCorner = corner === 'top-left' || corner === 'top-right';
  const isLeftCorner = corner === 'top-left' || corner === 'bottom-left';
  return {
    top: isTopCorner ? safeTopEdge : unusedOffset,
    right: isLeftCorner ? unusedOffset : safeSide,
    bottom: isTopCorner ? unusedOffset : safeBottomEdge,
    left: isLeftCorner ? safeSide : unusedOffset,
  };
}
