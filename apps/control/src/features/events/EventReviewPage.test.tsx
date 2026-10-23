/**
 * "Eventos": the page that reviews the event inbox (apps/control)
 *
 * What this module is for:
 *   The console's "Eventos" tab is short on room: it sits above Camadas, so since gate 2
 *   of PR #22 it keeps only the waiting events. Everything else about the inbox lives on a
 *   page of its own, "#/eventos", opened from the header in a new tab: the waiting events
 *   with the same buttons as on the console, "+ Evento", "Regras", and the history, a
 *   table of every event the server keeps (its newest 200), newest first.
 *
 * What these tests prove:
 *   - The waiting events are listed with their buttons; "No ar" there sends showEvent, as
 *     on the console.
 *   - The history lists every event, newest first, with its time of day, kind, car, team,
 *     lap, details (reason, penalty, lap time), where it came from (the source's name, or
 *     "Digitado") and its status.
 *   - "+ Evento" and "Regras" open their forms on this page.
 *
 * What these tests deliberately do not cover:
 *   - The rows' other buttons and what the forms send; EventsTab.test.tsx,
 *     ManualEventDialog.test.tsx and EventRulesDialog.test.tsx.
 *   - The header's link and the address; src/AppEventReviewPage.test.tsx.
 */
import type { InboxEvent } from '@bajaovrlay/shared';
import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { formatTimeOfDay } from '@/features/dataSources/timeOfDayText';
import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import { buildSimulatorThatIsOk } from '@/state/dataSourcesLikeTheServerSends.testSupport';
import {
  buildFinishedLeaderChangeOfCar52,
  buildPendingPenaltyOfCar47,
  buildQueuedFastestLapOfCar31,
  buildShownManualNoticeOfCar12,
  buildSlicesWithTheInbox,
  nowInTheInboxTests,
} from '@/state/eventsLikeTheServerSends.testSupport';

import { EventReviewPage } from './EventReviewPage';

afterEach(() => {
  vi.useRealTimers();
});

/** The page at 14:10 with these events in the inbox and the simulator among the sources. */
function renderTheReviewPageWith(events: InboxEvent[]) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(nowInTheInboxTests);
  return renderOnControlPageConnectedToFakeServer(<EventReviewPage />, {
    ...buildSlicesWithTheInbox(events),
    dataSources: [buildSimulatorThatIsOk()],
  });
}

/** The cells of each body row of the history, as text, top to bottom. */
function readHistoryRows(): string[][] {
  const table = screen.getByRole('table', { name: 'Histórico de eventos' });
  const bodyRows = within(table).getAllByRole('row').slice(1);
  return bodyRows.map((row) =>
    within(row)
      .getAllByRole('cell')
      .map((cell) => cell.textContent ?? ''),
  );
}

describe('the waiting events on the review page', () => {
  it('are listed with their buttons, and "No ar" sends showEvent', () => {
    // Arrange: car 47's penalty waiting.
    const { fakeServer } = renderTheReviewPageWith([buildPendingPenaltyOfCar47(2)]);

    // Act: press "No ar" on its row.
    const waitingList = screen.getByRole('list', { name: 'Eventos esperando' });
    const penaltyRow = within(within(waitingList).getAllByRole('listitem')[0] ?? document.body);
    fireEvent.click(penaltyRow.getByRole('button', { name: 'No ar' }));

    // Assert: the same command as on the console.
    expect(fakeServer.listCommandsReceived(), '"No ar" must approve the penalty').toEqual([
      { type: 'showEvent', eventId: 'simulador-enduro:incident:ocorrencia-0007' },
    ]);
  });
});

describe('the history', () => {
  it('lists every event, newest first, with what the operator needs to review it', () => {
    // Arrange: a typed notice 40 min ago (shown), a leader change 30 min ago (dismissed),
    // the penalty 5 min ago (waiting) and a fastest lap 1 min ago (queued).
    const notice = buildShownManualNoticeOfCar12(40);
    const leaderChange = buildFinishedLeaderChangeOfCar52(30, 'dismissed');
    const penalty = buildPendingPenaltyOfCar47(5);
    const fastestLap = buildQueuedFastestLapOfCar31(1);
    renderTheReviewPageWith([notice, leaderChange, penalty, fastestLap]);

    // Act: read the table.
    const rows = readHistoryRows();

    // Assert: four rows, newest first. Each row: time, kind, car, team, lap, details,
    // origin, status. The typed notice says "Digitado"; the others name their source.
    expect(rows, 'every event the server keeps, newest first').toEqual([
      [
        formatTimeOfDay(fastestLap.detectedAtMs),
        'Volta mais rápida',
        '31',
        'Acauã Baja',
        '34',
        '4:38,2',
        'Simulador — Enduro',
        'na fila',
      ],
      [
        formatTimeOfDay(penalty.detectedAtMs),
        'Penalidade',
        '47',
        'Carnaúba Baja',
        '1',
        'Queima de largada · +30 segundos',
        'Simulador — Enduro',
        'esperando',
      ],
      [
        formatTimeOfDay(leaderChange.detectedAtMs),
        'Mudança de líder',
        '52',
        'Pequi Off-Road',
        '20',
        '',
        'Simulador — Enduro',
        'descartado',
      ],
      [
        formatTimeOfDay(notice.detectedAtMs),
        'Aviso',
        '12',
        'Tatu Baja',
        '',
        'Troca de piloto no box',
        'Digitado',
        'exibido',
      ],
    ]);
  });

  it('says so when the server keeps no event yet', () => {
    // Arrange: an empty inbox.
    renderTheReviewPageWith([]);

    // Act: look for the table.
    const table = screen.queryByRole('table', { name: 'Histórico de eventos' });

    // Assert: no empty table, a sentence instead.
    expect(table, 'no table with nothing in it').toBe(null);
    expect(screen.getByText('Nenhum evento ainda.'), 'the page says why').toBeInTheDocument();
  });
});

describe('the forms on the review page', () => {
  const formScenarios = [
    // "+ Evento": a penalty or notice typed by hand moved here from the console.
    { buttonName: '+ Evento', dialogTitle: 'Novo evento' },
    // "Regras": the five rules moved here from the console too.
    { buttonName: 'Regras', dialogTitle: 'Regras de eventos' },
  ];

  it.each(formScenarios)('"$buttonName" opens its form', ({ buttonName, dialogTitle }) => {
    // Arrange: the page with an empty inbox.
    renderTheReviewPageWith([]);

    // Act: press the button.
    fireEvent.click(screen.getByRole('button', { name: buttonName }));

    // Assert: its form is open.
    expect(screen.getByRole('dialog', { name: dialogTitle }), 'the form opens').toBeVisible();
  });
});
