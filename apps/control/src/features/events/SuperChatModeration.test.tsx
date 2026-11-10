/**
 * Approving viewers' Super Chats on the console and the "Eventos" page (apps/control)
 *
 * What this module is for:
 *   A viewer's paid message on the live chat (BAJAOVRLAY-35) arrives in the event inbox
 *   awaiting approval. Nothing a viewer writes may reach the air before a person approves
 *   it. Dados reads the chat and approves or discards; the Produtor runs the show and puts
 *   the approved ones on air. Both are drawn by the waiting list the "Eventos" tab and the
 *   "Eventos" page share.
 *
 * What these tests prove:
 *   - Which buttons each role sees on a Super Chat, by status, in one table: awaiting
 *     approval, "Aprovar" and "Descartar" and nothing that could put it on air; approved,
 *     "Prévia", "No ar" and "Descartar". Dados's "Prévia" and "No ar" are greyed out
 *     (never hidden); Dados's "Aprovar" and "Descartar" work.
 *   - Dados's "Descartar" on a race event is greyed out, saying Dados dismisses only
 *     Super Chats; the Produtor's is not.
 *   - A Super Chat awaiting approval reads its viewer, amount, whole message and age; one
 *     paid without a message says "Sem mensagem".
 *   - "Aprovar" sends approveEvent; "No ar" on an approved one sends showEvent.
 *   - On the Produtor's console tab the ones awaiting approval are a hint, "2 aguardando
 *     aprovação", that opens them; on Dados's tab and on the page they are open.
 *   - The tab's badge counts the approved Super Chats, which wait for the Produtor.
 *
 * What these tests deliberately do not cover:
 *   - What the server allows or refuses (who approves, a pending one refused on air); the
 *     server's moderation tests.
 *   - The race events' rows; EventsTab.test.tsx.
 */
import type { InboxEvent, SessionAnswer } from '@bajaovrlay/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { QuickFireStrip } from '@/features/quickFire/QuickFireStrip';
import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import {
  buildPendingPenaltyOfCar47,
  nowInTheInboxTests,
} from '@/state/eventsLikeTheServerSends.testSupport';
import {
  buildApprovedSuperChatOfTorcidaCarnauba,
  buildSlicesWithTheInboxAndTheSuperChatItem,
  buildSuperChatOfTorcidaPequiAwaitingApproval,
  buildSuperChatWithoutAMessageAwaitingApproval,
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

/** The "Eventos" page at 14:10, logged in with this role, with these events in the inbox. */
function renderTheReviewPageAs(sessionAnswer: SessionAnswer, events: InboxEvent[]) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(nowInTheInboxTests);
  return renderOnControlPageConnectedToFakeServer(
    <EventReviewPage />,
    buildSlicesWithTheInboxAndTheSuperChatItem(events),
    { sessionAnswer },
  );
}

/** The console's strip at 14:10, logged in with this role, showing the "Eventos" tab. */
function renderTheEventsTabAs(sessionAnswer: SessionAnswer, events: InboxEvent[]) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(nowInTheInboxTests);
  const controlPage = renderOnControlPageConnectedToFakeServer(
    <QuickFireStrip />,
    buildSlicesWithTheInboxAndTheSuperChatItem(events),
    { sessionAnswer },
  );
  fireEvent.click(screen.getByRole('tab', { name: /^Eventos/ }));
  return controlPage;
}

/** The row of the Super Chat of this viewer, in whichever list it is. */
function findRowOfViewer(authorName: string) {
  const row = screen.getByText(authorName).closest('li');
  if (row === null) {
    throw new Error(`no row for ${authorName}`);
  }
  return within(row);
}

/** Each of the four buttons on a row: missing, greyed out, or ready to press. */
function readButtonsOfRow(row: ReturnType<typeof findRowOfViewer>) {
  const answerFor = (buttonName: string) => {
    const button = row.queryByRole('button', { name: buttonName });
    if (button === null) {
      return 'missing';
    }
    return (button as HTMLButtonElement).disabled ? 'greyed' : 'ready';
  };
  return {
    approve: answerFor('Aprovar'),
    preview: answerFor('Prévia'),
    show: answerFor('No ar'),
    dismiss: answerFor('Descartar'),
  };
}

const buttonScenarios = [
  // Dados's job: read and approve. Nothing on a pending one can put it on air.
  {
    name: 'Dados, awaiting approval: "Aprovar" and "Descartar" only',
    sessionAnswer: dataRoleAtMesa2,
    superChat: buildSuperChatOfTorcidaPequiAwaitingApproval(2),
    authorName: 'Torcida Pequi Off-Road',
    expected: { approve: 'ready', preview: 'missing', show: 'missing', dismiss: 'ready' },
  },
  // An approved one is the Produtor's to air; Dados sees the buttons greyed, may still discard.
  {
    name: 'Dados, approved: "Prévia" and "No ar" greyed, "Descartar" ready',
    sessionAnswer: dataRoleAtMesa2,
    superChat: buildApprovedSuperChatOfTorcidaCarnauba(4),
    authorName: 'Torcida Carnaúba Baja',
    expected: { approve: 'missing', preview: 'greyed', show: 'greyed', dismiss: 'ready' },
  },
  // The Produtor working alone approves too; still nothing that airs it before approval.
  {
    name: 'Produtor, awaiting approval: "Aprovar" and "Descartar" only',
    sessionAnswer: producerAtMesa1,
    superChat: buildSuperChatOfTorcidaPequiAwaitingApproval(2),
    authorName: 'Torcida Pequi Off-Road',
    expected: { approve: 'ready', preview: 'missing', show: 'missing', dismiss: 'ready' },
  },
  // Approved: the Produtor previews and puts it on air like any other event.
  {
    name: 'Produtor, approved: "Prévia", "No ar" and "Descartar"',
    sessionAnswer: producerAtMesa1,
    superChat: buildApprovedSuperChatOfTorcidaCarnauba(4),
    authorName: 'Torcida Carnaúba Baja',
    expected: { approve: 'missing', preview: 'ready', show: 'ready', dismiss: 'ready' },
  },
];

describe('the buttons on a Super Chat, by role and status', () => {
  it.each(buttonScenarios)('$name', ({ sessionAnswer, superChat, authorName, expected }) => {
    // Arrange: the "Eventos" page, logged in with this role, with this Super Chat.
    renderTheReviewPageAs(sessionAnswer, [superChat]);

    // Act: read the buttons of its row.
    const buttons = readButtonsOfRow(findRowOfViewer(authorName));

    // Assert: exactly the buttons this role may press on this status.
    expect(buttons, 'the buttons of the Super Chat for this role and status').toEqual(expected);
  });
});

describe('"Descartar" on a race event', () => {
  const dismissScenarios = [
    // Dados may dismiss a Super Chat and nothing else (BAJAOVRLAY-35).
    { name: 'is greyed out for Dados', sessionAnswer: dataRoleAtMesa2, isGreyed: true },
    // The Produtor triages the race events.
    { name: 'is ready for the Produtor', sessionAnswer: producerAtMesa1, isGreyed: false },
  ];

  it.each(dismissScenarios)('$name', ({ sessionAnswer, isGreyed }) => {
    // Arrange: the page with car 47's penalty waiting.
    renderTheReviewPageAs(sessionAnswer, [buildPendingPenaltyOfCar47(5)]);

    // Act: find its "Descartar".
    const waitingList = within(screen.getByRole('list', { name: 'Eventos esperando' }));
    const dismissButton = waitingList.getByRole('button', { name: 'Descartar' });

    // Assert: greyed out for Dados only.
    expect(
      (dismissButton as HTMLButtonElement).disabled,
      'only the Produtor dismisses a race event',
    ).toBe(isGreyed);
  });
});

describe('a Super Chat awaiting approval', () => {
  it('reads its viewer, amount, whole message and age', () => {
    // Arrange: Torcida Pequi's message, 2 min ago, on Dados's page.
    renderTheReviewPageAs(dataRoleAtMesa2, [buildSuperChatOfTorcidaPequiAwaitingApproval(2)]);

    // Act: read the list of those awaiting approval.
    const awaitingList = within(
      screen.getByRole('list', { name: 'Super Chats aguardando aprovação' }),
    );

    // Assert: everything whoever approves must read, nothing cut.
    expect(awaitingList.getByText('R$ 20,00'), 'the amount').toBeInTheDocument();
    expect(awaitingList.getByText('Torcida Pequi Off-Road'), 'the viewer').toBeInTheDocument();
    expect(
      awaitingList.getByText('Vai, Pequi! Abraço de Goiânia'),
      'the whole message',
    ).toBeInTheDocument();
    expect(awaitingList.getByText('há 2 min'), 'how long ago').toBeInTheDocument();
  });

  it('says "Sem mensagem" when the viewer wrote none', () => {
    // Arrange: Ana do Paddock's R$ 5,00 with no message.
    renderTheReviewPageAs(dataRoleAtMesa2, [buildSuperChatWithoutAMessageAwaitingApproval(1)]);

    // Act: find her row.
    const row = findRowOfViewer('Ana do Paddock');

    // Assert: the row says there is no message instead of an empty line.
    expect(row.getByText('Sem mensagem'), 'an empty message must be said').toBeInTheDocument();
  });
});

describe('what the buttons send', () => {
  it('"Aprovar" sends approveEvent', async () => {
    // Arrange: Dados's page with Torcida Pequi's message awaiting approval.
    const { fakeServer } = renderTheReviewPageAs(dataRoleAtMesa2, [
      buildSuperChatOfTorcidaPequiAwaitingApproval(2),
    ]);

    // Act: press "Aprovar".
    fireEvent.click(
      findRowOfViewer('Torcida Pequi Off-Road').getByRole('button', { name: 'Aprovar' }),
    );

    // Assert: the approval of that Super Chat.
    await waitFor(() => {
      expect(fakeServer.listCommandsReceived(), 'the approval must be sent').toEqual([
        { type: 'approveEvent', eventId: 'youtube-ao-vivo:superChat:mensagem-pequi-0001' },
      ]);
    });
  });

  it('"No ar" on an approved one sends showEvent', async () => {
    // Arrange: the Produtor's page with Torcida Carnaúba's approved message.
    const { fakeServer } = renderTheReviewPageAs(producerAtMesa1, [
      buildApprovedSuperChatOfTorcidaCarnauba(4),
    ]);

    // Act: press "No ar".
    fireEvent.click(
      findRowOfViewer('Torcida Carnaúba Baja').getByRole('button', { name: 'No ar' }),
    );

    // Assert: the event shown.
    await waitFor(() => {
      expect(fakeServer.listCommandsReceived(), '"No ar" must show the event').toEqual([
        { type: 'showEvent', eventId: 'youtube-ao-vivo:superChat:mensagem-carnauba-0003' },
      ]);
    });
  });
});

describe('the Super Chats awaiting approval on the console tab', () => {
  it('are a hint on the Produtor’s tab, which opens them', () => {
    // Arrange: the Produtor's tab with two Super Chats awaiting approval.
    renderTheEventsTabAs(producerAtMesa1, [
      buildSuperChatOfTorcidaPequiAwaitingApproval(2),
      buildSuperChatWithoutAMessageAwaitingApproval(1),
    ]);
    const hint = screen.getByRole('button', { name: '2 aguardando aprovação' });
    const wasClosedAtFirst = screen.queryByRole('list', {
      name: 'Super Chats aguardando aprovação',
    });

    // Act: press the hint.
    fireEvent.click(hint);

    // Assert: closed at first, open after the press.
    expect(wasClosedAtFirst, 'the Produtor’s tab must start with the hint alone').toBeNull();
    expect(
      screen.getByRole('list', { name: 'Super Chats aguardando aprovação' }),
      'the hint must open the list',
    ).toBeInTheDocument();
  });

  it('are open on Dados’s tab', () => {
    // Arrange: nothing beyond the drawing.

    // Act: Dados's tab with one Super Chat awaiting approval.
    renderTheEventsTabAs(dataRoleAtMesa2, [buildSuperChatOfTorcidaPequiAwaitingApproval(2)]);

    // Assert: the hint and the list, open.
    expect(
      screen.getByRole('button', { name: '1 aguardando aprovação' }),
      'the hint is there for Dados too',
    ).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByRole('list', { name: 'Super Chats aguardando aprovação' }),
      'Dados reads them at once',
    ).toBeInTheDocument();
  });

  it('counts an approved Super Chat on the tab’s badge, which waits for the Produtor', () => {
    // Arrange: nothing beyond the drawing.

    // Act: the Produtor's strip with one approved Super Chat and nothing else.
    renderTheEventsTabAs(producerAtMesa1, [buildApprovedSuperChatOfTorcidaCarnauba(4)]);

    // Assert: the badge counts it.
    expect(
      screen.getByRole('tab', { name: /^Eventos/ }),
      'an approved Super Chat waits for the Produtor',
    ).toHaveAccessibleName(/1 evento esperando/);
  });
});
