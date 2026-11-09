/**
 * Dados restores any discarded Super Chat, and no race event (apps/control)
 *
 * What this module is for:
 *   Dados moderates the viewers' Super Chats (BAJAOVRLAY-35). João's ruling at gate 2 of
 *   PR #54: Dados may restore any discarded Super Chat, whoever discarded it. Restoring only
 *   returns it to pending, where it still needs approval, and changes nothing on air, so it
 *   is moderation; a race event stays the Produtor's. The "Eventos" page's history offers "Restaurar" on every discarded event.
 *
 * What these tests prove, one row each:
 *   - Dados's "Restaurar" on a discarded Super Chat is ready, and sends restoreEvent.
 *   - Dados's "Restaurar" on a discarded penalty is greyed out, never hidden.
 *   - The Produtor's "Restaurar" on a discarded penalty is ready.
 *
 * What these tests deliberately do not cover:
 *   - What the server allows (the same rule, held against the events slice); the server's
 *     superChatModerationOnTheStore.test.ts.
 *   - The console's "Desfazer" line, which uses the same rule (whyTheDataRoleMayNotTriage.ts).
 */
import type { InboxEvent, SessionAnswer } from '@bajaovrlay/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import {
  buildPendingPenaltyOfCar47,
  nowInTheInboxTests,
} from '@/state/eventsLikeTheServerSends.testSupport';
import {
  buildSlicesWithTheInboxAndTheSuperChatItem,
  buildSuperChatOfTorcidaPequiAwaitingApproval,
} from '@/state/superChatsLikeTheServerSends.testSupport';

import { EventReviewPage } from './EventReviewPage';

afterEach(() => {
  vi.useRealTimers();
});

const dataRoleAtMesa2: SessionAnswer = {
  isLoginRequired: true,
  session: { role: 'dados', station: 'Mesa 2', expiresAt: '2027-08-15T07:00:00.000Z' },
};
const producerAtMesa1: SessionAnswer = {
  isLoginRequired: true,
  session: { role: 'produtor', station: 'Mesa 1', expiresAt: '2027-08-15T07:00:00.000Z' },
};

/** The event discarded a minute after it arrived. */
function discardedAMinuteLater(event: InboxEvent): InboxEvent {
  const dismissedAtMs = event.detectedAtMs + 60_000;
  return {
    ...event,
    status: 'dismissed',
    statusChanges: [...event.statusChanges, { status: 'dismissed', atMs: dismissedAtMs }],
  };
}

/** The history row whose text holds this name. */
function findHistoryRowHolding(text: string): HTMLElement {
  const historyTable = screen.getByRole('table', { name: 'Histórico de eventos' });
  const row = within(historyTable)
    .getAllByRole('row')
    .find((candidate) => candidate.textContent.includes(text));
  if (row === undefined) {
    throw new Error(`no history row holding ${text}`);
  }
  return row;
}

const restoreScenarios = [
  // Dados's own moderation, undone: the Super Chat waits again.
  {
    name: 'is ready for Dados on a discarded Super Chat',
    sessionAnswer: dataRoleAtMesa2,
    rowText: 'Torcida Pequi Off-Road',
    isGreyed: false,
  },
  // A race event stays the Produtor's to restore.
  {
    name: 'is greyed out for Dados on a discarded penalty',
    sessionAnswer: dataRoleAtMesa2,
    rowText: 'Carnaúba Baja',
    isGreyed: true,
  },
  // The Produtor restores anything.
  {
    name: 'is ready for the Produtor on a discarded penalty',
    sessionAnswer: producerAtMesa1,
    rowText: 'Carnaúba Baja',
    isGreyed: false,
  },
];

describe('"Restaurar" in the history', () => {
  it.each(restoreScenarios)('$name', ({ sessionAnswer, rowText, isGreyed }) => {
    // Arrange: the "Eventos" page with Torcida Pequi's Super Chat and car 47's penalty both
    // discarded, logged in with the row's role.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(nowInTheInboxTests);
    const events = [
      discardedAMinuteLater(buildSuperChatOfTorcidaPequiAwaitingApproval(10)),
      discardedAMinuteLater(buildPendingPenaltyOfCar47(10)),
    ];
    renderOnControlPageConnectedToFakeServer(
      <EventReviewPage />,
      buildSlicesWithTheInboxAndTheSuperChatItem(events),
      { sessionAnswer },
    );

    // Act: find the row's "Restaurar".
    const restoreButton = within(findHistoryRowHolding(rowText)).getByRole('button', {
      name: 'Restaurar',
    });

    // Assert: greyed out only for Dados on a race event.
    expect(
      (restoreButton as HTMLButtonElement).disabled,
      'Dados restores Super Chats only; the Produtor restores anything',
    ).toBe(isGreyed);
  });

  it('sends restoreEvent when Dados restores a Super Chat', async () => {
    // Arrange: Dados on the page, Torcida Pequi's Super Chat discarded.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(nowInTheInboxTests);
    const superChat = discardedAMinuteLater(buildSuperChatOfTorcidaPequiAwaitingApproval(10));
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(
      <EventReviewPage />,
      buildSlicesWithTheInboxAndTheSuperChatItem([superChat]),
      { sessionAnswer: dataRoleAtMesa2 },
    );

    // Act: press "Restaurar".
    fireEvent.click(
      within(findHistoryRowHolding('Torcida Pequi Off-Road')).getByRole('button', {
        name: 'Restaurar',
      }),
    );

    // Assert: the restore command for that Super Chat went to the server.
    await waitFor(() => {
      expect(fakeServer.listCommandsReceived(), 'one restoreEvent for the Super Chat').toEqual([
        { type: 'restoreEvent', eventId: superChat.eventId },
      ]);
    });
  });
});
