/**
 * How the standings' pages turn, and what happens around a turn: on air the pieces of the
 * page lift out together, the next page is drawn on the same slots and cascades in while
 * the head card stays; off air the board rests on page 1 for the next take. One turn at a
 * time, and nothing that arrives during a turn is lost: an update is drawn once the turn
 * has ended. The component (standings.ts) owns one of these and keeps the lifecycle, the
 * data, the motion and the page timer; this file keeps which page is shown, draws it
 * (standingsLayout picks the teams, standingsView writes them) and runs the turn.
 */
import {
  buildLiftOutTogetherTimeline,
  buildPageInTimeline,
  type StandingsTimeline,
} from './standingsAnimations.js';
import {
  chooseNextPageInCycle,
  chooseStandingsLayout,
  countStandingsPages,
  layOutStandingsPage,
  type StandingsLayout,
} from './standingsLayout.js';
import { readStandingsSettings, type StandingsData } from './standingsModel.js';
import {
  drawStandingsPage,
  listColumnCascadesThatTurn,
  type PiecePlacement,
  type StandingsParts,
  writeStandingsHead,
} from './standingsView.js';

/** What the turns need from the component; the readers are called again after every await. */
export type StandingsPageTurnsOptions = {
  /** Whether the board is on air now. */
  isOnAir: () => boolean;
  /** Whether the board is loaded and off air now (not loading, not disposed). */
  isOffAir: () => boolean;
  /** Whether an in, out or page motion is still running. */
  isMotionRunning: () => boolean;
  /** The parts of the board, found at load. */
  readParts: () => StandingsParts;
  /** The data last stored by load or update. */
  readData: () => StandingsData;
  /** Runs a motion the component keeps track of (so stop and dispose can end it). */
  runMotionTimeline: (timeline: StandingsTimeline) => Promise<void>;
};

/** The page turns of one standings board: the page shown, the turn and what arrived. */
export class StandingsPageTurns {
  private readonly options: StandingsPageTurnsOptions;
  private currentPageNumber = 1;
  private isTurningPage = false;
  /** Whether an update arrived during a turn; the turn draws it once it has ended. */
  private wasUpdateKeptForAfterTheTurn = false;

  constructor(options: StandingsPageTurnsOptions) {
    this.options = options;
  }

  /** How many pages the stored data fills on the board it asks for. */
  countPages(): number {
    return countStandingsPages(this.options.readData().entries.length, this.readLayout());
  }

  /**
   * Draws the page shown now from the stored data: the head's texts and the tables. A
   * list that shrank under the page on air lands on its last page.
   */
  drawCurrentPage(placement: PiecePlacement): void {
    const parts = this.options.readParts();
    const data = this.options.readData();
    const settings = readStandingsSettings(data);
    const page = layOutStandingsPage(data.entries, this.readLayout(), this.currentPageNumber);
    this.currentPageNumber = page.pageNumber;
    writeStandingsHead(parts, settings, page.pageLine);
    drawStandingsPage(parts, page, settings.scoreParts, placement);
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

  /** The board the stored data asks for: the table with parts, the columns without. */
  private readLayout(): StandingsLayout {
    return chooseStandingsLayout(readStandingsSettings(this.options.readData()).scoreParts);
  }

  /**
   * The turn, on air: the pieces of the page lift out together, the next page is drawn on
   * the same slots and its pieces cascade in, the head card staying and its page line
   * changing in place. An update that arrived during the turn is drawn once it has ended.
   * A board stopped during the lift draws nothing more; whichever ends last of the turn
   * and the stop-out rests it on page 1.
   */
  private async turnToPage(pageNumber: number): Promise<void> {
    const parts = this.options.readParts();
    this.isTurningPage = true;
    try {
      const piecesLeaving = listColumnCascadesThatTurn(parts).flat();
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
        const piecesArriving = listColumnCascadesThatTurn(parts);
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
