/**
 * The per-frame loop that redraws the clock text while the graphic is on air. Only one
 * loop ever runs, and stopping it cancels the pending frame, so nothing keeps running
 * inside OBS after stop or dispose.
 */

/** What the ticker needs: what to do each frame, and how to book and cancel frames. */
export type ClockTickerOptions = {
  onFrame: () => void;
  requestFrame: (callback: () => void) => number;
  cancelFrame: (frameId: number) => void;
};

/** A loop that can be started and stopped any number of times. */
export type ClockTicker = {
  start: () => void;
  stop: () => void;
};

/**
 * Creates a stopped ticker. `requestFrame`/`cancelFrame` are requestAnimationFrame and
 * cancelAnimationFrame in the graphic; tests pass hand-driven stand-ins.
 */
export function createClockTicker(options: ClockTickerOptions): ClockTicker {
  let pendingFrameId: number | undefined;

  function runOneFrameAndBookTheNext(): void {
    pendingFrameId = options.requestFrame(runOneFrameAndBookTheNext);
    options.onFrame();
  }

  function start(): void {
    const isAlreadyRunning = pendingFrameId !== undefined;
    if (isAlreadyRunning) {
      return;
    }
    pendingFrameId = options.requestFrame(runOneFrameAndBookTheNext);
  }

  function stop(): void {
    if (pendingFrameId === undefined) {
      return;
    }
    options.cancelFrame(pendingFrameId);
    pendingFrameId = undefined;
  }

  return { start, stop };
}
