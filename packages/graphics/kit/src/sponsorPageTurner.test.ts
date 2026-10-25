/**
 * The page timer of a sponsor round (packages/graphics/kit)
 *
 * What this module is for:
 *   The sponsor roll (its full screen and its corner card) and the intermission's sponsor
 *   line turn through the round on air, each page (or, in the corner, each sponsor) held
 *   by its own level's hold (BAJAOVRLAY-46: 8 s for Diamante, 5 s for Ouro…). The kit's
 *   pageTurner does the holding and turning; this wires its hold to the level of the page
 *   on air, read anew before every wait, so a Diamante page is held longer than the Ouro
 *   page after it.
 *
 * What these tests prove (hand-driven timers, Ardósia's sponsor holds on the page):
 *   - On a Diamante page the first wait is 8 s; once turned to an Ouro page, the next is 5 s.
 *   - Stopped, the pending wait is cancelled and no turn comes.
 *
 * What these tests deliberately do not cover:
 *   - The holds per level; sponsorRound.test.ts. The turner's own rules; pageTurner.test.ts.
 */
import { describe, expect, it, onTestFinished } from 'vitest';

import { createSponsorPageTurner } from './sponsorPageTurner.js';
import type { SponsorLevel } from './sponsorRound.js';

/** A graphic's element with Ardósia's sponsor holds on it. */
function createElementWithTheSponsorHolds(): HTMLElement {
  const element = document.createElement('section');
  element.style.setProperty('--motion-sponsor-hold', '5000ms');
  element.style.setProperty('--motion-sponsor-hold-diamante', '8000ms');
  element.style.setProperty('--motion-sponsor-hold-ouro', '5000ms');
  document.body.append(element);
  onTestFinished(() => element.remove());
  return element;
}

/** Timers that run only when the test says, remembering each wait's length. */
function createHandDrivenTimers() {
  const pending = new Map<number, () => void>();
  const delaysMs: number[] = [];
  const cancelledIds: number[] = [];
  let lastId = 0;
  return {
    delaysMs,
    cancelledIds,
    pending,
    setTimer(callback: () => void, delayMs: number): number {
      lastId += 1;
      pending.set(lastId, callback);
      delaysMs.push(delayMs);
      return lastId;
    },
    clearTimer(timerId: number): void {
      cancelledIds.push(timerId);
      pending.delete(timerId);
    },
    runTheWait(): void {
      const [timerId, callback] = [...pending.entries()][0] ?? [];
      if (timerId === undefined || callback === undefined) {
        throw new Error('no wait is pending');
      }
      pending.delete(timerId);
      callback();
    },
  };
}

/** Lets the turn's promise and the next booking run. */
function letThePageCatchUp(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('createSponsorPageTurner', () => {
  it('holds a Diamante page 8 s, then the Ouro page after it 5 s', async () => {
    // Arrange: the round on its Diamante page; a turn moves it to Ouro.
    const element = createElementWithTheSponsorHolds();
    const timers = createHandDrivenTimers();
    const round = { levelOnAir: 'diamante' as SponsorLevel };
    const turner = createSponsorPageTurner({
      tokensSource: element,
      readLevelOnAir: () => round.levelOnAir,
      onTurn: () => {
        round.levelOnAir = 'ouro';
        return Promise.resolve();
      },
      setTimer: timers.setTimer,
      clearTimer: timers.clearTimer,
    });

    // Act: start it, let the first hold pass.
    turner.start();
    timers.runTheWait();
    await letThePageCatchUp();

    // Assert: 8 s on Diamante, then 5 s booked for Ouro.
    expect(timers.delaysMs, 'each page held by its own level').toEqual([8000, 5000]);
    turner.stop();
  });

  it('cancels the pending wait when stopped', () => {
    // Arrange: the round started on its Diamante page.
    const element = createElementWithTheSponsorHolds();
    const timers = createHandDrivenTimers();
    const turner = createSponsorPageTurner({
      tokensSource: element,
      readLevelOnAir: () => 'diamante',
      onTurn: () => Promise.resolve(),
      setTimer: timers.setTimer,
      clearTimer: timers.clearTimer,
    });
    turner.start();

    // Act: stop it.
    turner.stop();

    // Assert: the wait cancelled, none left.
    expect(timers.cancelledIds, 'the hold is cancelled').toEqual([1]);
    expect(timers.pending.size, 'no turn will come').toBe(0);
  });
});
