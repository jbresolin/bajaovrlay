/**
 * How long a restored event has been waiting, on its row (apps/control)
 *
 * What this module is for:
 *   A row of the waiting list says when its event came: the time of day it was detected
 *   and how long ago ("há 5 min"). An event brought back with "Restaurar" or "Mostrar de
 *   novo" (BAJAOVRLAY-67) waits again from that moment, and the server measures its
 *   maximum wait from the latest restore. Its row says so: "trazido de volta há 3 min",
 *   counted from the restore, not "há 20 min" from a detection the operator dealt with
 *   long ago (gate 2 of PR #58).
 *
 * What these tests prove, one row per kind of waiting row:
 *   - An event never restored reads its age from its detection, as before.
 *   - A penalty brought back reads "trazido de volta há …" from its latest restore.
 *   - A Super Chat brought back (its own kind of row) reads the same.
 *
 * What these tests deliberately do not cover:
 *   - That the server records the restore and measures the wait from it; the server's
 *     showEventAgainOnTheStore.test.ts.
 */
import type { InboxEvent } from '@bajaovrlay/shared';
import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import {
  buildPendingPenaltyOfCar47,
  nowInTheInboxTests,
} from '@/state/eventsLikeTheServerSends.testSupport';
import {
  buildApprovedSuperChatOfTorcidaCarnauba,
  buildSlicesWithTheInboxAndTheSuperChatItem,
} from '@/state/superChatsLikeTheServerSends.testSupport';

import { EventReviewPage } from './EventReviewPage';

afterEach(() => {
  vi.useRealTimers();
});

/** The event as it is after being brought back this many minutes ago (and once before). */
function broughtBackMinutesAgo(event: InboxEvent, minutesAgo: number): InboxEvent {
  const restoredAtMs = nowInTheInboxTests.getTime() - minutesAgo * 60_000;
  const firstRestoreAtMs = restoredAtMs - 4 * 60_000;
  return {
    ...event,
    restoresAtMs: [firstRestoreAtMs, restoredAtMs],
    statusChanges: [...event.statusChanges, { status: event.status, atMs: restoredAtMs }],
  };
}

const waitingRowScenarios: Array<{
  name: string;
  event: InboxEvent;
  rowText: string;
  expectedAge: string;
  unexpectedAge: string;
}> = [
  // As before: an event never brought back reads its age from its detection.
  {
    name: 'reads a penalty never restored from its detection',
    event: buildPendingPenaltyOfCar47(20),
    rowText: 'Queima de largada',
    expectedAge: 'há 20 min',
    unexpectedAge: 'trazido de volta',
  },
  // The reason for the change: brought back 3 min ago, it has waited 3 min, not 20.
  {
    name: 'reads a penalty brought back from its latest restore',
    event: broughtBackMinutesAgo(buildPendingPenaltyOfCar47(20), 3),
    rowText: 'Queima de largada',
    expectedAge: 'trazido de volta há 3 min',
    unexpectedAge: 'há 20 min',
  },
  // A Super Chat waits in a row of its own, which says the same.
  {
    name: 'reads a Super Chat brought back from its latest restore',
    event: broughtBackMinutesAgo(buildApprovedSuperChatOfTorcidaCarnauba(30), 2),
    rowText: 'Torcida Carnaúba Baja',
    expectedAge: 'trazido de volta há 2 min',
    unexpectedAge: 'há 30 min',
  },
];

describe('the age on a waiting row', () => {
  it.each(waitingRowScenarios)('$name', ({ event, rowText, expectedAge, unexpectedAge }) => {
    // Arrange: the "Eventos" page at 14:10 with this event waiting.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(nowInTheInboxTests);
    renderOnControlPageConnectedToFakeServer(
      <EventReviewPage />,
      buildSlicesWithTheInboxAndTheSuperChatItem([event]),
    );

    // Act: read the event's row in the waiting list.
    const waitingList = screen.getByRole('list', { name: 'Eventos esperando' });
    const textOfTheRow =
      within(waitingList)
        .getAllByRole('listitem')
        .find((row) => row.textContent.includes(rowText))?.textContent ?? '';

    // Assert: the age counted from the right moment, and not the other.
    expect(textOfTheRow, 'the row must say how long the event has waited').toContain(expectedAge);
    expect(textOfTheRow, 'the row must not count from the other moment').not.toContain(
      unexpectedAge,
    );
  });
});
