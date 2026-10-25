/**
 * How the lower strip's pages turn, and what happens around a turn: on air the next page
 * is drawn on the lane that is not on air and its pills rise while the old ones lift away
 * (the kit's barMotion), then the lanes trade roles; off air the strip rests on page 1 for
 * the next take. One turn at a time, and nothing that arrives during a turn is lost: an
 * update is drawn once the turn has ended. The component (lower-strip.ts) owns one of these
 * and keeps the lifecycle, the data, the clock and the page timer; this file keeps which
 * page and which lane are on air, draws them (stripPages picks the cars, lowerStripView
 * writes them) and runs the turn. The standings' standingsPageTurns.ts is the same shape.
 */
import {
  type BarTimeline,
  buildBarPageTurnTimeline,
  placeBarPiecesOffAir,
  placeBarPiecesOnAir,
} from '@bajaovrlay/graphics-kit/barMotion';
import { chooseNextPageInCycle } from '@bajaovrlay/graphics-kit/pageCycle';

import type { LowerStripData } from './lowerStripModel.js';
import {
  drawCarsOnLane,
  emptyLane,
  listPillsOfLane,
  type LowerStripParts,
  markLaneOnAir,
  writePageCell,
} from './lowerStripView.js';
import { countStripPages, listCarsOfStripPage } from './stripPages.js';

/** What the turns need from the component; the readers are called again after every await. */
export type LowerStripPageTurnsOptions = {
  /** Whether the strip is on air now. */
  isOnAir: () => boolean;
  /** Whether the strip is loaded and off air now (not loading, not disposed). */
  isOffAir: () => boolean;
  /** Whether an in, out or page motion is still running. */
  isMotionRunning: () => boolean;
  /** The parts of the strip, found at load. */
  readParts: () => LowerStripParts;
  /** The data last stored by load or update. */
  readData: () => LowerStripData;
  /** Runs a motion the component keeps track of (so stop and dispose can end it). */
  runMotionTimeline: (timeline: BarTimeline) => Promise<void>;
};

/** Where the pills a draw added are put: invisible for the next play, or straight on air. */
type PillPlacement = 'offAir' | 'onAir';

/** The page turns of one lower strip: the page and the lane on air, the turn, what arrived. */
export class LowerStripPageTurns {
  private readonly options: LowerStripPageTurnsOptions;
  private currentPageNumber = 1;
  private laneOnAirIndex: 0 | 1 = 0;
  private isTurningPage = false;
  /** Whether an update arrived during a turn; the turn draws it once it has ended. */
  private wasUpdateKeptForAfterTheTurn = false;

  constructor(options: LowerStripPageTurnsOptions) {
    this.options = options;
  }

  /** How many pages the stored running order fills. */
  countPages(): number {
    return countStripPages(this.options.readData().entries.length);
  }

  /** The pills of the page on air, left to right: what the play-in and the stop-out move. */
  listPillsOnAir(): HTMLElement[] {
    return listPillsOfLane(this.readLaneOnAir());
  }

  /**
   * Draws the page shown now from the stored data on the lane on air, in place: pills are
   * reused by slot, and one added (the page grew) is placed as asked. A list that shrank
   * under the page on air lands on its last page.
   */
  drawCurrentPage(placement: PillPlacement): void {
    const parts = this.options.readParts();
    const entries = this.options.readData().entries;
    const pageCount = this.countPages();
    this.currentPageNumber = Math.min(this.currentPageNumber, pageCount);
    const cars = listCarsOfStripPage(entries, this.currentPageNumber);
    const pillsAdded = drawCarsOnLane(this.readLaneOnAir(), cars);
    if (placement === 'offAir') {
      placeBarPiecesOffAir(parts.bar, pillsAdded);
    } else {
      placeBarPiecesOnAir(pillsAdded);
    }
    markLaneOnAir(parts, this.laneOnAirIndex);
    writePageCell(parts, this.currentPageNumber, pageCount);
  }

  /**
   * Draws data that has just been stored. On air the current page is redrawn in place (a
   * car that moved to another page is simply there at the next turn); off air and settled
   * page 1 is drawn. During a turn it is kept for the turn's end; during the stop-out
   * nothing is drawn, and the rest on page 1 that ends the stop-out draws the latest data.
   */
  drawUpdatedData(): void {
    if (this.isTurningPage) {
      this.wasUpdateKeptForAfterTheTurn = true;
      return;
    }
    if (this.options.isOnAir()) {
      this.drawCurrentPage('onAir');
      return;
    }
    this.restOnPageOneOnceSettledOffAir();
  }

  /**
   * Turns to the next page in the cycle. Nothing happens off air (the strip rests on page
   * 1 for the next take), during another turn, or with a single page.
   */
  async turnToTheNextPage(): Promise<void> {
    if (!this.options.isOnAir() || this.isTurningPage) {
      return;
    }
    const pageCount = this.countPages();
    if (pageCount === 1) {
      return;
    }
    await this.turnToPage(chooseNextPageInCycle(this.currentPageNumber, pageCount));
  }

  /**
   * Off air the strip rests on page 1 on its first lane, so the next take starts at the
   * leader. Done by whichever ends last of a stop-out and a turn the stop cut short, so
   * page 1 is never drawn on pills still fading out, and never forgotten.
   */
  restOnPageOneOnceSettledOffAir(): void {
    const isSettledOffAir =
      this.options.isOffAir() && !this.isTurningPage && !this.options.isMotionRunning();
    if (!isSettledOffAir) {
      return;
    }
    const parts = this.options.readParts();
    emptyLane(parts.lanes[1]);
    this.laneOnAirIndex = 0;
    this.currentPageNumber = 1;
    // Every pill of the lane is placed off air, not only new ones: the pills that stayed
    // were faded out by the stop-out and must stay invisible until the next play.
    this.drawCurrentPage('offAir');
    placeBarPiecesOffAir(parts.bar, this.listPillsOnAir());
  }

  /** The lane whose pills are on air now. */
  private readLaneOnAir(): HTMLOListElement {
    return this.options.readParts().lanes[this.laneOnAirIndex];
  }

  /**
   * The turn, on air: the next page is drawn on the other lane, its pills rise while the
   * old ones lift away, and the lanes trade roles; the page cell changes in place. An
   * update that arrived during the turn is drawn once it has ended. A strip stopped during
   * the turn draws nothing more; whichever ends last of the turn and the stop-out rests it
   * on page 1.
   */
  private async turnToPage(pageNumber: number): Promise<void> {
    const parts = this.options.readParts();
    const leavingLane = this.readLaneOnAir();
    const arrivingLaneIndex = this.laneOnAirIndex === 0 ? 1 : 0;
    const arrivingLane = parts.lanes[arrivingLaneIndex];
    this.isTurningPage = true;
    try {
      // Drawn from the latest data: an update that arrived before this point is on it.
      this.wasUpdateKeptForAfterTheTurn = false;
      const cars = listCarsOfStripPage(this.options.readData().entries, pageNumber);
      drawCarsOnLane(arrivingLane, cars);
      const leavingPills = listPillsOfLane(leavingLane);
      const arrivingPills = listPillsOfLane(arrivingLane);
      placeBarPiecesOffAir(parts.bar, arrivingPills);
      this.currentPageNumber = pageNumber;
      this.laneOnAirIndex = arrivingLaneIndex;
      markLaneOnAir(parts, arrivingLaneIndex);
      writePageCell(parts, pageNumber, this.countPages());
      await this.options.runMotionTimeline(
        buildBarPageTurnTimeline(parts.bar, leavingPills, arrivingPills),
      );
      emptyLane(leavingLane);
    } finally {
      this.isTurningPage = false;
    }
    if (this.wasUpdateKeptForAfterTheTurn && this.options.isOnAir()) {
      this.wasUpdateKeptForAfterTheTurn = false;
      this.drawCurrentPage('onAir');
    }
    this.restOnPageOneOnceSettledOffAir();
  }
}
