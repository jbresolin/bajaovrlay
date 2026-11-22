/**
 * How the results table's pages turn, the standings' way (BAJAOVRLAY-83): on air the rows
 * lift out together, the next page is drawn on the same slots and cascades in while the
 * head card and the column head stay; off air the board rests on page 1 for the next take.
 * One turn at a time, and an update that arrives during a turn is drawn once it has ended.
 * The component (resultsTable.ts) owns one of these and keeps the lifecycle, the data, the
 * motion and the page timer; this file keeps which page is shown and draws it: the rows in
 * the item's order (resultsTableSorting), the columns it shows (resultsTableText), the
 * page's rows (resultsTableLayout), written by resultsTableView.
 */
import { chooseNextPageInCycle } from '@bajaovrlay/graphics-kit/pageCycle';

import {
  buildLiftOutTogetherTimeline,
  buildPageInTimeline,
  type ResultsTableTimeline,
} from './resultsTableAnimations.js';
import { countResultsTablePages, layOutResultsTablePage } from './resultsTableLayout.js';
import { readResultsTableSettings, type ResultsTableData } from './resultsTableModel.js';
import { orderRowsByColumn } from './resultsTableSorting.js';
import { chooseShownColumns } from './resultsTableText.js';
import {
  drawResultsTablePage,
  listRows,
  type PiecePlacement,
  type ResultsTableParts,
  writeResultsTableHead,
} from './resultsTableView.js';

/** What the turns need from the component; the readers are called again after every await. */
export type ResultsTablePageTurnsOptions = {
  /** Whether the board is on air now. */
  isOnAir: () => boolean;
  /** Whether the board is loaded and off air now (not loading, not disposed). */
  isOffAir: () => boolean;
  /** Whether an in, out or page motion is still running. */
  isMotionRunning: () => boolean;
  /** The parts of the board, found at load. */
  readParts: () => ResultsTableParts;
  /** The data last stored by load or update. */
  readData: () => ResultsTableData;
  /** Runs a motion the component keeps track of (so stop and dispose can end it). */
  runMotionTimeline: (timeline: ResultsTableTimeline) => Promise<void>;
};

/** The page turns of one results table: the page shown, the turn and what arrived. */
export class ResultsTablePageTurns {
  private readonly options: ResultsTablePageTurnsOptions;
  private currentPageNumber = 1;
  private isTurningPage = false;
  /** Whether an update arrived during a turn; the turn draws it once it has ended. */
  private wasUpdateKeptForAfterTheTurn = false;

  constructor(options: ResultsTablePageTurnsOptions) {
    this.options = options;
  }

  /** How many pages the stored rows fill. */
  countPages(): number {
    return countResultsTablePages(this.options.readData().entries.length);
  }

  /**
   * Draws the page shown now from the stored data: the head's texts and the table, the
   * rows in the item's order. A list that shrank under the page on air lands on its last
   * page.
   */
  drawCurrentPage(placement: PiecePlacement): void {
    const parts = this.options.readParts();
    const data = this.options.readData();
    const settings = readResultsTableSettings(data);
    const rowsInOrder = orderRowsByColumn(
      data.entries,
      data.columnHeads,
      settings.sortByColumnText,
      settings.sortDirection,
    );
    const shownColumns = chooseShownColumns(data.columnHeads, settings.columnsShownText);
    const page = layOutResultsTablePage(rowsInOrder, this.currentPageNumber);
    this.currentPageNumber = page.pageNumber;
    writeResultsTableHead(parts, settings, page.pageLine);
    drawResultsTablePage(parts, page, shownColumns, rowsInOrder, placement);
  }

  /**
   * Draws data that has just been stored. On air the page is drawn again in place; off
   * air and settled page 1 is simply drawn. During a turn it is kept for the turn's end.
   * During the stop-out nothing is drawn: the rows are still fading out, and the rest on
   * page 1 that ends the stop-out draws from the latest data.
   */
  drawUpdatedData(): void {
    if (this.isTurningPage) {
      this.wasUpdateKeptForAfterTheTurn = true;
      return;
    }
    if (this.options.isOnAir()) {
      this.drawCurrentPage('atOnce');
      return;
    }
    this.restOnPageOneOnceSettledOffAir();
  }

  /**
   * Turns to the next page in the cycle. Nothing happens off air (the board rests on
   * page 1 for the next take), during another turn, or with a single page.
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
   * Off air the board rests on page 1, so the next take starts at the top. Done by
   * whichever ends last of a stop-out and a turn the stop cut short, so page 1 is never
   * drawn on rows still fading out, and never forgotten.
   */
  restOnPageOneOnceSettledOffAir(): void {
    const isSettledOffAir =
      this.options.isOffAir() && !this.isTurningPage && !this.options.isMotionRunning();
    // Drawn even when page 1 is already there: an update kept meanwhile is on it.
    if (isSettledOffAir) {
      this.currentPageNumber = 1;
      this.drawCurrentPage('offAir');
    }
  }

  /**
   * The turn, on air: the rows of the page lift out together, the next page is drawn on
   * the same slots and its rows cascade in, the head card staying and its page line
   * changing in place. An update that arrived during the turn is drawn once it has ended.
   * A board stopped during the lift draws nothing more; whichever ends last of the turn
   * and the stop-out rests it on page 1.
   */
  private async turnToPage(pageNumber: number): Promise<void> {
    const parts = this.options.readParts();
    this.isTurningPage = true;
    try {
      const piecesLeaving = listRows(parts);
      await this.options.runMotionTimeline(
        buildLiftOutTogetherTimeline(parts.tokensSource, piecesLeaving),
      );
      // Stopped or disposed during the lift: no next page, since drawing it now would
      // change the texts of rows still fading out.
      if (this.options.isOnAir()) {
        this.currentPageNumber = pageNumber;
        // Drawn from the latest data: an update that arrived before this point is on it.
        this.wasUpdateKeptForAfterTheTurn = false;
        this.drawCurrentPage('beforeCascade');
        const piecesArriving = listRows(parts);
        await this.options.runMotionTimeline(
          buildPageInTimeline(parts.tokensSource, piecesArriving),
        );
      }
    } finally {
      this.isTurningPage = false;
    }
    if (this.wasUpdateKeptForAfterTheTurn && this.options.isOnAir()) {
      this.wasUpdateKeptForAfterTheTurn = false;
      this.drawCurrentPage('atOnce');
    }
    this.restOnPageOneOnceSettledOffAir();
  }
}
