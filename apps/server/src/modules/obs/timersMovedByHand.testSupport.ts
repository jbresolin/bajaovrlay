// Test support: one-shot timers that only run when the test lets time pass, for the OBS
// connection's two waits (the 5 s before trying again, and the 3 s OBS has to answer).
// Real sockets keep running on real time; only these waits are moved by hand, so no test
// waits on the clock.

/** One timer that was started and has neither run nor been cancelled. */
type PendingTimer = {
  onTimeIsUp: () => void;
  dueAtMs: number;
  startOrder: number;
  delayInMilliseconds: number;
};

/** The two timer functions the connection takes, and the way a test moves time. */
export type TimersMovedByHand = {
  /** Stands in for setTimeout; returns the handle cancelTimer takes. */
  startTimer: (onTimeIsUp: () => void, delayInMilliseconds: number) => unknown;
  /** Stands in for clearTimeout. */
  cancelTimer: (timerHandle: unknown) => void;
  /** Moves time forward, running each timer that comes due, in the order they come due. */
  letTimePass: (durationInMilliseconds: number) => void;
  /** How many timers are waiting to run. */
  countPendingTimers: () => number;
  /**
   * Resolves once a timer of this delay is waiting to run: at once if one is, otherwise
   * when one is started. The connection starts its waits after a socket answered, so a
   * test waits for the wait itself before letting time pass.
   */
  waitForAPendingTimerOf: (delayInMilliseconds: number) => Promise<void>;
};

/** Creates timers that start at time 0 and only move when letTimePass is called. */
export function createTimersMovedByHand(): TimersMovedByHand {
  let nowMs = 0;
  let timersStarted = 0;
  const pendingTimersByHandle = new Map<number, PendingTimer>();
  const waitsForATimer: Array<{ delayInMilliseconds: number; resolve: () => void }> = [];

  /** Whether a pending timer was started with this delay. */
  function isATimerOfDelayPending(delayInMilliseconds: number): boolean {
    for (const timer of pendingTimersByHandle.values()) {
      if (timer.delayInMilliseconds === delayInMilliseconds) {
        return true;
      }
    }
    return false;
  }

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

  return {
    startTimer: (onTimeIsUp, delayInMilliseconds) => {
      timersStarted += 1;
      const handle = timersStarted;
      pendingTimersByHandle.set(handle, {
        onTimeIsUp,
        dueAtMs: nowMs + delayInMilliseconds,
        startOrder: timersStarted,
        delayInMilliseconds,
      });
      for (const wait of [...waitsForATimer]) {
        if (wait.delayInMilliseconds === delayInMilliseconds) {
          waitsForATimer.splice(waitsForATimer.indexOf(wait), 1);
          wait.resolve();
        }
      }
      return handle;
    },
    cancelTimer: (timerHandle) => {
      pendingTimersByHandle.delete(timerHandle as number);
    },
    letTimePass: (durationInMilliseconds) => {
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
    },
    countPendingTimers: () => pendingTimersByHandle.size,
    waitForAPendingTimerOf: (delayInMilliseconds) => {
      if (isATimerOfDelayPending(delayInMilliseconds)) {
        return Promise.resolve();
      }
      return new Promise((resolve) => waitsForATimer.push({ delayInMilliseconds, resolve }));
    },
  };
}
