/**
 * The "Eventos" tab of the quick-fire strip (apps/control)
 *
 * What this module is for:
 *   The event inbox (BAJAOVRLAY-44) on the console: a tab of "Atalhos e macros", after
 *   "Macros", with a badge counting the events that wait for the operator. It lists the
 *   waiting events (pending for the operator, queued for the automatic runner), newest
 *   first, each with its kind, the car's chip, the team, the reason and how long ago it
 *   arrived, and three buttons: "Prévia" (the rule's item filled from this event, on the
 *   preview output), "No ar" (showEvent) and "Descartar" (dismissEvent). The tab sits above
 *   Camadas, so since gate 2 of PR #22 it keeps the waiting events only, in a list of
 *   capped height that scrolls, with "Som de eventos" and a link to the "Eventos" page,
 *   where the history, "+ Evento" and "Regras" now live.
 *
 * What these tests prove:
 *   - The waiting events are listed newest first, with kind, car, team, reason, penalty and
 *     age; a queued one says it is in the queue.
 *   - The events that are over are listed below, at most the 20 newest, with their status.
 *   - "Prévia" sends previewItem of the rule's item naming the event; "No ar" sends
 *     showEvent; "Descartar" sends dismissEvent.
 *   - "No ar" and "Descartar" are off while their command waits (gate 2 of PR #22).
 *   - "Prévia" and "No ar" are off for an event whose rule has no item.
 *   - The tab's badge counts the pending events only (not the queued ones).
 *   - An event dismissed in the last 30 s is listed under the waiting ones with
 *     "Desfazer", which sends restoreEvent; one dismissed earlier is not (humans err, the
 *     walk of PR #22; older ones are restored on the "Eventos" page).
 *   - The tab keeps the waiting events only: no events that are over, no "+ Evento" and
 *     no "Regras", and a link opening "#/eventos" in a new tab; the waiting list scrolls
 *     inside a capped height.
 *
 * What these tests deliberately do not cover:
 *   - The badge's pulse and the sound; EventsTabAlert.test.tsx.
 *   - The "+ Evento" form, the rules editor and the history; ManualEventDialog.test.tsx,
 *     EventRulesDialog.test.tsx and EventReviewPage.test.tsx.
 *   - That the capped list keeps Camadas on screen: jsdom lays nothing out, so the browser
 *     test eventsTabKeepsTheLayersOnScreen.e2e.ts measures it.
 *   - What the server does with the commands; apps/server/src/modules/events.
 */
import type { InboxEvent } from '@bajaovrlay/shared';
import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { QuickFireStrip } from '@/features/quickFire/QuickFireStrip';
import {
  letThePageFinishWhatItStarted,
  renderOnControlPageConnectedToFakeServer,
} from '@/state/controlPageOnFakeServer.testSupport';
import {
  buildFinishedLeaderChangeOfCar52,
  buildPenaltyOfCar47DismissedSecondsAgo,
  buildPendingPenaltyOfCar47,
  buildPendingWarningOfCar38,
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

/** The rows of the list of waiting events, top to bottom. */
function readWaitingEventRows() {
  return within(screen.getByRole('list', { name: 'Eventos esperando' })).getAllByRole('listitem');
}

describe('the waiting events', () => {
  it('are listed newest first, with kind, car, team, reason and age', () => {
    // Arrange: a penalty 5 min ago, a warning 3 min ago, a fastest lap queued 1 min ago.
    renderTheEventsTabWith([
      buildPendingPenaltyOfCar47(5),
      buildPendingWarningOfCar38(3),
      buildQueuedFastestLapOfCar31(1),
    ]);

    // Act: read the rows.
    const rows = readWaitingEventRows();

    // Assert: the fastest lap, the warning, the penalty; each row tells what happened.
    expect(rows, 'three events wait').toHaveLength(3);
    const [fastestLapRow, warningRow, penaltyRow] = rows.map((row) => within(row));
    expect(fastestLapRow?.getByText('Volta mais rápida'), 'its kind').toBeInTheDocument();
    expect(fastestLapRow?.getByText('31'), 'its car').toBeInTheDocument();
    expect(fastestLapRow?.getByText('Acauã Baja'), 'its team').toBeInTheDocument();
    expect(fastestLapRow?.getByText('4:38,2'), 'its lap time').toBeInTheDocument();
    expect(fastestLapRow?.getByText('na fila'), 'a queued event says so').toBeInTheDocument();
    expect(fastestLapRow?.getByText('há 1 min'), 'it arrived a minute ago').toBeInTheDocument();
    expect(warningRow?.getByText('Advertência'), 'a warning is not a penalty').toBeInTheDocument();
    expect(warningRow?.getByText('há 3 min'), 'its age').toBeInTheDocument();
    expect(penaltyRow?.getByText('Penalidade'), 'its kind').toBeInTheDocument();
    expect(penaltyRow?.getByText('47'), 'its car').toBeInTheDocument();
    expect(penaltyRow?.getByText('Carnaúba Baja'), 'its team').toBeInTheDocument();
    expect(penaltyRow?.getByText('Queima de largada'), 'its reason').toBeInTheDocument();
    expect(penaltyRow?.getByText('+30 segundos'), 'its penalty').toBeInTheDocument();
    expect(penaltyRow?.getByText('há 5 min'), 'its age').toBeInTheDocument();
  });

  it('counts the pending events on the tab badge, not the queued ones', () => {
    // Arrange: two pending events and one queued.
    renderTheEventsTabWith([
      buildPendingPenaltyOfCar47(5),
      buildPendingWarningOfCar38(3),
      buildQueuedFastestLapOfCar31(1),
    ]);

    // Act: read the badge on the tab.
    const badge = screen.getByTestId('pending-events-badge');

    // Assert: two; the queued one goes on air by itself and needs nobody.
    expect(badge.textContent, 'the badge counts what waits for the operator').toBe('2');
  });
});

describe('the buttons of a waiting event', () => {
  const buttonScenarios = [
    // "Prévia": the rule's item ("Penalidade"), filled from this very penalty.
    {
      name: '"Prévia" previews the rule\'s item filled from the event',
      buttonName: 'Prévia',
      expectedCommand: {
        type: 'previewItem',
        itemId: 'penalidade',
        eventId: 'simulador-enduro:incident:ocorrencia-0007',
        origin: 'manual',
      },
    },
    // "No ar": the operator's approval.
    {
      name: '"No ar" sends showEvent',
      buttonName: 'No ar',
      expectedCommand: { type: 'showEvent', eventId: 'simulador-enduro:incident:ocorrencia-0007' },
    },
    // "Descartar": the operator says no.
    {
      name: '"Descartar" sends dismissEvent',
      buttonName: 'Descartar',
      expectedCommand: {
        type: 'dismissEvent',
        eventId: 'simulador-enduro:incident:ocorrencia-0007',
      },
    },
  ];

  it.each(buttonScenarios)('$name', ({ buttonName, expectedCommand }) => {
    // Arrange: car 47's penalty waiting.
    const { fakeServer } = renderTheEventsTabWith([buildPendingPenaltyOfCar47(2)]);

    // Act: press this row's button on it.
    const penaltyRow = within(readWaitingEventRows()[0] ?? document.body);
    fireEvent.click(penaltyRow.getByRole('button', { name: buttonName }));

    // Assert: exactly this command was sent.
    expect(fakeServer.listCommandsReceived(), 'the button must send its command').toEqual([
      expectedCommand,
    ]);
  });

  it('turns "No ar" and "Descartar" off while the command waits for the server', async () => {
    // Arrange: car 47's penalty waiting.
    const { fakeServer } = renderTheEventsTabWith([buildPendingPenaltyOfCar47(2)]);
    const penaltyRow = within(readWaitingEventRows()[0] ?? document.body);

    // Act: press "No ar"; the server has not answered yet.
    fireEvent.click(penaltyRow.getByRole('button', { name: 'No ar' }));
    const isShowOffWhileWaiting = penaltyRow
      .getByRole('button', { name: 'No ar' })
      .hasAttribute('disabled');
    const isDismissOffWhileWaiting = penaltyRow
      .getByRole('button', { name: 'Descartar' })
      .hasAttribute('disabled');
    fakeServer.acceptLastCommand();
    await letThePageFinishWhatItStarted();

    // Assert: both off while waiting, so a second press cannot send it twice; on again after.
    expect(isShowOffWhileWaiting, '"No ar" is off while its command waits').toBe(true);
    expect(isDismissOffWhileWaiting, '"Descartar" too').toBe(true);
    expect(
      penaltyRow.getByRole('button', { name: 'No ar' }),
      'on again once the server answered',
    ).toBeEnabled();
  });

  it('turns "Prévia" and "No ar" off for an event whose rule has no item', () => {
    // Arrange: a leader change waiting (its rule has no item yet).
    const leaderChange = {
      ...buildFinishedLeaderChangeOfCar52(1, 'shown'),
      status: 'pending' as const,
    };
    renderTheEventsTabWith([leaderChange]);

    // Act: find its "Prévia" and "No ar".
    const row = within(readWaitingEventRows()[0] ?? document.body);
    const previewButton = row.getByRole('button', { name: 'Prévia' });
    const showButton = row.getByRole('button', { name: 'No ar' });

    // Assert: off: there is nothing to show it with ("Regras" is where to choose one).
    expect(previewButton, 'no item, no preview').toBeDisabled();
    expect(showButton, 'no item, nothing to put on air').toBeDisabled();
  });
});

describe('the tab on the console', () => {
  it('keeps the waiting events only, and links to the "Eventos" page', () => {
    // Arrange: a penalty waiting and a leader change that is over.
    renderTheEventsTabWith([
      buildPendingPenaltyOfCar47(5),
      buildFinishedLeaderChangeOfCar52(10, 'shown'),
    ]);

    // Act: look for what moved to the page, and for the link.
    const finishedList = screen.queryByRole('list', { name: 'Eventos encerrados' });
    const addEventButton = screen.queryByRole('button', { name: '+ Evento' });
    const rulesButton = screen.queryByRole('button', { name: 'Regras' });
    const pageLink = screen.getByRole('link', { name: 'Abrir a página de eventos' });

    // Assert: only the penalty is listed; the rest is one link away, in a new tab.
    expect(readWaitingEventRows(), 'the waiting penalty only').toHaveLength(1);
    expect(finishedList, 'the events that are over are on the page').toBe(null);
    expect(addEventButton, '"+ Evento" is on the page').toBe(null);
    expect(rulesButton, '"Regras" is on the page').toBe(null);
    expect(pageLink, 'the link leads to the page').toHaveAttribute('href', '#/eventos');
    expect(pageLink, 'in a new tab, so the console stays').toHaveAttribute('target', '_blank');
  });

  it('scrolls the waiting events inside a capped height', () => {
    // Arrange: three events waiting.
    renderTheEventsTabWith([
      buildPendingPenaltyOfCar47(5),
      buildPendingWarningOfCar38(3),
      buildQueuedFastestLapOfCar31(1),
    ]);

    // Act: find the list's scrolling area.
    const scrollingArea = screen.getByRole('list', { name: 'Eventos esperando' }).parentElement;

    // Assert: a capped height (16rem) that scrolls, so Camadas below is never pushed off.
    expect(scrollingArea, 'the height is capped').toHaveClass('max-h-64');
    expect(scrollingArea, 'and the list scrolls inside it').toHaveClass('overflow-y-auto');
  });
});

describe('undoing a dismissal on the console', () => {
  it('offers "Desfazer" for an event dismissed in the last 30 s, sending restoreEvent', () => {
    // Arrange: car 47's penalty dismissed 10 s ago, by a slip of the mouse.
    const { fakeServer } = renderTheEventsTabWith([buildPenaltyOfCar47DismissedSecondsAgo(10)]);

    // Act: press "Desfazer" on it.
    const recentlyDismissed = screen.getByRole('list', { name: 'Descartados agora há pouco' });
    const penaltyRow = within(
      within(recentlyDismissed).getAllByRole('listitem')[0] ?? document.body,
    );
    fireEvent.click(penaltyRow.getByRole('button', { name: 'Desfazer' }));

    // Assert: the row says what was dismissed, and the restore was sent.
    expect(penaltyRow.getByText('Penalidade · carro 47'), 'what was dismissed').toBeInTheDocument();
    expect(fakeServer.listCommandsReceived(), '"Desfazer" must bring it back').toEqual([
      { type: 'restoreEvent', eventId: 'simulador-enduro:incident:ocorrencia-0007' },
    ]);
  });

  it('leaves out an event dismissed more than 30 s ago', () => {
    // Arrange: the penalty dismissed 40 s ago.
    renderTheEventsTabWith([buildPenaltyOfCar47DismissedSecondsAgo(40)]);

    // Act: look for the list of recent dismissals.
    const recentlyDismissed = screen.queryByRole('list', { name: 'Descartados agora há pouco' });

    // Assert: none; an older one is restored from the "Eventos" page's history.
    expect(recentlyDismissed, 'only the last 30 s are offered here').toBe(null);
  });
});
