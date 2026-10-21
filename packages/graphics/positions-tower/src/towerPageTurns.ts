/**
 * How the tower's pages turn, and what happens around a turn: on air the rows leave
 * together, the new page is drawn, its rows rise in cascade while the head stays; off
 * air the page is simply drawn. One turn at a time, and nothing asked during a turn is
 * lost: the latest list that arrived is applied once the turn has ended, "first page
 * only" asked during it brings page 1 back after it, and a tower stopped during a turn
 * rests on page 1 for the next take. The component (positions-tower.ts) owns one of
 * these, tells it when to turn and what arrived, and keeps the lifecycle, the data and
 * the page timer; the stage (towerStage.ts) does the drawing and the motion.
 */
import type { TowerEntry } from './positionsTowerModel.js';
import { chooseNextPageInCycle } from './towerPages.js';
import type { TowerStage } from './towerStage.js';

/** What the turns need from the component; the readers are called again after every await. */
export type TowerPageTurnsOptions = {
  stage: TowerStage;
  /** Whether the tower is on air now. */
  isOnAir: () => boolean;
  /** Whether the tower was disposed. */
  isDisposed: () => boolean;
  /** The list last stored by load or update. */
  readEntries: () => readonly TowerEntry[];
  /** Draws the current page of the stored data on the stage the way the lifecycle allows. */
  placeEntriesOnTheStage: (skipAnimation: boolean) => Promise<void>;
};

/** The page turns of one tower: the turn in progress and what arrived during it. */
export class TowerPageTurns {
  private readonly stage: TowerStage;
  private readonly isOnAir: () => boolean;
  private readonly isDisposed: () => boolean;
  private readonly readEntries: () => readonly TowerEntry[];
  private readonly placeEntriesOnTheStage: (skipAnimation: boolean) => Promise<void>;
  private isTurningPage = false;
  /** The latest update that arrived during a turn; applied once the turn has ended. */
  private updateArrivedDuringTurn: { skipAnimation: boolean } | undefined = undefined;
  /** Whether "first page only" asked for page 1 during a turn; honoured once it has ended. */
  private wasPageOneAskedDuringTurn = false;

  constructor(options: TowerPageTurnsOptions) {
    this.stage = options.stage;
    this.isOnAir = options.isOnAir;
    this.isDisposed = options.isDisposed;
    this.readEntries = options.readEntries;
    this.placeEntriesOnTheStage = options.placeEntriesOnTheStage;
  }

  /** Whether a turn is in progress (its rows on their way out or in). */
  isTurning(): boolean {
    return this.isTurningPage;
  }

  /**
   * Keeps an update that arrived during a turn for the turn's end. Only the latest one
   * matters: the data itself is stored by the component, and the turn's second half
   * draws from it anyway; what is kept here is that something arrived after that draw.
   */
  keepUpdateForAfterTheTurn(skipAnimation: boolean): void {
    this.updateArrivedDuringTurn = { skipAnimation };
  }

  /** Turns to the page after this one in the cycle; nothing to do with a single page. */
  async turnToTheNextPage(): Promise<void> {
    const pageCount = this.stage.countPages(this.readEntries().length);
    if (pageCount === 1) {
      return;
    }
    await this.turnToPage(chooseNextPageInCycle(this.stage.readCurrentPage(), pageCount), false);
  }

  /**
   * Brings page 1 back, as paging turned to firstPageOnly asks. During a turn the
   * request is kept and honoured once the turn has ended: a turn in progress is never
   * cut and a request is never dropped.
   */
  async holdPageOne(skipAnimation: boolean): Promise<void> {
    if (this.isTurningPage) {
      this.wasPageOneAskedDuringTurn = true;
      return;
    }
    if (this.stage.readCurrentPage() !== 1) {
      await this.turnToPage(1, skipAnimation);
    }
  }

  /**
   * Off air the tower rests on page 1, drawn off air, so the next take starts at the
   * leader whatever page it was stopped on. During a turn, the turn's end does this.
   */
  restOnPageOneForTheNextTake(): void {
    if (this.isTurningPage || this.isOnAir() || this.isDisposed()) {
      return;
    }
    if (this.stage.readCurrentPage() !== 1) {
      this.stage.showPage(this.readEntries(), 1, 'offAir');
    }
  }

  /**
   * Turns the page, then settles whatever arrived during the turn. Only one turn at a
   * time: a second ask while one is in progress is dropped (the timer asks again after
   * its next hold; "first page only" is kept, see holdPageOne).
   */
  private async turnToPage(pageNumber: number, skipAnimation: boolean): Promise<void> {
    if (this.isTurningPage) {
      return;
    }
    this.isTurningPage = true;
    try {
      await this.runPageTurn(pageNumber, skipAnimation);
    } finally {
      this.isTurningPage = false;
    }
    await this.settleWhatArrivedDuringTheTurn(skipAnimation);
  }

  /**
   * The turn itself: on air the rows leave together, then the new page's rows rise in
   * cascade while the head stays; off air the new page is simply drawn. A tower taken
   * off air during the lift draws nothing more: the settle after it rests on page 1.
   */
  private async runPageTurn(pageNumber: number, skipAnimation: boolean): Promise<void> {
    const isAnimated = this.isOnAir() && !skipAnimation;

    if (isAnimated) {
      await this.stage.liftRowsOut();
      if (!this.isOnAir()) {
        return;
      }
    }

    const isOnAirAtOnce = this.isOnAir() && skipAnimation;
    this.stage.showPage(this.readEntries(), pageNumber, isOnAirAtOnce ? 'atOnce' : 'offAir');
    // The page was drawn from the latest data: an update that arrived before this point
    // is already on it, and only one that arrives from here on needs applying after.
    this.updateArrivedDuringTurn = undefined;
    if (isAnimated) {
      await this.stage.riseRowsIn();
    }
  }

  /**
   * After a turn: the latest list that arrived during it is applied, page 1 is turned
   * to when "first page only" asked for it during the turn, and a tower stopped during
   * the turn rests on page 1 for the next take. Nothing asked during a turn is dropped.
   */
  private async settleWhatArrivedDuringTheTurn(skipAnimation: boolean): Promise<void> {
    const pendingUpdate = this.updateArrivedDuringTurn;
    const wasPageOneAsked = this.wasPageOneAskedDuringTurn;
    this.updateArrivedDuringTurn = undefined;
    this.wasPageOneAskedDuringTurn = false;

    if (this.isDisposed()) {
      return;
    }
    if (!this.isOnAir()) {
      // Stopped during the turn: page 1 is drawn off air from the latest data, which
      // covers the pending update too.
      this.restOnPageOneForTheNextTake();
      return;
    }
    if (pendingUpdate !== undefined) {
      await this.placeEntriesOnTheStage(pendingUpdate.skipAnimation);
    }
    if (wasPageOneAsked && this.stage.readCurrentPage() !== 1) {
      await this.turnToPage(1, skipAnimation);
    }
  }
}
