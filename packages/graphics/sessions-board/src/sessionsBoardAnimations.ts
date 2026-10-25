/**
 * The sessions board's GSAP timelines (the design's motion.md, "Sessions board"): the head,
 * then `--motion-lead` later each slot `--motion-row-stagger` after the one above; out,
 * everything together. When a slot's status changes on air (the slot in progress ends, the
 * next starts), its state crossfades and its slate follows, both in `--motion-flag`: the new
 * fades in over the old and nothing moves (a state, not an animation). The moves are the
 * kit's (boardMotion's rise and crossfade, barMotion's lift and placement), every number
 * the theme's. The manifest promises the longest play-in, twelve rows: `--motion-lead` +
 * 11 × `--motion-row-stagger` + `--motion-in`; sessionsBoardManifest.test.ts keeps it so.
 */
import {
  buildBarStopOutTimeline,
  placeBarPiecesOffAir,
  placeBarPiecesOnAir,
} from '@bajaovrlay/graphics-kit/barMotion';
import {
  type BoardTimeline,
  buildCrossfadeTimeline,
  buildPiecesRiseInTimeline,
} from '@bajaovrlay/graphics-kit/boardMotion';
import type { ScheduleSlotStatus } from '@bajaovrlay/shared/scheduleSlotStatus';
import { readMotionTokens } from '@bajaovrlay/theme/motion';
import { gsap } from 'gsap';

import type { SessionsBoardRowParts } from './sessionsBoardView.js';

/** A paused timeline of the board, played with the kit's `playTimelineToTheEnd`. */
export type SessionsBoardTimeline = BoardTimeline;

/** A slot whose status changed, from what to what. */
export type SlotStatusChange = {
  rowParts: SessionsBoardRowParts;
  statusBefore: ScheduleSlotStatus;
  statusAfter: ScheduleSlotStatus;
};

/** The slate a status shows: the denser one only for the slot in progress. */
function findSlateOfStatus(
  rowParts: SessionsBoardRowParts,
  status: ScheduleSlotStatus,
): HTMLElement {
  return status === 'inProgress' ? rowParts.liveSlate : rowParts.baseSlate;
}

/** Builds the paused play-in: the head at once, the rows from `--motion-lead`, a stagger apart. */
export function buildSessionsBoardPlayInTimeline(
  board: HTMLElement,
  head: HTMLElement,
  rows: HTMLElement[],
): SessionsBoardTimeline {
  const motion = readMotionTokens(board);
  const piecesRisingAt = [
    { piece: head, startMs: 0 },
    ...rows.map((row, index) => ({
      piece: row,
      startMs: motion.leadMs + index * motion.rowStaggerMs,
    })),
  ];
  return buildPiecesRiseInTimeline(board, piecesRisingAt);
}

/** Builds the paused stop-out: the head and every row lift and fade away together. */
export function buildSessionsBoardStopOutTimeline(
  board: HTMLElement,
  pieces: HTMLElement[],
): SessionsBoardTimeline {
  return buildBarStopOutTimeline(board, pieces);
}

/** Puts pieces in their off-air look (invisible, below their place) without animating. */
export function placeSessionsBoardPiecesOffAir(board: HTMLElement, pieces: HTMLElement[]): void {
  placeBarPiecesOffAir(board, pieces);
}

/** Puts pieces in their on-air look at once (rows that came in while on air). */
export function placeSessionsBoardPiecesOnAir(pieces: HTMLElement[]): void {
  placeBarPiecesOnAir(pieces);
}

/** Shows a row's status at once: its layer and its slate visible, the others not. */
export function showStatusOfRowAtOnce(
  rowParts: SessionsBoardRowParts,
  status: ScheduleSlotStatus,
): void {
  rowParts.row.dataset.status = status;
  for (const [layerStatus, layer] of Object.entries(rowParts.statusLayers)) {
    gsap.set(layer, { opacity: layerStatus === status ? 1 : 0 });
  }
  const isInProgress = status === 'inProgress';
  gsap.set(rowParts.liveSlate, { opacity: isInProgress ? 1 : 0 });
  gsap.set(rowParts.baseSlate, { opacity: isInProgress ? 0 : 1 });
}

/**
 * Builds the paused crossfade of every slot whose status changed: each old state layer
 * fades out as the new one fades in, and the slate follows when it changes (into or out of
 * "em andamento"), all at once over `--motion-flag`. The rows' marks (data-status) are the
 * new statuses at once, for anything that reads them.
 */
export function buildStatusCrossfadeTimeline(
  board: HTMLElement,
  changes: SlotStatusChange[],
): SessionsBoardTimeline {
  const leavingPieces: HTMLElement[] = [];
  const arrivingPieces: HTMLElement[] = [];
  for (const { rowParts, statusBefore, statusAfter } of changes) {
    rowParts.row.dataset.status = statusAfter;
    leavingPieces.push(rowParts.statusLayers[statusBefore]);
    arrivingPieces.push(rowParts.statusLayers[statusAfter]);
    const slateBefore = findSlateOfStatus(rowParts, statusBefore);
    const slateAfter = findSlateOfStatus(rowParts, statusAfter);
    if (slateBefore !== slateAfter) {
      leavingPieces.push(slateBefore);
      arrivingPieces.push(slateAfter);
    }
  }
  return buildCrossfadeTimeline(board, leavingPieces, arrivingPieces);
}
