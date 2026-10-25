/**
 * The intermission board's GSAP timelines (the design's motion.md, "Intermission board"):
 * the head; `--motion-lead` later the next-session card and the top five's head; the five
 * rows `--motion-row-stagger` apart after the top five's head; the sponsor line
 * `--motion-lead` after the last row starts; out, everything together. Without the top five
 * or the sponsor line the remaining pieces keep their timing: the sponsor line rises when a
 * full top five would have put it, whatever the rows there are. The sponsor line turns in
 * place (`--motion-strip-page`, `--motion-page-stagger` apart), as the strip does. The moves
 * are the kit's, every number the theme's. The manifest promises the play-in's length,
 * 2 × `--motion-lead` + 5 × `--motion-row-stagger` + `--motion-in`.
 */
import {
  buildBarPageTurnTimeline,
  buildBarStopOutTimeline,
  placeBarPiecesOffAir,
  placeBarPiecesOnAir,
} from '@bajaovrlay/graphics-kit/barMotion';
import {
  type BoardTimeline,
  buildPiecesRiseInTimeline,
  type PieceRisingAt,
} from '@bajaovrlay/graphics-kit/boardMotion';
import { readMotionTokens } from '@bajaovrlay/theme/motion';

import { mostTeamsOnTheBoard } from './intermissionBoardModel.js';
import type { IntermissionBoardPieces } from './intermissionBoardView.js';

/** A paused timeline of the board, played with the kit's `playTimelineToTheEnd`. */
export type IntermissionBoardTimeline = BoardTimeline;

/** Every piece that comes and goes, in the order they rise. */
export function listIntermissionBoardPieces(pieces: IntermissionBoardPieces): HTMLElement[] {
  const listed = [pieces.head, pieces.nextCard];
  if (pieces.topHead !== undefined) {
    listed.push(pieces.topHead);
  }
  listed.push(...pieces.rows);
  if (pieces.sponsorLine !== undefined) {
    listed.push(pieces.sponsorLine);
  }
  return listed;
}

/** Builds the paused play-in, each piece at the moment motion.md gives it. */
export function buildIntermissionBoardPlayInTimeline(
  pieces: IntermissionBoardPieces,
): IntermissionBoardTimeline {
  const motion = readMotionTokens(pieces.board);
  const piecesRisingAt: PieceRisingAt[] = [
    { piece: pieces.head, startMs: 0 },
    { piece: pieces.nextCard, startMs: motion.leadMs },
  ];
  if (pieces.topHead !== undefined) {
    piecesRisingAt.push({ piece: pieces.topHead, startMs: motion.leadMs });
  }
  pieces.rows.forEach((row, index) => {
    piecesRisingAt.push({ piece: row, startMs: motion.leadMs + (index + 1) * motion.rowStaggerMs });
  });
  if (pieces.sponsorLine !== undefined) {
    const lastRowOfAFullTopFiveStartsMs = motion.leadMs + mostTeamsOnTheBoard * motion.rowStaggerMs;
    piecesRisingAt.push({
      piece: pieces.sponsorLine,
      startMs: lastRowOfAFullTopFiveStartsMs + motion.leadMs,
    });
  }
  return buildPiecesRiseInTimeline(pieces.board, piecesRisingAt);
}

/** Builds the paused stop-out: every piece lifts and fades away together. */
export function buildIntermissionBoardStopOutTimeline(
  pieces: IntermissionBoardPieces,
): IntermissionBoardTimeline {
  return buildBarStopOutTimeline(pieces.board, listIntermissionBoardPieces(pieces));
}

/** Builds the sponsor line's turn in place: the old heading and logos lift, the new rise. */
export function buildSponsorLineTurnTimeline(
  board: HTMLElement,
  leavingPieces: HTMLElement[],
  arrivingPieces: HTMLElement[],
): IntermissionBoardTimeline {
  return buildBarPageTurnTimeline(board, leavingPieces, arrivingPieces);
}

/** Puts pieces in their off-air look (invisible, below their place) without animating. */
export function placeIntermissionPiecesOffAir(board: HTMLElement, pieces: HTMLElement[]): void {
  placeBarPiecesOffAir(board, pieces);
}

/** Puts pieces in their on-air look at once (parts that came in while on air). */
export function placeIntermissionPiecesOnAir(pieces: HTMLElement[]): void {
  placeBarPiecesOnAir(pieces);
}
