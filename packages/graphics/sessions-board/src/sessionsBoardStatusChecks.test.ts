/**
 * The sessions board's one status-check timer (packages/graphics/sessions-board)
 *
 * What this module is for:
 *   sessionsBoardStatusChecks.ts books the timer that re-checks the slots' statuses at the
 *   next start or end of any slot. A board runs all day in OBS, so a timer orphaned by an
 *   update would keep re-drawing the board for nothing.
 *
 * What these tests prove (Date and the timers faked, Brasília's clock):
 *   - Two updates on air leave exactly one check booked: each booking cancels the one
 *     before it (this fails if bookTheNextStatusCheck stops cancelling first).
 *
 * What these tests deliberately do not cover:
 *   - The crossfade at a boundary and the cancel on stop, dispose and removal;
 *     sessions-board.test.ts.
 */
import { describe, expect, it } from 'vitest';

import {
  atSundayBrasiliaTime,
  createSessionsBoardOnThePage,
  createSundaySessionsBoardData,
  loadSessionsBoardWithData,
  takeControlOfTimeAndTimers,
} from './sessionsBoardOnThePage.testSupport.js';

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
});
