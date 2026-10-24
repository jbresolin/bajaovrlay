/**
 * What is on the tower's stage: the page on air and one row per visible car, and how
 * they change for a new list (slides, rises and lifts), a page turn (the rows out, the
 * new page's rows in) and a column change (the same rows, their cells rebuilt). The
 * stage owns the rows and the one motion running at a time; the component
 * (positions-tower.ts) owns the lifecycle and tells the stage what to do and whether
 * to animate. The component's tests (positions-tower.updateAction.test.ts) drive the
 * stage through the component; the view's tests cover the DOM writes.
 */
import { finishTimelineAtOnce } from '@bajaovrlay/graphics-kit/timelinePlayback';

import {
  buildCueHoldTimeline,
  buildPlayInTimeline,
  buildRowsInTimeline,
  buildRowsOutTimeline,
  buildStopOutTimeline,
  buildUpdateTimeline,
  placePillsOffAir,
  type TowerTimeline,
} from './positionsTowerAnimations.js';
import type { TowerEntry, TowerSettings } from './positionsTowerModel.js';
import {
  applyColumnsToTower,
  placeVisibleEntries,
  type PositionsTowerParts,
  rebuildEveryRowForColumns,
  type RowPlacement,
  type TowerRowsByCarNumber,
} from './positionsTowerView.js';
import type { TowerColumn } from './towerColumns.js';
import { countTowerPages, selectEntriesOnPage } from './towerPages.js';
import { clearCueOnRowOfUpdate } from './towerRows.js';

/** What the stage needs from its owner. */
export type TowerStageOptions = {
  parts: PositionsTowerParts;
  /** How many rows a page holds (the theme's `--tower-rows-per-page`). */
  rowsPerPage: number;
  /** Plays a timeline to its end; the owner keeps track of it so dispose can end it early. */
  runTimeline: (timeline: TowerTimeline, skipAnimation: boolean) => Promise<void>;
};

/** The rows on the page for one tower, keyed by car number, and the page they show. */
export class TowerStage {
  private readonly parts: PositionsTowerParts;
  private readonly rowsPerPage: number;
  private readonly runTimeline: TowerStageOptions['runTimeline'];
  private readonly rows: TowerRowsByCarNumber = new Map();
  private visibleEntries: TowerEntry[] = [];
  private columns: TowerColumn[] = [];
  private currentPage = 1;
  private updateCount = 0;
  private runningMotionTimeline: TowerTimeline | undefined = undefined;
  private isPlayInRunning = false;

  constructor(options: TowerStageOptions) {
    this.parts = options.parts;
    this.rowsPerPage = options.rowsPerPage;
    this.runTimeline = options.runTimeline;
  }

  /** The page on air, from 1. */
  readCurrentPage(): number {
    return this.currentPage;
  }

  /** How many pages `entryCount` cars take on this stage. */
  countPages(entryCount: number): number {
    return countTowerPages(entryCount, this.rowsPerPage);
  }

  /**
   * Dresses the tower for the settings, rebuilds every row's cells for its columns and
   * writes the visible rows again, so no cell made by the change is left empty, even
   * during a page turn.
   */
  applyColumns(settings: TowerSettings): void {
    this.columns = applyColumnsToTower(this.parts, settings);
    rebuildEveryRowForColumns(this.rows, this.columns, this.visibleEntries);
  }

  /** Whether the play-in cascade is still running; an update then draws at once on it. */
  isPlayingIn(): boolean {
    return this.isPlayInRunning;
  }

  /** Puts the head in its off-air look, as load leaves it for the first play. */
  placeHeadOffAir(): void {
    placePillsOffAir(this.parts.tokensSource, [this.parts.head]);
  }

  /**
   * Makes the rows match the current page of `entries` without motion (load, a page
   * turn's second half, an update off air or with skipAnimation). The page is clamped
   * to the pages the list has.
   */
  placeCurrentPage(entries: readonly TowerEntry[], placement: RowPlacement): void {
    this.currentPage = Math.min(this.currentPage, this.countPages(entries.length));
    const entriesAfter = selectEntriesOnPage(entries, this.currentPage, this.rowsPerPage);
    placeVisibleEntries(
      this.parts,
      this.rows,
      this.visibleEntries,
      entriesAfter,
      this.columns,
      placement,
      this.nextCueMark(),
    );
    this.visibleEntries = entriesAfter;
  }

  /**
   * Applies a new list to the page on air with motion: the rows whose slot changed
   * slide, cars entering the page rise in, cars leaving lift out and are then removed,
   * and the cues go up and are cleared after their hold. A motion still running (the
   * play-in, an earlier update) is finished at once first, so FLIP measures settled rows.
   */
  async applyEntriesWithMotion(entries: readonly TowerEntry[]): Promise<void> {
    this.finishRunningMotionTimeline();
    this.currentPage = Math.min(this.currentPage, this.countPages(entries.length));
    const entriesAfter = selectEntriesOnPage(entries, this.currentPage, this.rowsPerPage);
    const cueMark = this.nextCueMark();
    const change = placeVisibleEntries(
      this.parts,
      this.rows,
      this.visibleEntries,
      entriesAfter,
      this.columns,
      'animated',
      cueMark,
    );
    this.visibleEntries = entriesAfter;

    if (change.cuedRows.length > 0) {
      const clearCuesOfThisUpdate = () => {
        for (const { row } of change.cuedRows) {
          clearCueOnRowOfUpdate(row, cueMark);
        }
      };
      const cueHold = buildCueHoldTimeline(this.parts.tokensSource, clearCuesOfThisUpdate);
      void this.runTimeline(cueHold, false);
    }

    const updateMotion = buildUpdateTimeline(this.parts.tokensSource, {
      slotShifts: change.slotShifts,
      rowsEntering: change.rowsEntering.map((row) => row.element),
      rowsLeaving: change.rowsLeaving.map((row) => row.element),
    });
    await this.runMotionTimeline(updateMotion, false);
    for (const row of change.rowsLeaving) {
      row.element.remove();
    }
  }

  /** The play-in: the head, then the rows in cascade. */
  async playIn(skipAnimation: boolean): Promise<void> {
    const { tokensSource, head } = this.parts;
    const playIn = buildPlayInTimeline(tokensSource, head, this.listVisibleRowElements());
    this.isPlayInRunning = true;
    try {
      await this.runMotionTimeline(playIn, skipAnimation);
    } finally {
      this.isPlayInRunning = false;
    }
  }

  /** The stop-out: every pill together. */
  async playOut(skipAnimation: boolean): Promise<void> {
    const { tokensSource, head } = this.parts;
    const stopOut = buildStopOutTimeline(tokensSource, head, this.listVisibleRowElements());
    await this.runMotionTimeline(stopOut, skipAnimation);
  }

  /** A page turn's first half: the rows on air leave together; the head stays. */
  async liftRowsOut(): Promise<void> {
    this.finishRunningMotionTimeline();
    const rowsOut = buildRowsOutTimeline(this.parts.tokensSource, this.listVisibleRowElements());
    await this.runMotionTimeline(rowsOut, false);
  }

  /** A page turn's middle: every row goes, and the asked page is drawn from `entries`. */
  showPage(entries: readonly TowerEntry[], pageNumber: number, placement: RowPlacement): void {
    for (const row of this.rows.values()) {
      row.element.remove();
    }
    this.rows.clear();
    this.visibleEntries = [];
    this.currentPage = pageNumber;
    this.placeCurrentPage(entries, placement);
  }

  /** A page turn's second half: the new page's rows rise in cascade. */
  async riseRowsIn(): Promise<void> {
    const rowsIn = buildRowsInTimeline(this.parts.tokensSource, this.listVisibleRowElements());
    await this.runMotionTimeline(rowsIn, false);
  }

  /** Jumps the motion still running (if any) to its end, so the next one starts settled. */
  finishRunningMotionTimeline(): void {
    if (this.runningMotionTimeline !== undefined) {
      finishTimelineAtOnce(this.runningMotionTimeline);
      this.runningMotionTimeline = undefined;
    }
  }

  /** The `<li>` of every row on the page, in slot order. */
  private listVisibleRowElements(): HTMLElement[] {
    const elements: HTMLElement[] = [];
    for (const entry of this.visibleEntries) {
      const row = this.rows.get(entry.carNumber);
      if (row !== undefined) {
        elements.push(row.element);
      }
    }
    return elements;
  }

  /** A mark unique to each update, so a cue hold clears only the cues of its update. */
  private nextCueMark(): string {
    this.updateCount += 1;
    return `update-${this.updateCount}`;
  }

  /** Runs an in, out, page or update motion; one still running is finished at once first. */
  private async runMotionTimeline(timeline: TowerTimeline, skipAnimation: boolean): Promise<void> {
    this.finishRunningMotionTimeline();
    this.runningMotionTimeline = timeline;
    await this.runTimeline(timeline, skipAnimation);
    if (this.runningMotionTimeline === timeline) {
      this.runningMotionTimeline = undefined;
    }
  }
}
