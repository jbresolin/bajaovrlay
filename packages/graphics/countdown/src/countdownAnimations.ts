/**
 * The countdown's GSAP timelines (the design's motion.md, "Countdown, card" and "Countdown,
 * full screen"): the card rises in whole, as the race clock does; the waiting screen
 * brings its head, then the body card `--motion-lead` behind; out, everything lifts
 * together. The count changes in place every second and never animates. The moves are the
 * kit's (boardMotion's rise, barMotion's lift and placement); every number is the theme's,
 * read when a timeline is built. The manifest promises a renderer the longest play-in,
 * the waiting screen's `--motion-lead` + `--motion-in`, and `--motion-out`;
 * countdownManifest.test.ts keeps it in agreement.
 */
import {
  buildBarStopOutTimeline,
  placeBarPiecesOffAir,
  placeBarPiecesOnAir,
} from '@bajaovrlay/graphics-kit/barMotion';
import {
  type BoardTimeline,
  buildPiecesRiseInTimeline,
} from '@bajaovrlay/graphics-kit/boardMotion';
import { readMotionTokens } from '@bajaovrlay/theme/motion';

import type { CountdownPieces } from './countdownView.js';

/** A paused timeline of the countdown, played with the kit's `playTimelineToTheEnd`. */
export type CountdownTimeline = BoardTimeline;

/**
 * Builds the paused play-in: the first piece (the card, or the board's head) at once,
 * each next one `--motion-lead` after the one before (the board's body card).
 */
export function buildCountdownPlayInTimeline(pieces: CountdownPieces): CountdownTimeline {
  const motion = readMotionTokens(pieces.tokensSource);
  const piecesRisingAt = pieces.piecesInOrder.map((piece, index) => ({
    piece,
    startMs: index * motion.leadMs,
  }));
  return buildPiecesRiseInTimeline(pieces.tokensSource, piecesRisingAt);
}

/** Builds the paused stop-out: every piece lifts and fades away together. */
export function buildCountdownStopOutTimeline(pieces: CountdownPieces): CountdownTimeline {
  return buildBarStopOutTimeline(pieces.tokensSource, pieces.piecesInOrder);
}

/** Puts the pieces in their off-air look (invisible, below their place) without animating. */
export function placeCountdownOffAir(pieces: CountdownPieces): void {
  placeBarPiecesOffAir(pieces.tokensSource, pieces.piecesInOrder);
}

/** Puts the pieces in their on-air look at once: a layout changed while on air. */
export function placeCountdownOnAir(pieces: CountdownPieces): void {
  placeBarPiecesOnAir(pieces.piecesInOrder);
}
