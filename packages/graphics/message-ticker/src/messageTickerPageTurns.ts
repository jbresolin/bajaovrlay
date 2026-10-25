/**
 * How the message ticker's pages turn: one message a page, in the list's order, cycling.
 * On air the next message is written on the message pill that is not on air and rises
 * while the old one lifts away (the kit's barMotion), then the pills trade roles and the
 * page cell's number changes in place; off air the ticker rests on its first message for
 * the next take. One turn at a time; an update that arrives during a turn is drawn once it
 * has ended. The lower strip's lowerStripPageTurns.ts is the same shape with a lane of cars
 * in place of a message.
 */
import {
  type BarTimeline,
  buildBarPageTurnTimeline,
  placeBarPiecesOffAir,
} from '@bajaovrlay/graphics-kit/barMotion';
import { chooseNextPageInCycle } from '@bajaovrlay/graphics-kit/pageCycle';

import type { MessageTickerData } from './messageTickerModel.js';
import {
  markMessagePillOnAir,
  type MessageTickerParts,
  writeLabel,
  writeMessageOnPill,
  writePageCell,
} from './messageTickerView.js';

/** What the turns need from the component; the readers are called again after every await. */
export type MessageTickerPageTurnsOptions = {
  isOnAir: () => boolean;
  isOffAir: () => boolean;
  isMotionRunning: () => boolean;
  readParts: () => MessageTickerParts;
  readData: () => MessageTickerData;
  runMotionTimeline: (timeline: BarTimeline) => Promise<void>;
};

/** The page turns of one ticker: the message and the pill on air, the turn, what arrived. */
export class MessageTickerPageTurns {
  private readonly options: MessageTickerPageTurnsOptions;
  private currentPageNumber = 1;
  private pillOnAirIndex: 0 | 1 = 0;
  private isTurningPage = false;
  private wasUpdateKeptForAfterTheTurn = false;

  constructor(options: MessageTickerPageTurnsOptions) {
    this.options = options;
  }

  /** How many pages the stored messages fill: one a message. */
  countPages(): number {
    return this.options.readData().messages.length;
  }

  /** The message pill on air now: what the play-in and the stop-out move. */
  readMessagePillOnAir(): HTMLElement {
    return this.options.readParts().messagePills[this.pillOnAirIndex];
  }

  /**
   * Writes the label and the message shown now on the pill on air, in place. A list that
   * shrank under the page on air lands on its last message. The label is written here, with
   * the message, so a new label that arrives during a turn or the stop-out waits as the
   * message does, never rewriting a fading pill.
   */
  drawCurrentPage(): void {
    const parts = this.options.readParts();
    const data = this.options.readData();
    const messages = data.messages;
    writeLabel(parts, data.label);
    this.currentPageNumber = Math.min(this.currentPageNumber, messages.length);
    writeMessageOnPill(this.readMessagePillOnAir(), messages[this.currentPageNumber - 1] ?? '');
    markMessagePillOnAir(parts, this.pillOnAirIndex);
    writePageCell(parts, this.currentPageNumber, messages.length);
  }

  /**
   * Draws data that has just been stored: on air the message in place; off air and
   * settled the first message. During a turn it is kept for the turn's end; during the
   * stop-out nothing is drawn, and the rest that ends the stop-out draws the latest data.
   */
  drawUpdatedData(): void {
    if (this.isTurningPage) {
      this.wasUpdateKeptForAfterTheTurn = true;
      return;
    }
    if (this.options.isOnAir()) {
      this.drawCurrentPage();
      return;
    }
    this.restOnTheFirstMessageOnceSettledOffAir();
  }

  /** Turns to the next message. Nothing happens off air, during a turn, or with one message. */
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
   * Off air the ticker rests on its first message on its first pill, both pills invisible,
   * so the next take starts at the top. Done by whichever ends last of a stop-out and a turn
   * the stop cut short.
   */
  restOnTheFirstMessageOnceSettledOffAir(): void {
    const isSettledOffAir =
      this.options.isOffAir() && !this.isTurningPage && !this.options.isMotionRunning();
    if (!isSettledOffAir) {
      return;
    }
    const parts = this.options.readParts();
    this.pillOnAirIndex = 0;
    this.currentPageNumber = 1;
    this.drawCurrentPage();
    placeBarPiecesOffAir(parts.bar, parts.messagePills);
  }

  /**
   * The turn, on air: the next message is written on the other pill, which rises while the
   * one on air lifts away; the pills trade roles and the page cell changes in place.
   */
  private async turnToPage(pageNumber: number): Promise<void> {
    const parts = this.options.readParts();
    const leavingPill = this.readMessagePillOnAir();
    const arrivingPillIndex = this.pillOnAirIndex === 0 ? 1 : 0;
    const arrivingPill = parts.messagePills[arrivingPillIndex];
    this.isTurningPage = true;
    try {
      this.wasUpdateKeptForAfterTheTurn = false;
      const messages = this.options.readData().messages;
      writeMessageOnPill(arrivingPill, messages[pageNumber - 1] ?? '');
      placeBarPiecesOffAir(parts.bar, [arrivingPill]);
      this.currentPageNumber = pageNumber;
      this.pillOnAirIndex = arrivingPillIndex;
      markMessagePillOnAir(parts, arrivingPillIndex);
      writePageCell(parts, pageNumber, messages.length);
      await this.options.runMotionTimeline(
        buildBarPageTurnTimeline(parts.bar, [leavingPill], [arrivingPill]),
      );
    } finally {
      this.isTurningPage = false;
    }
    if (this.wasUpdateKeptForAfterTheTurn && this.options.isOnAir()) {
      this.wasUpdateKeptForAfterTheTurn = false;
      this.drawCurrentPage();
    }
    this.restOnTheFirstMessageOnceSettledOffAir();
  }
}
