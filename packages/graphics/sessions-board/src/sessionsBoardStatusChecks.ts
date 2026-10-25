/**
 * The sessions board's statuses on air (BAJAOVRLAY-46), kept out of sessions-board.ts so the
 * lifecycle file stays one responsibility. It holds the slots on the board with their status
 * now, draws them, books the one timer that re-checks them at the next start or end of any
 * slot, and, at a check or after an edit, crossfades the rows whose status changed.
 *
 * What could go wrong: a timer left booked after stop, dispose or a second booking would
 * re-check a board off air; every booking therefore cancels the one before it, and the
 * graphic cancels it on stop, dispose and removal from the page.
 */
import type { GraphicTimeline } from '@bajaovrlay/graphics-kit/timelinePlayback';
import { readServerAlignedTimeMs } from '@bajaovrlay/shared/clock';
import type { ScheduleSlotStatus } from '@bajaovrlay/shared/scheduleSlotStatus';

import {
  buildStatusCrossfadeTimeline,
  placeSessionsBoardPiecesOnAir,
  showStatusOfRowAtOnce,
  type SlotStatusChange,
} from './sessionsBoardAnimations.js';
import type { SessionsBoardData } from './sessionsBoardModel.js';
import { findSessionsBoard, findSessionsBoardRows } from './sessionsBoardView.js';
import {
  findNextStatusChangeAfter,
  listSlotsOnTheBoardAt,
  type SlotOnTheBoard,
} from './sessionsBoardWindow.js';

/** What the status checks need from the graphic; each reader is called anew. */
export type SessionsBoardStatusChecksOptions = {
  readRenderRoot: () => ParentNode;
  readData: () => SessionsBoardData;
  isOnAir: () => boolean;
  /** Asks Lit to draw the slots now held here, and waits until it has. */
  redrawNow: () => Promise<void>;
  /** Runs a motion through the graphic's one-at-a-time runner. */
  runMotion: (timeline: GraphicTimeline) => Promise<void>;
};

/** The slots on one sessions board, their statuses now, and the timer that re-checks them. */
export class SessionsBoardStatusChecks {
  private slotsOnTheBoard: SlotOnTheBoard[] = [];
  private pendingCheckTimerId: number | undefined = undefined;

  constructor(private readonly options: SessionsBoardStatusChecksOptions) {}

  /** The slots the view draws now, each with its status. */
  readSlotsOnTheBoard(): SlotOnTheBoard[] {
    return this.slotsOnTheBoard;
  }

  /** Draws the data's slots as they are now, each row's status shown at once. */
  async drawTheStatusesNowAtOnce(data: SessionsBoardData): Promise<void> {
    await this.redrawSlotsAt(data, readServerAlignedTimeMs(), new Map());
  }

  /**
   * Redraws the slots as they are now while on air: rows kept by slot id keep their look,
   * a row new on the board (an added slot, the window moving on) is placed on air at once,
   * and every slot whose status changed crossfades.
   */
  async redrawOnAirAndCrossfadeTheChanges(data: SessionsBoardData): Promise<void> {
    const statusesBefore = new Map(
      this.slotsOnTheBoard.map((entry) => [entry.slot.slotId, entry.status]),
    );
    const renderRoot = this.options.readRenderRoot();
    const rowsBefore = new Set(findSessionsBoardRows(renderRoot).map((parts) => parts.row));
    await this.redrawSlotsAt(data, readServerAlignedTimeMs(), statusesBefore);

    const changes: SlotStatusChange[] = [];
    for (const rowParts of findSessionsBoardRows(renderRoot)) {
      const statusAfter = this.readStatusOfSlot(rowParts.slotId);
      const statusBefore = statusesBefore.get(rowParts.slotId);
      if (!rowsBefore.has(rowParts.row) || statusBefore === undefined) {
        placeSessionsBoardPiecesOnAir([rowParts.row]);
        showStatusOfRowAtOnce(rowParts, statusAfter);
        continue;
      }
      if (statusBefore !== statusAfter) {
        changes.push({ rowParts, statusBefore, statusAfter });
      }
    }
    if (changes.length > 0) {
      const crossfade = buildStatusCrossfadeTimeline(findSessionsBoard(renderRoot), changes);
      await this.options.runMotion(crossfade);
    }
  }

  /**
   * Books the check for the next moment a status changes, cancelling the one booked before;
   * none off air or when nothing will change.
   */
  bookTheNextStatusCheck(): void {
    this.cancelTheStatusCheck();
    if (!this.options.isOnAir()) {
      return;
    }
    const nowMs = readServerAlignedTimeMs();
    const nextChangeMs = findNextStatusChangeAfter(this.options.readData().slots, nowMs);
    if (nextChangeMs === undefined) {
      return;
    }
    this.pendingCheckTimerId = window.setTimeout(() => {
      void this.checkTheStatusesNow();
    }, nextChangeMs - nowMs);
  }

  /** Cancels the booked check, if there is one. */
  cancelTheStatusCheck(): void {
    if (this.pendingCheckTimerId === undefined) {
      return;
    }
    window.clearTimeout(this.pendingCheckTimerId);
    this.pendingCheckTimerId = undefined;
  }

  /**
   * The status check: the statuses are worked out again, the changed rows crossfade, and the
   * following check is booked. What the timer calls; the tests reach it through fake time.
   */
  private async checkTheStatusesNow(): Promise<void> {
    this.pendingCheckTimerId = undefined;
    if (!this.options.isOnAir()) {
      return;
    }
    await this.redrawOnAirAndCrossfadeTheChanges(this.options.readData());
    this.bookTheNextStatusCheck();
  }

  /**
   * Keeps the slots on the board at `nowMs`, waits until Lit has drawn them, and shows each
   * row's status at once, except the rows given a status to keep (on air, where the change
   * crossfades instead).
   */
  private async redrawSlotsAt(
    data: SessionsBoardData,
    nowMs: number,
    statusesToKeep: Map<string, ScheduleSlotStatus>,
  ): Promise<void> {
    this.slotsOnTheBoard = listSlotsOnTheBoardAt(data.slots, nowMs);
    await this.options.redrawNow();
    for (const rowParts of findSessionsBoardRows(this.options.readRenderRoot())) {
      const statusKept = statusesToKeep.get(rowParts.slotId);
      showStatusOfRowAtOnce(rowParts, statusKept ?? this.readStatusOfSlot(rowParts.slotId));
    }
  }

  /** The status a slot on the board has now; a row with no slot is a bug in the view. */
  private readStatusOfSlot(slotId: string): ScheduleSlotStatus {
    const entry = this.slotsOnTheBoard.find((candidate) => candidate.slot.slotId === slotId);
    if (entry === undefined) {
      throw new Error(`a row of slot "${slotId}" has no slot on the board; a bug in the view`);
    }
    return entry.status;
  }
}
