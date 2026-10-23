/**
 * The search box and the sortable headers of the history (apps/control)
 *
 * What this module is for:
 *   The "Eventos" page's history can be searched and sorted (asked at the walk of PR #22):
 *   a box above the table, "Buscar no histórico", and a button in each sortable header.
 *   The search and the sort are this page's own view, never sent to the server; the rules
 *   of both are eventHistoryView.ts's, tested in eventHistoryView.test.ts.
 *
 * What these tests prove:
 *   - Typing in the box lists only the events found, and says so when none is.
 *   - A header's button sorts by its column, the second click the other way, and the
 *     header says which way (aria-sort) for a screen reader; the time is marked newest
 *     first before any click.
 *
 * What these tests deliberately do not cover:
 *   - Every column and every kind of search; eventHistoryView.test.ts.
 */
import type { InboxEvent } from '@bajaovrlay/shared';
import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import {
  buildPendingPenaltyOfCar47,
  buildPendingWarningOfCar38,
  buildQueuedFastestLapOfCar31,
  buildSlicesWithTheInbox,
  nowInTheInboxTests,
} from '@/state/eventsLikeTheServerSends.testSupport';

import { EventReviewPage } from './EventReviewPage';

afterEach(() => {
  vi.useRealTimers();
});

/** The page at 14:10 with the penalty of 47, the warning of 38 and the fastest lap of 31. */
function renderTheReviewPageWithThreeEvents() {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(nowInTheInboxTests);
  const events: InboxEvent[] = [
    buildPendingPenaltyOfCar47(5),
    buildPendingWarningOfCar38(3),
    buildQueuedFastestLapOfCar31(1),
  ];
  return renderOnControlPageConnectedToFakeServer(
    <EventReviewPage />,
    buildSlicesWithTheInbox(events),
  );
}

/** The car numbers of the history's rows, top to bottom (the third cell of each). */
function readCarsOfTheHistory(): string[] {
  const table = screen.getByRole('table', { name: 'Histórico de eventos' });
  const bodyRows = within(table).getAllByRole('row').slice(1);
  return bodyRows.map((row) => within(row).getAllByRole('cell')[2]?.textContent ?? '');
}

/** The header cell of one column of the history, by its name. */
function findHeaderOf(columnName: string): HTMLElement {
  const table = screen.getByRole('table', { name: 'Histórico de eventos' });
  return within(table).getByRole('columnheader', { name: columnName });
}

describe('searching the history', () => {
  it('lists only the events found', () => {
    // Arrange: the page with three events.
    renderTheReviewPageWithThreeEvents();

    // Act: search for the warning's reason, typed without care for case.
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar no histórico' }), {
      target: { value: 'bloqueio' },
    });

    // Assert: car 38's warning only.
    expect(readCarsOfTheHistory(), 'only the warning matches').toEqual(['38']);
  });

  it('says so when nothing is found', () => {
    // Arrange: the page with three events.
    renderTheReviewPageWithThreeEvents();

    // Act: search for something no event holds.
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar no histórico' }), {
      target: { value: 'capotamento' },
    });

    // Assert: a sentence instead of the rows; the box stays, so the search can be changed.
    expect(
      screen.getByText('Nenhum evento encontrado.'),
      'the page says nothing matched',
    ).toBeInTheDocument();
    expect(
      screen.getByRole('searchbox', { name: 'Buscar no histórico' }),
      'the box stays',
    ).toHaveValue('capotamento');
  });
});

describe('sorting the history', () => {
  it('sorts by a header, the other way on a second click, and says which way', () => {
    // Arrange: the page with three events, newest first.
    renderTheReviewPageWithThreeEvents();
    const timeSortBefore = findHeaderOf('Hora').getAttribute('aria-sort');

    // Act: click "Carro" once, read; click it again, read.
    fireEvent.click(within(findHeaderOf('Carro')).getByRole('button', { name: 'Carro' }));
    const carsAfterOneClick = readCarsOfTheHistory();
    const carSortAfterOneClick = findHeaderOf('Carro').getAttribute('aria-sort');
    fireEvent.click(within(findHeaderOf('Carro')).getByRole('button', { name: 'Carro' }));

    // Assert: newest first before; then smallest car first; then largest; each marked.
    expect(timeSortBefore, 'the time is the sort before any click').toBe('descending');
    expect(carsAfterOneClick, 'smallest car first').toEqual(['31', '38', '47']);
    expect(carSortAfterOneClick, 'marked ascending').toBe('ascending');
    expect(readCarsOfTheHistory(), 'largest car first').toEqual(['47', '38', '31']);
    expect(findHeaderOf('Carro').getAttribute('aria-sort'), 'marked descending').toBe('descending');
    expect(findHeaderOf('Hora').getAttribute('aria-sort'), 'the time no longer').toBe(null);
  });
});
