/**
 * The "Histórico" page with the operator login on (apps/control)
 *
 * What this module is for:
 *   With the PINs set (BAJAOVRLAY-29) every command is signed by the role and the station
 *   typed at login (`produtor:Mesa 1`, `dados:Mesa 2`). The history reads them as the
 *   operators say them, "Produtor · Mesa 1", and its "Quem" filter offers both roles.
 *
 * What these tests prove (the page wired as in the browser, on a fake server):
 *   - The "Quem" column reads "Produtor · Mesa 1" and "Dados · Mesa 2".
 *   - "Quem" set to "Dados" keeps only Dados's rows (here its refused take, with the
 *     role's sentence).
 *
 * What these tests deliberately do not cover:
 *   - The rest of the page; HistoryPage.test.tsx.
 *   - How an actor reads as a label; packages/shared's eventLogActors.test.ts.
 */
import type { EventLogEntry, Item, Slices } from '@bajaovrlay/shared';
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  buildEnduranceStartClockItem,
  buildInterviewLowerThirdItem,
  buildSlicesWithTheRaceClockAndTheLowerThird,
} from '@/features/items/itemsLikeTheEditorSaves.testSupport';
import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';

import { HistoryPage } from './HistoryPage';

const startClockItem = buildEnduranceStartClockItem();
const interviewItem = buildInterviewLowerThirdItem();

/** The page's slices: the two items prepared and the given event log. */
function buildSlicesWithEventLog(eventLog: EventLogEntry[]): Slices {
  const items: Item[] = [startClockItem, interviewItem];
  return { ...buildSlicesWithTheRaceClockAndTheLowerThird(), items, eventLog };
}

/** The sentences of the table's rows, top to bottom. */
function readSentencesShown(): string[] {
  const table = screen.getByRole('table', { name: 'Histórico de comandos' });
  const bodyRows = within(table).getAllByRole('row').slice(1);
  return bodyRows.map((row) => within(row).getAllByRole('cell')[2]?.textContent ?? '');
}

/** Opens one of the filter dropdowns and picks an option, by the names the operator reads. */
function chooseInFilter(filterName: string, optionName: string): void {
  fireEvent.keyDown(screen.getByRole('combobox', { name: filterName }), { key: 'Enter' });
  fireEvent.click(screen.getByRole('option', { name: optionName }));
}

describe('the rows of a show with the login on', () => {
  /** A take by the Produtor at "Mesa 1", and Dados's take refused at "Mesa 2" just after. */
  function buildRowsOfTheTwoRoles(): EventLogEntry[] {
    return [
      {
        id: 51,
        ts: '2026-11-07T14:00:00.000Z',
        actor: 'produtor:Mesa 1',
        command: 'takeItem',
        payload: { type: 'takeItem', itemId: startClockItem.id },
        result: { status: 'ok' },
      },
      {
        id: 52,
        ts: '2026-11-07T14:01:00.000Z',
        actor: 'dados:Mesa 2',
        command: 'takeItem',
        payload: { type: 'takeItem', itemId: interviewItem.id },
        result: {
          status: 'failed',
          error: {
            code: 'NOT_ALLOWED',
            message: 'O papel Dados não pode mudar o que está no ar. Peça ao Produtor.',
          },
        },
      },
    ];
  }

  it('names the role and the station of each row', () => {
    // Arrange: the two rows on the page.
    renderOnControlPageConnectedToFakeServer(
      <HistoryPage />,
      buildSlicesWithEventLog(buildRowsOfTheTwoRoles()),
    );

    // Act: read the "Quem" column.
    const table = screen.getByRole('table', { name: 'Histórico de comandos' });
    const bodyRows = within(table).getAllByRole('row').slice(1);
    const senders = bodyRows.map((row) => within(row).getAllByRole('cell')[1]?.textContent);

    // Assert: role and station, newest first.
    expect(senders, '"Quem" names the role and the station').toEqual([
      'Dados · Mesa 2',
      'Produtor · Mesa 1',
    ]);
  });

  it('keeps Dados’s rows when "Quem" is "Dados"', () => {
    // Arrange: the two rows on the page.
    renderOnControlPageConnectedToFakeServer(
      <HistoryPage />,
      buildSlicesWithEventLog(buildRowsOfTheTwoRoles()),
    );

    // Act: choose "Dados" in "Quem".
    chooseInFilter('Quem', 'Dados');

    // Assert: only the refused take of Dados is left.
    expect(readSentencesShown(), 'the filter keeps the role’s own rows').toEqual([
      'Recusado: Tomou "Tarja da equipe 42" na camada Tarja (Programa) — O papel Dados não pode mudar o que está no ar. Peça ao Produtor.',
    ]);
  });
});
