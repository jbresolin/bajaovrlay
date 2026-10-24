/**
 * The timer that turns the tower's pages while it is on air with pages cycling: hold,
 * turn, hold again. The hold is read anew before every wait so the theme's
 * `--motion-strip-hold` is followed, and a turn is awaited before the next hold so one
 * turn's animation is never cut by the next. A turn that fails does not stop the holds:
 * a tower stuck on one page for the rest of the stream would be the worse failure. The
 * timer is local to the graphic: the program page and the preview page each turn their
 * own pages (decision 15).
 */

/** What the turner needs: what a turn is, how long to hold, and how to book and cancel waits. */
export type PageTurnerOptions = {
  /** Turns to the next page; resolves once the turn's animation has ended. */
  onTurn: () => Promise<void>;
  /** The hold before each turn, in milliseconds, read when the wait is booked. */
  readHoldMs: () => number;
  setTimer: (callback: () => void, delayMs: number) => number;
  clearTimer: (timerId: number) => void;
};

/** A timer that can be started and stopped any number of times. */
export type PageTurner = {
  start: () => void;
  stop: () => void;
};

/**
 * Creates a stopped turner. `setTimer`/`clearTimer` are setTimeout and clearTimeout in
 * the graphic; tests pass hand-driven stand-ins.
 */
export function createPageTurner(options: PageTurnerOptions): PageTurner {
  let pendingTimerId: number | undefined;
  let isRunning = false;

  function bookTheNextHold(): void {
    pendingTimerId = options.setTimer(turnAfterTheHold, options.readHoldMs());
  }

  function bookTheNextHoldUnlessStopped(): void {
    // A stop that landed during the turn wins: no further hold.
    if (isRunning) {
      bookTheNextHold();
    }
  }

  function turnAfterTheHold(): void {
    pendingTimerId = undefined;
    void options
      .onTurn()
      .catch(() => {
        // Deliberately swallowed: the turn's failure is the graphic's to report; the
        // pages must go on turning (see the module comment).
      })
      .then(bookTheNextHoldUnlessStopped);
  }

  function start(): void {
    if (isRunning) {
      return;
    }
    isRunning = true;
    bookTheNextHold();
  }

  function stop(): void {
    isRunning = false;
    if (pendingTimerId === undefined) {
      return;
    }
    options.clearTimer(pendingTimerId);
    pendingTimerId = undefined;
  }

  return { start, stop };
}
