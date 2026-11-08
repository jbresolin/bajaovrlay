import type { Slices } from '@bajaovrlay/shared';

import type { ServerLogger } from '../logger/createLogger.js';
import { isAnyClockRunningOnAnOutput } from './clocksRunningOnAnOutput.js';
import type { ServerClock } from './serverClock.js';

/** How often the drift between the server clock and the wall clock is measured. */
export const reanchorIntervalInMilliseconds = 60_000;

/** The most one check moves the server clock: too little for anyone to see on screen. */
export const largestReanchorStepInMilliseconds = 50;

/** A drift this large is more than drift (someone set the clock, a failing sync): warn. */
const driftWorthAWarningInMilliseconds = 1_000;

/** What the re-anchoring needs: the clock it moves, the state it looks at, a logger. */
export type ServerClockReanchoringOptions = {
  serverClock: ServerClock;
  /** The store's slices now; a clock running on any output holds the re-anchoring. */
  readAllSlices: () => Slices;
  logger: ServerLogger;
};

/** The running re-anchoring; stop() ends it, and may be called more than once. */
export type ServerClockReanchoring = { stop: () => void };

/**
 * Once a minute, measures how far the server clock is from the wall clock and logs it.
 * The rule:
 * - no drift: nothing is moved or logged;
 * - a clock running on any output (program or preview): nothing is moved, the drift is
 *   logged as held, since a running clock would show the move;
 * - otherwise: the server clock moves towards the wall clock by the drift, but by 50 ms
 *   at most, and the drift and the move are logged (a warning past one second).
 * What could go wrong: a clock that runs all day holds the drift all day; it is logged
 * each minute, and covered once the clock stops. A drift of seconds takes a minute per
 * 50 ms to cover (20 minutes a second), on purpose: nothing on screen may jump.
 */
export function startServerClockReanchoring(
  options: ServerClockReanchoringOptions,
): ServerClockReanchoring {
  const { serverClock, readAllSlices, logger } = options;

  function checkTheDriftOnce(): void {
    const driftMs = serverClock.measureDriftFromWallClockMs();
    if (driftMs === 0) {
      return;
    }
    if (isAnyClockRunningOnAnOutput(readAllSlices())) {
      logger.info({ drift_ms: driftMs }, 'server clock drift held: a clock is running');
      return;
    }
    const movedMs = limitToTheLargestStep(driftMs);
    serverClock.shiftServerTimeBy(movedMs);
    const isTheDriftLarge = Math.abs(driftMs) >= driftWorthAWarningInMilliseconds;
    const logLevel = isTheDriftLarge ? 'warn' : 'info';
    logger[logLevel](
      { drift_ms: driftMs, moved_ms: movedMs },
      'server clock re-anchored towards the wall clock',
    );
  }

  const timerHandle = setInterval(checkTheDriftOnce, reanchorIntervalInMilliseconds);
  // The re-anchoring alone must never keep the process alive.
  timerHandle.unref();

  return { stop: () => clearInterval(timerHandle) };
}

/** The drift, cut to 50 ms either way: what one check may move. */
function limitToTheLargestStep(driftMs: number): number {
  if (driftMs > largestReanchorStepInMilliseconds) {
    return largestReanchorStepInMilliseconds;
  }
  if (driftMs < -largestReanchorStepInMilliseconds) {
    return -largestReanchorStepInMilliseconds;
  }
  return driftMs;
}
