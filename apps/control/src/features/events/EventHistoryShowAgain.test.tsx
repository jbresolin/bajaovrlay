/**
 * "Mostrar de novo" in the history, and a general notice read as one (apps/control)
 *
 * What this module is for:
 *   The commentators may want to come back to a penalty shown ten minutes ago
 *   (BAJAOVRLAY-67). The history of the "Eventos" page offers "Mostrar de novo" on an event
 *   already shown, or expired, beside "Restaurar" on a dismissed one; both send
 *   restoreEvent, and the event then waits for "No ar" again. Showing something again is a
 *   decision about the air: Dados, who may restore a discarded Super Chat, sees "Mostrar de
 *   novo" greyed out, never hidden. A notice typed with "Sem equipe (aviso geral)" is about
 *   no car: it reads "Aviso geral" where another event reads its car.
 *
 * What these tests prove:
 *   - A shown event and an expired one offer "Mostrar de novo", which sends restoreEvent;
 *     a dismissed one keeps "Restaurar"; one still waiting offers neither.
 *   - For Dados, "Mostrar de novo" on a shown Super Chat is greyed out, saying why.
 *   - A general notice reads "Aviso geral" in the history's car column and in the waiting
 *     list.
 *
 * What these tests deliberately do not cover:
 *   - Where the restored event lands, and who may restore what; the server's
 *     showEventAgainOnTheStore.test.ts.
 *   - "Restaurar" by role; RestoreOfASuperChatByDados.test.tsx.
 */
import type { InboxEvent, SessionAnswer } from '@bajaovrlay/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import {
  buildFinishedLeaderChangeOfCar52,
  buildPendingPenaltyOfCar47,
  buildShownManualNoticeOfCar12,
  buildSlicesWithTheInbox,
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

const dataRoleAtMesa2: SessionAnswer = {
  isLoginRequired: true,
  session: { role: 'dados', station: 'Mesa 2', expiresAt: '2027-08-15T07:00:00.000Z' },
};

/** A notice typed with "Sem equipe (aviso geral)" 4 minutes ago, still waiting. */
function buildWaitingGeneralNotice(): InboxEvent {
  const detectedAtMs = nowInTheInboxTests.getTime() - 4 * 60_000;
  return {
    eventId: 'manual:aviso-largada-adiada',
    kind: 'manual',
    sourceId: null,
    detectedAtMs,
    payload: { noticeKind: 'notice', reason: 'Largada adiada em 15 minutos' },
    status: 'pending',
    statusChanges: [{ status: 'pending', atMs: detectedAtMs }],
  };
}

/** The event as it is after "No ar" and its time on air. */
function shownAMinuteLater(event: InboxEvent): InboxEvent {
  return {
    ...event,
    status: 'shown',
    statusChanges: [
      ...event.statusChanges,
      { status: 'onAir', atMs: event.detectedAtMs + 50_000 },
      { status: 'shown', atMs: event.detectedAtMs + 60_000 },
    ],
  };
}

/** The "Eventos" page at 14:10 with the events given, as the Produtor (login off). */
function renderTheReviewPageWith(events: InboxEvent[]) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(nowInTheInboxTests);
  return renderOnControlPageConnectedToFakeServer(
    <EventReviewPage />,
    buildSlicesWithTheInbox(events),
  );
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

/** The names of the buttons of one history row. */
function readButtonsOfRow(rowText: string): string[] {
  return within(findHistoryRowHolding(rowText))
    .queryAllByRole('button')
    .map((button) => button.textContent);
}

describe('the buttons of a history row, by status', () => {
  const statusScenarios = [
    // The reason for the feature: an event already shown comes back.
    {
      name: 'offers "Mostrar de novo" on a shown event',
      event: buildShownManualNoticeOfCar12(20),
      rowText: 'Troca de piloto no box',
      expectedButtons: ['Mostrar de novo'],
    },
    // One nobody showed in time can be shown later, on purpose.
    {
      name: 'offers "Mostrar de novo" on an expired event',
      event: buildFinishedLeaderChangeOfCar52(15, 'expired'),
      rowText: 'Pequi Off-Road',
      expectedButtons: ['Mostrar de novo'],
    },
    // As before: a dismissal is undone with "Restaurar".
    {
      name: 'keeps "Restaurar" on a dismissed event',
      event: buildFinishedLeaderChangeOfCar52(15, 'dismissed'),
      rowText: 'Pequi Off-Road',
      expectedButtons: ['Restaurar'],
    },
    // Still waiting: there is nothing to bring back.
    {
      name: 'offers neither on an event still waiting',
      event: buildPendingPenaltyOfCar47(5),
      rowText: 'Queima de largada',
      expectedButtons: [],
    },
  ];

  it.each(statusScenarios)('$name', ({ event, rowText, expectedButtons }) => {
    // Arrange: the page with this row's event.
    renderTheReviewPageWith([event]);

    // Act: read the buttons of its history row.
    const buttons = readButtonsOfRow(rowText);

    // Assert: the buttons this status calls for.
    expect(buttons, 'the row offers what its status allows').toEqual(expectedButtons);
  });

  it('sends restoreEvent when "Mostrar de novo" is pressed', async () => {
    // Arrange: the page with car 12's notice, shown 20 minutes ago.
    const shownNotice = buildShownManualNoticeOfCar12(20);
    const { fakeServer } = renderTheReviewPageWith([shownNotice]);

    // Act: press "Mostrar de novo" on its row.
    fireEvent.click(
      within(findHistoryRowHolding('Troca de piloto no box')).getByRole('button', {
        name: 'Mostrar de novo',
      }),
    );

    // Assert: one restoreEvent naming it.
    await waitFor(() => {
      expect(fakeServer.listCommandsReceived(), 'the notice is brought back').toEqual([
        { type: 'restoreEvent', eventId: shownNotice.eventId },
      ]);
    });
  });
});

describe('"Mostrar de novo" for Dados', () => {
  it('is greyed out on a shown Super Chat, saying why', async () => {
    // Arrange: Dados on the page, Torcida Carnaúba's approved Super Chat shown since.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(nowInTheInboxTests);
    renderOnControlPageConnectedToFakeServer(
      <EventReviewPage />,
      buildSlicesWithTheInboxAndTheSuperChatItem([
        shownAMinuteLater(buildApprovedSuperChatOfTorcidaCarnauba(10)),
      ]),
      { sessionAnswer: dataRoleAtMesa2 },
    );

    // Act: find its "Mostrar de novo".
    const showAgainButton = within(findHistoryRowHolding('Torcida Carnaúba')).getByRole('button', {
      name: 'Mostrar de novo',
    });

    // Assert: there, but greyed out, its tooltip saying why when the keyboard reaches it.
    expect((showAgainButton as HTMLButtonElement).disabled, 'showing again is the Produtor’s').toBe(
      true,
    );
    fireEvent.focus(showAgainButton.parentElement ?? showAgainButton);
    const tooltip = await waitFor(() => screen.getByRole('tooltip'));
    expect(tooltip.textContent, 'the tooltip gives the reason').toBe(
      'O papel Dados só traz de volta um Super Chat descartado; mostrar de novo é do Produtor.',
    );
  });
});

describe('a general notice, about no car', () => {
  it('reads "Aviso geral" in the history and in the waiting list', () => {
    // Arrange: the page with a general notice waiting.
    renderTheReviewPageWith([buildWaitingGeneralNotice()]);

    // Act: read its history row and its waiting row.
    const historyRowText = findHistoryRowHolding('Largada adiada em 15 minutos').textContent;
    const waitingList = screen.getByRole('list', { name: 'Eventos esperando' });

    // Assert: "Aviso geral" where a car would be, in both.
    expect(historyRowText, 'the history names it a general notice').toContain('Aviso geral');
    expect(
      within(waitingList).getByText(/Aviso geral/),
      'the waiting row names it a general notice',
    ).toBeInTheDocument();
  });
});
