/**
 * The theme's sizes the tree is laid out with (treeLayout.ts), read as pixels from the
 * element's computed style: the stage under the wide head, the gap between rounds, the
 * name pills' room and the car rows. A token that is missing reads as 0, so a page with
 * no theme lays the tree out flat rather than throwing; the theme declares every one.
 */
import type { TreeGeometry } from './treeLayout.js';

/** The CSS custom property each size is read from (packages/theme/ardosia/tokens.css). */
export const treeGeometryTokenNames = {
  stageWidth: '--board-stage-width',
  stageHeight: '--board-stage-height',
  columnGap: '--bracket-column-gap',
  roundNameHeight: '--head-height',
  gapUnderRoundName: '--stack-gap',
  carRowHeight: '--bracket-row-height',
  carRowGap: '--row-gap',
} as const;

/** Reads the tree's sizes from the theme's tokens on `element` (the graphic's host). */
export function readTreeGeometryOfTheTheme(element: Element): TreeGeometry {
  const computedStyle = getComputedStyle(element);
  const readPixels = (tokenName: string): number => {
    const value = Number.parseFloat(computedStyle.getPropertyValue(tokenName));
    return Number.isNaN(value) ? 0 : value;
  };
  return {
    stageWidthPx: readPixels(treeGeometryTokenNames.stageWidth),
    stageHeightPx: readPixels(treeGeometryTokenNames.stageHeight),
    columnGapPx: readPixels(treeGeometryTokenNames.columnGap),
    roundNameRoomPx:
      readPixels(treeGeometryTokenNames.roundNameHeight) +
      readPixels(treeGeometryTokenNames.gapUnderRoundName),
    carRowHeightPx: readPixels(treeGeometryTokenNames.carRowHeight),
    carRowGapPx: readPixels(treeGeometryTokenNames.carRowGap),
  };
}
