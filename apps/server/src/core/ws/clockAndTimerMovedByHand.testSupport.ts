// Test support: a wall clock and a repeating timer that only move when the test says so,
// for the hub's ten-second `time` message. The clock and the timer are one thing here,
// as they are in real life: letting time pass moves the clock and fires every tick that
// came due, in order.

/** One repeating timer that was started and not cancelled yet. */
type RunningRepeatingTimer = {
  onEachInterval: () => void;
  intervalInMilliseconds: number;
  nextTickAtMs: number;
};

/** The clock, the two timer functions the hub takes, and the ways a test moves time. */
export type ClockAndTimerMovedByHand = {
  /** What the clock shows now; hand it to the store and the hub as `readCurrentTime`. */
  readCurrentTime: () => Date;
  /** Stands in for setInterval; returns the handle cancelRepeatingTimer takes. */
  startRepeatingTimer: (onEachInterval: () => void, intervalInMilliseconds: number) => unknown;
  /** Stands in for clearInterval. */
  cancelRepeatingTimer: (timerHandle: unknown) => void;
  /** Moves the clock forward, firing each tick that comes due at the moment it is due. */
  letTimePass: (durationInMilliseconds: number) => void;
  /** How many repeating timers are running (started and not cancelled). */
  countRunningTimers: () => number;
};

/** Creates a clock held at the given moment (ISO 8601) and a timer that follows it. */
export function createClockAndTimerMovedByHand(startMoment: string): ClockAndTimerMovedByHand {
  let nowMs = Date.parse(startMoment);
  let numberOfTimersStarted = 0;
  const runningTimersByHandle = new Map<number, RunningRepeatingTimer>();

  /** The running timer whose next tick is the earliest one due by `untilMs`, if any. */
  function findNextTimerDueBy(untilMs: number): RunningRepeatingTimer | undefined {
    let nextTimerDue: RunningRepeatingTimer | undefined = undefined;
    for (const timer of runningTimersByHandle.values()) {
      const isDue = timer.nextTickAtMs <= untilMs;
      const isEarlierThanTheOneFound =
        nextTimerDue === undefined || timer.nextTickAtMs < nextTimerDue.nextTickAtMs;
      if (isDue && isEarlierThanTheOneFound) {
        nextTimerDue = timer;
      }
    }
    return nextTimerDue;
  }

  function letTimePass(durationInMilliseconds: number): void {
    const endMs = nowMs + durationInMilliseconds;
    let timerDue = findNextTimerDueBy(endMs);
    while (timerDue !== undefined) {
      // The clock shows the moment of the tick while the tick runs, as a real one would.
      nowMs = timerDue.nextTickAtMs;
      timerDue.nextTickAtMs += timerDue.intervalInMilliseconds;
      timerDue.onEachInterval();
      timerDue = findNextTimerDueBy(endMs);
    }
    nowMs = endMs;
  }

  return {
    readCurrentTime: () => new Date(nowMs),
    startRepeatingTimer: (onEachInterval, intervalInMilliseconds) => {
      numberOfTimersStarted += 1;
      const timerHandle = numberOfTimersStarted;
      runningTimersByHandle.set(timerHandle, {
        onEachInterval,
        intervalInMilliseconds,
        nextTickAtMs: nowMs + intervalInMilliseconds,
      });
      return timerHandle;
    },
    cancelRepeatingTimer: (timerHandle) => {
      runningTimersByHandle.delete(timerHandle as number);
    },
    letTimePass,
    countRunningTimers: () => runningTimersByHandle.size,
  };
}
