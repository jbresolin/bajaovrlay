/**
 * A fastest lap held by "Pausar gatilhos", on the "Eventos" tab (apps/control)
 *
 * What this module is for:
 *   While "Pausar gatilhos" is on, nothing goes on air by itself (BAJAOVRLAY-73): an event
 *   whose rule says auto (the fastest lap) waits for the operator instead, pending, as an
 *   event whose rule asks does. The server writes the reason on the event
 *   (`heldByThePause`), and its row in the waiting list says it in words, so the operator
 *   knows why a fastest lap is waiting for "No ar" when it usually goes on by itself.
 *
 * What these tests prove:
 *   - A held fastest lap's row says why it waits: it arrived while paused, or it was in the
 *     queue when the pause began; a fastest lap queued as usual says "na fila" and neither.
 *   - The tab's badge counts a held fastest lap: it waits for the operator.
 *   - "No ar" on a held fastest lap sends showEvent, as on any waiting event.
 *
 * What these tests deliberately do not cover:
 *   - That the server holds it, moves the queued ones at the pause and replays nothing at
 *     the resume; apps/server's pauseHoldsAutomaticEventsOnTheStore.test.ts.
 *   - The header's chip; features/triggers/TriggersPausedChip.test.tsx.
 */
import type { InboxEvent } from '@bajaovrlay/shared';
import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { QuickFireStrip } from '@/features/quickFire/QuickFireStrip';
import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import {
  buildFastestLapOfCar31HeldByThePause,
  buildQueuedFastestLapOfCar31,
  buildSlicesWithTheInbox,
  nowInTheInboxTests,
} from '@/state/eventsLikeTheServerSends.testSupport';

afterEach(() => {
  vi.useRealTimers();
});

/** The strip at 14:10 with these events in the inbox, showing the "Eventos" tab. */
function renderTheEventsTabWith(events: InboxEvent[]) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(nowInTheInboxTests);
  const controlPage = renderOnControlPageConnectedToFakeServer(
    <QuickFireStrip />,
    buildSlicesWithTheInbox(events),
  );
  fireEvent.click(screen.getByRole('tab', { name: /^Eventos/ }));
  return controlPage;
}

/** The text of the one row of the waiting list. */
function readTheOnlyWaitingRow(): HTMLElement {
  const waitingList = screen.getByRole('list', { name: 'Eventos esperando' });
  const [onlyRow] = within(waitingList).getAllByRole('listitem');
  if (onlyRow === undefined) {
    throw new Error('the waiting list has no row');
  }
  return onlyRow;
}

const arrivedWhilePausedText = 'chegou com a automação pausada';
const queuedWhenPausedText = 'estava na fila quando a automação foi pausada';

const heldRowScenarios = [
  // The common case: the fastest lap came during the podium, with the pause on.
  {
    name: 'says a fastest lap arrived with the automation paused',
    event: buildFastestLapOfCar31HeldByThePause(1, 'arrivedWhilePaused'),
    expectedText: arrivedWhilePausedText,
    unexpectedText: queuedWhenPausedText,
    isTheQueueBadgeExpected: false,
  },
  // It was waiting for its layer when the operator paused: the pause moved it.
  {
    name: 'says a fastest lap was in the queue when the automation was paused',
    event: buildFastestLapOfCar31HeldByThePause(2, 'queuedWhenPaused'),
    expectedText: queuedWhenPausedText,
    unexpectedText: arrivedWhilePausedText,
    isTheQueueBadgeExpected: false,
  },
  // Unpaused, nothing changed: the queued fastest lap goes on by itself and says so.
  {
    name: 'says nothing of a pause on a fastest lap queued as usual',
    event: buildQueuedFastestLapOfCar31(1),
    expectedText: 'há 1 min',
    unexpectedText: 'automação pausada',
    isTheQueueBadgeExpected: true,
  },
];

describe('the row of a fastest lap and "Pausar gatilhos"', () => {
  it.each(heldRowScenarios)(
    '$name',
    ({ event, expectedText, unexpectedText, isTheQueueBadgeExpected }) => {
      // Arrange: the "Eventos" tab with this fastest lap waiting.
      renderTheEventsTabWith([event]);

      // Act: read its row, and look for the "na fila" badge on it (that exact word alone).
      const row = readTheOnlyWaitingRow();
      const isTheQueueBadgeThere = within(row).queryByText('na fila') !== null;

      // Assert: the row says why it waits, not the other reason, and "na fila" only when
      // the runner will show it by itself.
      expect(row.textContent, 'the row must say why the fastest lap waits').toContain(expectedText);
      expect(row.textContent, 'the row must not give another reason').not.toContain(unexpectedText);
      expect(isTheQueueBadgeThere, '"na fila" only on an event the runner will show').toBe(
        isTheQueueBadgeExpected,
      );
    },
  );
});

describe('a held fastest lap on the "Eventos" tab', () => {
  it('is counted on the tab badge, since it waits for the operator', () => {
    // Arrange: one fastest lap held by the pause.
    renderTheEventsTabWith([buildFastestLapOfCar31HeldByThePause(1, 'arrivedWhilePaused')]);

    // Act: read the badge on the tab.
    const badge = screen.getByTestId('pending-events-badge');

    // Assert: one event waits for the operator.
    expect(badge.textContent, 'the badge must count the held fastest lap').toBe('1');
  });

  it('goes on air with "No ar", as any waiting event does', () => {
    // Arrange: one fastest lap held by the pause.
    const heldFastestLap = buildFastestLapOfCar31HeldByThePause(1, 'arrivedWhilePaused');
    const { fakeServer } = renderTheEventsTabWith([heldFastestLap]);

    // Act: press "No ar" on its row.
    fireEvent.click(within(readTheOnlyWaitingRow()).getByRole('button', { name: 'No ar' }));

    // Assert: the page asked the server to show it.
    expect(fakeServer.listCommandsReceived(), '"No ar" must send showEvent').toEqual([
      { type: 'showEvent', eventId: heldFastestLap.eventId },
    ]);
  });
});
