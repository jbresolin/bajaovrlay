/**
 * The clock block as a bar along the bottom runs it (the lower strip, the message ticker):
 * the frame loop that redraws it on air, the redraw itself at the server-aligned "now" (as
 * the race clock's card, so both show the same time), and the switch "Mostrar o relógio":
 * the bar's `data-clock-block` (its grid loses a column), the block's `hidden`, and the
 * block put straight in its place when it is switched on while on air (a change on air is
 * read, not watched). The bar keeps its own lifecycle and asks this for the clock.
 */
import { readServerAlignedTimeMs } from '@bajaovrlay/shared/clock';

import { placeBarPiecesOnAir } from './barMotion.js';
import { type ClockBlockParts, writeClockBlockAt } from './clockBlock.js';
import { type ClockTicker, createClockTicker } from './clockTicker.js';
import type { RaceClockReading } from './raceClockReading.js';

/** What the clock block needs from its bar; the readers are called anew every time. */
export type ClockBlockOnBarOptions = {
  /** The bar element, which carries `data-clock-block`; undefined before load. */
  readBar: () => HTMLElement | undefined;
  /** The block's parts; undefined before load. */
  readClockBlock: () => ClockBlockParts | undefined;
  /** The clock's reading now; undefined before load. */
  readReading: () => RaceClockReading | undefined;
  /** requestAnimationFrame and cancelAnimationFrame in a graphic. */
  requestFrame: (callback: () => void) => number;
  cancelFrame: (frameId: number) => void;
};

/** The clock block of one bar. */
export type ClockBlockOnBar = {
  /** Writes the block as the reading is now; nothing before load. */
  redraw: () => void;
  /** Starts redrawing every frame (play); a second start does nothing. */
  startTicking: () => void;
  /** Stops the frame loop, cancelling the pending frame (stop, dispose, removal). */
  stopTicking: () => void;
  /** Shows or hides the block; shown while on air, it is placed in its place at once. */
  writeSwitch: (isShown: boolean, isOnAir: boolean) => void;
};

/** The five fields of the clock's reading out of a bar's data, which holds more. */
export function readClockReadingFrom(data: RaceClockReading): RaceClockReading {
  return {
    state: data.state,
    clockMode: data.clockMode,
    referenceTimeMs: data.referenceTimeMs,
    referenceWallClockMs: data.referenceWallClockMs,
    running: data.running,
  };
}

/** Creates the clock block of a bar, its frame loop stopped. */
export function createClockBlockOnBar(options: ClockBlockOnBarOptions): ClockBlockOnBar {
  function redraw(): void {
    const clockBlock = options.readClockBlock();
    const reading = options.readReading();
    if (clockBlock === undefined || reading === undefined) {
      return;
    }
    writeClockBlockAt(clockBlock, reading, readServerAlignedTimeMs());
  }

  const clockTicker: ClockTicker = createClockTicker({
    onFrame: redraw,
    requestFrame: options.requestFrame,
    cancelFrame: options.cancelFrame,
  });

  function writeSwitch(isShown: boolean, isOnAir: boolean): void {
    const bar = options.readBar();
    const clockBlock = options.readClockBlock();
    if (bar === undefined || clockBlock === undefined) {
      return;
    }
    bar.dataset.clockBlock = isShown ? 'shown' : 'hidden';
    clockBlock.block.hidden = !isShown;
    if (isShown && isOnAir) {
      placeBarPiecesOnAir([clockBlock.block]);
    }
  }

  return {
    redraw,
    startTicking: () => clockTicker.start(),
    stopTicking: () => clockTicker.stop(),
    writeSwitch,
  };
}
