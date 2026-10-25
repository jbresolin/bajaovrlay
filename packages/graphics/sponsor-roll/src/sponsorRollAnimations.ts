/**
 * The sponsor roll's GSAP timelines (the design's motion.md, "Sponsor roll, full screen" and
 * "Sponsor roll, corner"):
 * - full screen: the head, then `--motion-lead` later the tiles `--motion-row-stagger` apart
 *   in reading order; when a page's hold is up the page turns in place (the old tiles lift
 *   away as the new rise into the same places, `--motion-strip-page`, `--motion-page-stagger`
 *   apart) while the head stays and its words change in place;
 * - corner: the bug's card rises whole; when a sponsor's hold is up its cell (heading and
 *   logo) crossfades to the next in `--motion-flag`, the mark and the word never moving;
 * - out: everything together.
 * The moves are the kit's (boardMotion's rise and crossfade, barMotion's lift, page turn
 * and placement), every number the theme's. The manifest promises the longest play-in, six
 * tiles: `--motion-lead` + 5 × `--motion-row-stagger` + `--motion-in`.
 */
import {
  buildBarPageTurnTimeline,
  buildBarStopOutTimeline,
  placeBarPiecesOffAir,
  placeBarPiecesOnAir,
} from '@bajaovrlay/graphics-kit/barMotion';
import {
  type BoardTimeline,
  buildCrossfadeTimeline,
  buildPiecesRiseInTimeline,
} from '@bajaovrlay/graphics-kit/boardMotion';
import { readMotionTokens } from '@bajaovrlay/theme/motion';
import { gsap } from 'gsap';

/** A paused timeline of the roll, played with the kit's `playTimelineToTheEnd`. */
export type SponsorRollTimeline = BoardTimeline;

/** Builds the full screen's play-in: the head at once, the tiles from `--motion-lead`. */
export function buildFullscreenPlayInTimeline(
  board: HTMLElement,
  head: HTMLElement,
  tiles: HTMLElement[],
): SponsorRollTimeline {
  const motion = readMotionTokens(board);
  const piecesRisingAt = [
    { piece: head, startMs: 0 },
    ...tiles.map((tile, index) => ({
      piece: tile,
      startMs: motion.leadMs + index * motion.rowStaggerMs,
    })),
  ];
  return buildPiecesRiseInTimeline(board, piecesRisingAt);
}

/** Builds the corner's play-in: the bug's card rises whole, its logos with it. */
export function buildCornerPlayInTimeline(panel: HTMLElement): SponsorRollTimeline {
  return buildPiecesRiseInTimeline(panel, [{ piece: panel, startMs: 0 }]);
}

/** Builds the paused stop-out: every piece lifts and fades away together. */
export function buildSponsorRollStopOutTimeline(
  tokensSource: HTMLElement,
  pieces: HTMLElement[],
): SponsorRollTimeline {
  return buildBarStopOutTimeline(tokensSource, pieces);
}

/** Builds a full-screen page turn in place: the old tiles lift away, the new rise in. */
export function buildTilePageTurnTimeline(
  board: HTMLElement,
  leavingTiles: HTMLElement[],
  arrivingTiles: HTMLElement[],
): SponsorRollTimeline {
  return buildBarPageTurnTimeline(board, leavingTiles, arrivingTiles);
}

/** Builds the corner's turn: the sponsor cell on air fades out as the next fades in. */
export function buildCellCrossfadeTimeline(
  panel: HTMLElement,
  leavingCell: HTMLElement,
  arrivingCell: HTMLElement,
): SponsorRollTimeline {
  return buildCrossfadeTimeline(panel, [leavingCell], [arrivingCell]);
}

/** Puts pieces in their off-air look (invisible, below their place) without animating. */
export function placeSponsorRollPiecesOffAir(
  tokensSource: HTMLElement,
  pieces: HTMLElement[],
): void {
  placeBarPiecesOffAir(tokensSource, pieces);
}

/** Puts pieces in their on-air look at once (tiles redrawn on air after an edit). */
export function placeSponsorRollPiecesOnAir(pieces: HTMLElement[]): void {
  placeBarPiecesOnAir(pieces);
}

/** Shows one of the corner's two cells at once and hides the other. */
export function showCornerCellAtOnce(cellShown: HTMLElement, cellHidden: HTMLElement): void {
  gsap.set(cellShown, { opacity: 1 });
  gsap.set(cellHidden, { opacity: 0 });
}
