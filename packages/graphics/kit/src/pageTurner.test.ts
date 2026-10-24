/**
 * Page turner (packages/graphics/kit; moved from positions-tower, which the tests below
 * still speak of, in BAJAOVRLAY-24 so the standings can share it)
 *
 * What this module is for:
 *   While the tower is on air with pages cycling, a timer turns the page every
 *   `--motion-strip-hold` (7 s in Ardósia; the standings use `--motion-board-hold`).
 *   The turner owns that timer: start it, and
 *   after each hold it asks for a turn and waits for the turn to finish before holding
 *   again; stop it, and the pending hold is cancelled. A timer that survived stop or
 *   dispose would keep turning pages of a tower that is no longer on air.
 *
 * What these tests prove:
 *   - Once started, the turner asks for a turn after one hold, and the next hold starts
 *     only once that turn has finished (a turn's animation is never cut by the next).
 *   - The hold is read anew for every wait, so a theme change takes effect at the next
 *     hold.
 *   - Starting twice does not run two timers side by side.
 *   - Stopping cancels the exact timer that was pending, and no turn is asked afterwards;
 *     a stop that lands during a turn stops the holds after it.
 *   - A turn that fails does not stop the pages: the next hold is booked all the same
 *     (a tower stuck on one page for the rest of the stream would be the worse failure).
 *
 * What these tests deliberately do not cover:
 *   - The real setTimeout; a hand-driven stand-in says exactly when time passes. The
 *     Playwright paging test runs the real one with a shortened hold.
 */
import { describe, expect, it } from 'vitest';

import { createPageTurner } from './pageTurner.js';

/**
 * Builds a setTimeout stand-in that fires only when the test calls `fireNextTimer`, and
 * remembers which timers were cancelled and how long each was booked for.
 */
function createHandDrivenTimers() {
  const pendingCallbacks = new Map<number, () => void>();
  const bookedDelays: number[] = [];
  const cancelledTimerIds: number[] = [];
  let lastTimerId = 0;

  return {
    pendingCallbacks,
    bookedDelays,
    cancelledTimerIds,
    setTimer(callback: () => void, delayMs: number): number {
      lastTimerId += 1;
      pendingCallbacks.set(lastTimerId, callback);
      bookedDelays.push(delayMs);
      return lastTimerId;
    },
    clearTimer(timerId: number): void {
      cancelledTimerIds.push(timerId);
      pendingCallbacks.delete(timerId);
    },
    fireNextTimer(): void {
      const callbacksDueNow = [...pendingCallbacks.values()];
      pendingCallbacks.clear();
      for (const callback of callbacksDueNow) {
        callback();
      }
    },
  };
}

/** A turn the test finishes by hand, so it can look between the ask and the finish. */
function createTurnFinishedByHand() {
  let finishTurn = () => {};
  let turnCount = 0;
  return {
    get turnCount() {
      return turnCount;
    },
    onTurn: () =>
      new Promise<void>((resolve) => {
        turnCount += 1;
        finishTurn = resolve;
      }),
    finishTurn: () => finishTurn(),
  };
}

/** Lets every promise that is already settled run its continuations (a few ticks deep). */
async function letPromisesSettle(): Promise<void> {
  for (let tick = 0; tick < 5; tick += 1) {
    await Promise.resolve();
  }
}

describe('createPageTurner', () => {
  it('asks for a turn after one hold and holds again only once the turn has finished', async () => {
    // Arrange: a turner on hand-driven timers with a 7 s hold and a turn finished by hand.
    const timers = createHandDrivenTimers();
    const turn = createTurnFinishedByHand();
    const turner = createPageTurner({
      onTurn: turn.onTurn,
      readHoldMs: () => 7000,
      setTimer: timers.setTimer,
      clearTimer: timers.clearTimer,
    });

    // Act: start it, let the hold pass, then look before and after finishing the turn.
    turner.start();
    timers.fireNextTimer();
    const pendingTimersDuringTheTurn = timers.pendingCallbacks.size;
    turn.finishTurn();
    await letPromisesSettle();

    // Assert: one turn was asked after a 7 s hold; no new hold ran during the turn, and
    // the next hold was booked once it finished.
    expect(turn.turnCount, 'one hold must ask for one turn').toBe(1);
    expect(timers.bookedDelays[0], 'the hold must be what the theme says').toBe(7000);
    expect(pendingTimersDuringTheTurn, 'no hold may run while a turn is in progress').toBe(0);
    expect(timers.pendingCallbacks.size, 'the next hold must start once the turn finished').toBe(1);
  });

  it('reads the hold anew for every wait', async () => {
    // Arrange: a hold that the theme changes from 7 s to 3 s after the first wait.
    const timers = createHandDrivenTimers();
    const turn = createTurnFinishedByHand();
    let holdMs = 7000;
    const turner = createPageTurner({
      onTurn: turn.onTurn,
      readHoldMs: () => holdMs,
      setTimer: timers.setTimer,
      clearTimer: timers.clearTimer,
    });

    // Act: start, change the hold, let the first hold pass and the turn finish.
    turner.start();
    holdMs = 3000;
    timers.fireNextTimer();
    turn.finishTurn();
    await letPromisesSettle();

    // Assert: the first wait was 7 s, the second 3 s.
    expect(timers.bookedDelays, 'each wait must read the hold at the time it is booked').toEqual([
      7000, 3000,
    ]);
  });

  it('runs a single timer even when started twice', () => {
    // Arrange: a turner on hand-driven timers.
    const timers = createHandDrivenTimers();
    const turner = createPageTurner({
      onTurn: () => Promise.resolve(),
      readHoldMs: () => 7000,
      setTimer: timers.setTimer,
      clearTimer: timers.clearTimer,
    });

    // Act: start it twice (play pressed twice).
    turner.start();
    turner.start();

    // Assert: one pending hold, not two.
    expect(timers.pendingCallbacks.size, 'a second start must not book a second hold').toBe(1);
  });

  it('cancels the pending hold when stopped and never asks for a turn afterwards', () => {
    // Arrange: a running turner with one hold pending.
    const timers = createHandDrivenTimers();
    let turnCount = 0;
    const turner = createPageTurner({
      onTurn: () => {
        turnCount += 1;
        return Promise.resolve();
      },
      readHoldMs: () => 7000,
      setTimer: timers.setTimer,
      clearTimer: timers.clearTimer,
    });
    turner.start();
    const pendingTimerId = [...timers.pendingCallbacks.keys()][0];

    // Act: stop it, then let timers keep firing.
    turner.stop();
    timers.fireNextTimer();
    timers.fireNextTimer();

    // Assert: the pending hold was cancelled and no turn was asked.
    expect(timers.cancelledTimerIds, 'stop must cancel the hold that was pending').toEqual([
      pendingTimerId,
    ]);
    expect(turnCount, 'no turn may be asked after stop').toBe(0);
  });

  it('books no further hold when stopped in the middle of a turn', async () => {
    // Arrange: a turner whose turn is in progress.
    const timers = createHandDrivenTimers();
    const turn = createTurnFinishedByHand();
    const turner = createPageTurner({
      onTurn: turn.onTurn,
      readHoldMs: () => 7000,
      setTimer: timers.setTimer,
      clearTimer: timers.clearTimer,
    });
    turner.start();
    timers.fireNextTimer();

    // Act: stop during the turn, then let the turn finish.
    turner.stop();
    turn.finishTurn();
    await letPromisesSettle();

    // Assert: no hold was booked after the turn.
    expect(timers.pendingCallbacks.size, 'a turner stopped mid-turn must not hold again').toBe(0);
  });

  it('books the next hold even when a turn fails', async () => {
    // Arrange: a turner whose every turn rejects (a timeline that could not be built).
    const timers = createHandDrivenTimers();
    const turner = createPageTurner({
      onTurn: () => Promise.reject(new Error('a timeline that could not be built')),
      readHoldMs: () => 7000,
      setTimer: timers.setTimer,
      clearTimer: timers.clearTimer,
    });

    // Act: start it and let the hold pass, so the failing turn is asked and settles.
    turner.start();
    timers.fireNextTimer();
    await letPromisesSettle();

    // Assert: the failure was swallowed and the next hold was booked all the same.
    expect(
      timers.pendingCallbacks.size,
      'a failed turn must not stop the pages: the next hold must be booked',
    ).toBe(1);
    expect(
      timers.bookedDelays,
      'two holds were booked, one before and one after the failed turn',
    ).toEqual([7000, 7000]);
  });
});
