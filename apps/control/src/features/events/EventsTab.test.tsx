/**
 * The "Eventos" tab of the quick-fire strip (apps/control)
 *
 * What this module is for:
 *   The event inbox (BAJAOVRLAY-44) on the console: a tab of "Atalhos e macros", after
 *   "Macros", with a badge counting the events that wait for the operator. It lists the
 *   waiting events (pending for the operator, queued for the automatic runner), newest
 *   first, each with its kind, the car's chip, the team, the reason and how long ago it
 *   arrived, and three buttons: "Prévia" (the rule's item filled from this event, on the
 *   preview output), "No ar" (showEvent) and "Descartar" (dismissEvent). Under them, greyed,
 *   the last 20 events that are over, each with its status.
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
 *
 * What these tests deliberately do not cover:
 *   - The badge's pulse and the sound; EventsTabAlert.test.tsx.
 *   - The "+ Evento" form and the rules editor; ManualEventDialog.test.tsx and
 *     EventRulesDialog.test.tsx.
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

describe('the events that are over', () => {
  it('are listed below, greyed, the 20 newest with their status', () => {
    // Arrange: 22 finished leader changes, from 22 to 1 minutes ago, shown, dismissed or
    // expired in turn.
    const statuses = ['shown', 'dismissed', 'expired'] as const;
    const finishedEvents = Array.from({ length: 22 }, (_, index) =>
      buildFinishedLeaderChangeOfCar52(22 - index, statuses[index % 3] ?? 'shown'),
    );
    renderTheEventsTabWith(finishedEvents);

    // Act: read the list of finished events.
    const rows = within(screen.getByRole('list', { name: 'Eventos encerrados' })).getAllByRole(
      'listitem',
    );

    // Assert: 20 rows, newest first (1 minute ago, shown; then expired, then dismissed),
    // each with its status word.
    expect(rows, 'only the 20 newest').toHaveLength(20);
    expect(within(rows[0] ?? document.body).getByText('exibido'), 'the newest').toBeInTheDocument();
    expect(within(rows[1] ?? document.body).getByText('expirado'), 'then').toBeInTheDocument();
    expect(within(rows[2] ?? document.body).getByText('descartado'), 'then').toBeInTheDocument();
  });
});
