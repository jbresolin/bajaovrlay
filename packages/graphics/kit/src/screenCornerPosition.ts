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
 *
 * For -64 and -65: a graphic that must not cover a persistent one in the same corner (the
 * sponsor roll under the clock, the match bug beside the sponsor bug) passes an inset, a
 * CSS length added to the safe edge, ideally a token. Name the corners in the manifest's
 * `gddOptions.labels` with `screenCornerNamesInPortuguese`: the kit's
 * screenCornerNamesInEveryManifest.test.ts checks every manifest against it, so the new
 * graphic needs no check of its own.
 */
import { z } from 'zod';

/** The four corners, in the order a form offers them: top before bottom, left before right. */
export const screenCorners = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const;

/** One of the four corners; the data check for a graphic's position field. */
export const ScreenCornerSchema = z.enum(screenCorners);

/** One of the four corners of the screen. */
export type ScreenCorner = z.infer<typeof ScreenCornerSchema>;

/**
 * Each corner's pt-BR name, as the item form shows it: a manifest's corner field puts
 * these in its `gddOptions.labels`, and previews name their corner buttons with them.
 */
export const screenCornerNamesInPortuguese: Record<ScreenCorner, string> = {
  'top-left': 'Superior esquerdo',
  'top-right': 'Superior direito',
  'bottom-left': 'Inferior esquerdo',
  'bottom-right': 'Inferior direito',
};

/**
 * How far a box sits in from its corner's safe edges, as CSS lengths (`120px`, or a
 * token such as `var(--sponsor-bug-width)`): from the top or bottom edge it is held by,
 * and from its side. Either one left out stays on the safe edge.
 */
export type ScreenCornerInset = {
  fromTheTopOrBottom?: string;
  fromTheSide?: string;
};

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

/** A safe edge moved in by an inset, or the edge alone when there is none. */
function moveSafeEdgeIn(safeEdge: string, inset: string | undefined): string {
  if (inset === undefined) {
    return safeEdge;
  }
  return `calc(${safeEdge} + ${inset})`;
}

/**
 * The offsets that put a box in the given corner, on the title-safe edges: a top corner
 * at --stage-safe-top, a bottom one at --stage-safe-bottom, either side at
 * --stage-safe-side; each moved further in by the inset, when one is given.
 */
export function describeScreenCornerPosition(
  corner: ScreenCorner,
  inset: ScreenCornerInset = {},
): ScreenCornerOffsets {
  const isTopCorner = corner === 'top-left' || corner === 'top-right';
  const isLeftCorner = corner === 'top-left' || corner === 'bottom-left';
  const heldEdge = isTopCorner ? safeTopEdge : safeBottomEdge;
  const heldEdgeMovedIn = moveSafeEdgeIn(heldEdge, inset.fromTheTopOrBottom);
  const sideMovedIn = moveSafeEdgeIn(safeSide, inset.fromTheSide);
  return {
    top: isTopCorner ? heldEdgeMovedIn : unusedOffset,
    right: isLeftCorner ? unusedOffset : sideMovedIn,
    bottom: isTopCorner ? unusedOffset : heldEdgeMovedIn,
    left: isLeftCorner ? sideMovedIn : unusedOffset,
  };
}
