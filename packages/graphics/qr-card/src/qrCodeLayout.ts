/**
 * Where the code's squares go inside the `--qr-size` box: a whole number of pixels per
 * module, so every square edge falls on a pixel and none is blurred into grey (a blurred
 * edge is what makes a camera misread a module), and the code centred in the box on whole
 * pixels too. The SVG is drawn in module units (one unit a module, the quiet zone around)
 * and given the size in px this plan computes, so the scale is always a whole number.
 */
import { quietZoneModules } from './qrCodeEncoding.js';

/** How the code is drawn in its box, every number in whole px. */
export type QrCodeDrawingPlan = {
  /** The side of one module. */
  cellSizePx: number;
  /** The side of the drawn code, quiet zone included: cellSizePx × (modules + 2 × quiet zone). */
  drawnSizePx: number;
  /** The room left in the box before the code, on the left and on the top alike. */
  offsetPx: number;
};

/**
 * Plans the drawing of a code of `moduleCount` modules a side in a box of `boxSizePx`. The
 * cell is the box divided by the modules (quiet zone included), rounded down; the pixels
 * left over are split, rounded down, before the code. A box that cannot be read (no theme on
 * the page: the token is missing) draws one px a module, and the unstyled card shows it so.
 */
export function planQrCodeDrawing(moduleCount: number, boxSizePx: number): QrCodeDrawingPlan {
  const modulesWithQuietZone = moduleCount + 2 * quietZoneModules;
  const isBoxReadable = Number.isFinite(boxSizePx) && boxSizePx >= modulesWithQuietZone;
  if (!isBoxReadable) {
    return { cellSizePx: 1, drawnSizePx: modulesWithQuietZone, offsetPx: 0 };
  }
  const cellSizePx = Math.floor(boxSizePx / modulesWithQuietZone);
  const drawnSizePx = cellSizePx * modulesWithQuietZone;
  const offsetPx = Math.floor((boxSizePx - drawnSizePx) / 2);
  return { cellSizePx, drawnSizePx, offsetPx };
}

/**
 * Measures the light around the squares on the narrowest side, in modules: the quiet zone,
 * the box's leftover before the code, and the card's light padding (`--space-3`). The QR
 * standard asks for four modules; phone readers manage with two. What could go wrong: the
 * text block sits right of the code, so the right side is wider and never the narrowest.
 */
export function measureLightAroundCodeInModules(
  plan: QrCodeDrawingPlan,
  cardPaddingPx: number,
): number {
  const quietZonePx = quietZoneModules * plan.cellSizePx;
  const lightPx = quietZonePx + plan.offsetPx + cardPaddingPx;
  return lightPx / plan.cellSizePx;
}

/**
 * Writes the SVG path of the dark modules in module units: one `M column row h1 v1 h-1 z`
 * square per dark module, as the design's placeholder does, filled with the text colour.
 * Squares that touch share their edges exactly, so with crispEdges no seam shows.
 */
export function buildQrCodePathData(modules: boolean[][]): string {
  const squares: string[] = [];
  modules.forEach((modulesOfTheRow, row) => {
    modulesOfTheRow.forEach((isDark, column) => {
      if (isDark) {
        squares.push(`M${column} ${row}h1v1h-1z`);
      }
    });
  });
  return squares.join('');
}
