/**
 * The sessions board's one status-check timer (packages/graphics/sessions-board)
 *
 * What this module is for:
 *   sessionsBoardStatusChecks.ts books the timer that re-checks the slots' statuses at the
 *   next start or end of any slot. A board runs all day in OBS, so a timer orphaned by an
 *   update, or one that fires at once, would keep re-drawing the board for nothing.
 *
 * What these tests prove (Date and the timers faked, Brasília's clock):
 *   - Two updates on air leave exactly one check booked: each booking cancels the one
 *     before it (this fails if bookTheNextStatusCheck stops cancelling first).
 *   - A slot 30 days ahead (a year typed wrong in Cadastros) books one check at most an
 *     hour away, not a wait a browser would run at once; when the hour passes the check
 *     finds nothing changed and books the next hour.
 *
 * What these tests deliberately do not cover:
 *   - The crossfade at a boundary and the cancel on stop, dispose and removal;
 *     sessions-board.test.ts.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  atSundayBrasiliaTime,
  createSessionsBoardOnThePage,
  createSundaySessionsBoardData,
  loadSessionsBoardWithData,
  readStatusShownOf,
  takeControlOfTimeAndTimers,
} from './sessionsBoardOnThePage.testSupport.js';
import { longestWaitBetweenStatusChecksMs } from './sessionsBoardStatusChecks.js';

afterEach(() => {
  vi.restoreAllMocks();
});

/** One hour, the longest a check may wait. */
const oneHourMs = 3_600_000;

describe('the one status check', () => {
  it('leaves exactly one check booked after two updates on air', async () => {
    // Arrange: Sunday's board on air at 09:20, its check booked for the enduro's start.
    const timeAndTimers = takeControlOfTimeAndTimers(atSundayBrasiliaTime('09:20'));
    const board = createSessionsBoardOnThePage();
    await loadSessionsBoardWithData(board, createSundaySessionsBoardData());
    await board.playAction({ skipAnimation: true });

    // Act: the schedule is edited twice while the board is on air.
    await board.updateAction({ data: { title: 'PROGRAMAÇÃO DE DOMINGO' } });
    await board.updateAction({ data: { eventLine: '30ª Competição Baja SAE Brasil — final' } });

    // Assert: one check, not one per booking.
    expect(timeAndTimers.countPendingTimers(), 'each booking replaces the one before').toBe(1);
  });

  it('waits at most an hour for a slot 30 days ahead, and books the next hour after', async () => {
    // Arrange: a board whose only slot starts 30 days from Sunday 09:20, watching the
    // delays the board asks for.
    const sundayMorningMs = atSundayBrasiliaTime('09:20');
    const timeAndTimers = takeControlOfTimeAndTimers(sundayMorningMs);
    const askedDelaysMs: number[] = [];
    const realSetTimeout = window.setTimeout;
    vi.spyOn(window, 'setTimeout').mockImplementation(((handler: () => void, delayMs?: number) => {
      askedDelaysMs.push(delayMs ?? 0);
      return realSetTimeout(handler, delayMs);
    }) as typeof window.setTimeout);
    const board = createSessionsBoardOnThePage();
    await loadSessionsBoardWithData(board, {
      ...createSundaySessionsBoardData(),
      slots: [
        {
          slotId: 'enduro',
          sessionName: 'Enduro de Resistência',
          sessionKind: 'enduro',
          startsAtMs: sundayMorningMs + 30 * 24 * oneHourMs,
        },
      ],
    });

    // Act: the board goes on air, then an hour passes.
    await board.playAction({ skipAnimation: true });
    const delaysAtTheTake = [...askedDelaysMs];
    await timeAndTimers.letTimePass(oneHourMs);

    // Assert: one check an hour away at the take; after the hour, still one, again an hour
    // away, and the slot still "a seguir".
    expect(longestWaitBetweenStatusChecksMs, 'the cap is one hour').toBe(oneHourMs);
    expect(delaysAtTheTake, 'one check, an hour away, at the take').toEqual([oneHourMs]);
    expect(askedDelaysMs.at(-1), 'the next check is an hour away too').toBe(oneHourMs);
    expect(timeAndTimers.countPendingTimers(), 'one check pending').toBe(1);
    expect(readStatusShownOf(board, 'Enduro de Resistência'), 'nothing changed').toBe('upcoming');
  });
});
