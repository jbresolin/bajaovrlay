// Test support: a wall clock and one-shot timers that only move when the test says so,
// for the event detection and the event runner. Letting time pass moves the clock and runs
// every timer that comes due, in the order they come due, with the clock showing each
// one's moment while it runs, as a real clock would.

/** One timer that was started and has neither run nor been cancelled. */
type PendingTimer = { onTimeIsUp: () => void; dueAtMs: number; startOrder: number };

/** The clock, the two timer functions the services take, and the ways a test moves time. */
export type ClockAndTimersMovedByHand = {
  /** What the clock shows now; hand it to the store and the runner as `readCurrentTime`. */
  readCurrentTime: () => Date;
  /** Stands in for setTimeout; returns the handle cancelTimer takes. */
  startTimer: (onTimeIsUp: () => void, delayInMilliseconds: number) => unknown;
  /** Stands in for clearTimeout. */
  cancelTimer: (timerHandle: unknown) => void;
  /** Moves the clock forward, running each timer that comes due at the moment it is due. */
  letTimePass: (durationInMilliseconds: number) => void;
  /** Runs the timers due now (a 0 ms timer started a moment ago), without moving the clock. */
  runTheTimersDueNow: () => void;
};

/** Creates a clock held at the given moment (ISO 8601) and one-shot timers that follow it. */
export function createClockAndTimersMovedByHand(startMoment: string): ClockAndTimersMovedByHand {
  let nowMs = Date.parse(startMoment);
  let timersStarted = 0;
  const pendingTimersByHandle = new Map<number, PendingTimer>();

  /** The handle of the pending timer due first by `untilMs` (first started on a tie). */
  function findHandleOfNextTimerDueBy(untilMs: number): number | undefined {
    let handleFound: number | undefined;
    let timerFound: PendingTimer | undefined;
    for (const [handle, timer] of pendingTimersByHandle) {
      if (timer.dueAtMs > untilMs) {
        continue;
      }
      const isEarlier =
        timerFound === undefined ||
        timer.dueAtMs < timerFound.dueAtMs ||
        (timer.dueAtMs === timerFound.dueAtMs && timer.startOrder < timerFound.startOrder);
      if (isEarlier) {
        handleFound = handle;
        timerFound = timer;
      }
    }
    return handleFound;
  }

  function letTimePass(durationInMilliseconds: number): void {
    const endMs = nowMs + durationInMilliseconds;
    let handleDue = findHandleOfNextTimerDueBy(endMs);
    while (handleDue !== undefined) {
      const timerDue = pendingTimersByHandle.get(handleDue);
      pendingTimersByHandle.delete(handleDue);
      if (timerDue !== undefined) {
        nowMs = Math.max(nowMs, timerDue.dueAtMs);
        timerDue.onTimeIsUp();
      }
      handleDue = findHandleOfNextTimerDueBy(endMs);
    }
    nowMs = endMs;
  }

  return {
    readCurrentTime: () => new Date(nowMs),
    startTimer: (onTimeIsUp, delayInMilliseconds) => {
      timersStarted += 1;
      const handle = timersStarted;
      pendingTimersByHandle.set(handle, {
        onTimeIsUp,
        dueAtMs: nowMs + delayInMilliseconds,
        startOrder: timersStarted,
      });
      return handle;
    },
    cancelTimer: (timerHandle) => {
      pendingTimersByHandle.delete(timerHandle as number);
    },
    letTimePass,
    runTheTimersDueNow: () => {
      letTimePass(0);
    },
  };
}
