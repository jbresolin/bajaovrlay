/**
 * Item editor panel: the "Tabela de resultado" item's column choice and order (apps/control)
 *
 * What this module is for:
 *   "Tabela de resultado" (BAJAOVRLAY-83) shows any result page as the site does; the
 *   operator picks which of the page's columns are shown, a title, and an order. The form
 *   is generated from the graphic's manifest like any other: no control-page code was
 *   written for it, so this test is the proof the manifest asks for the right fields.
 *
 * What these tests prove (with the real results-table manifest):
 *   - The editor offers "Colunas mostradas", "Título", "Ordenar por" and "Sentido", the
 *     last a dropdown.
 *   - Typing the columns and the order and choosing "Decrescente" saves those three
 *     fields as the graphic reads them ("descending", not the label).
 *
 * What these tests deliberately do not cover:
 *   - What the graphic does with them: packages/graphics/results-table.
 *   - Binding the rows and heads to a source: the shared preset and shape tests.
 */
import resultsTableManifest from '@bajaovrlay/results-table/results-table.ograf.json';
import type { Graphic, Item } from '@bajaovrlay/shared';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  chooseOptionInDropdown,
  typeIntoField,
} from '@/features/schemaForm/schemaFormOnTestPage.testSupport';

import {
  pressSaveAndWaitForCommand,
  renderItemEditorPanelOnFakeServerWithSlices,
} from './itemEditorOnFakeServer.testSupport';
import {
  buildSlicesWithTheRaceClockAndTheLowerThird,
  idOfTheMainSessionRundown,
} from './itemsLikeTheEditorSaves.testSupport';

const idOfTheQualifyingItem = '4b7e2a90-3c1d-4f5e-9a28-7d6c5b4a3e21';

/** The results table as the server lists it from its built manifest. */
function buildResultsTableGraphic(): Graphic {
  return {
    id: 'results-table',
    manifest: structuredClone(resultsTableManifest),
    defaultLayerId: 'fullscreen',
    category: 'standings',
    thumbnailUrl: null,
    defaultFields: {},
  };
}

/** A stored "Classificatória" item: two rows typed in, nothing chosen yet. */
function buildQualifyingItem(): Item {
  return {
    id: idOfTheQualifyingItem,
    home: { kind: 'rundown', rundownId: idOfTheMainSessionRundown },
    order: 0,
    graphicId: 'results-table',
    layerId: 'fullscreen',
    label: 'Classificatória',
    color: 'neutral',
    notes: '',
    fields: {
      entries: {
        kind: 'literal',
        value: [
          { rank: 1, carNumber: 7, teamName: 'Imperador', schoolName: 'UTFPR-CT', cells: ['51.9'] },
          { rank: 2, carNumber: 5, teamName: 'Guaicurus', schoolName: 'UFGD', cells: ['52.7'] },
        ],
      },
      columnHeads: { kind: 'literal', value: ['Melhor volta'] },
    },
  };
}

/** Opens the editor on the stored item, on a server that lists the results table. */
function renderEditorOnTheQualifyingItem() {
  const slices = buildSlicesWithTheRaceClockAndTheLowerThird();
  return renderItemEditorPanelOnFakeServerWithSlices(buildQualifyingItem(), {
    ...slices,
    graphics: [...slices.graphics, buildResultsTableGraphic()],
    items: [buildQualifyingItem()],
  });
}

describe('the "Tabela de resultado" item in the editor', () => {
  it('offers the column choice, the title and the order', () => {
    // Arrange: nothing beyond the editor itself.

    // Act: open the editor on the stored item.
    renderEditorOnTheQualifyingItem();

    // Assert: the four fields under their pt-BR labels.
    expect(
      screen.getByRole('textbox', { name: 'Colunas mostradas' }),
      'the column choice must be offered',
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Título' }), 'the title').toBeInTheDocument();
    expect(
      screen.getByRole('textbox', { name: 'Ordenar por' }),
      'the column to order by',
    ).toBeInTheDocument();
    expect(
      screen.getByRole('combobox', { name: 'Sentido' }),
      'the direction is a dropdown',
    ).toBeInTheDocument();
  });

  it('saves the columns chosen and the order as the graphic reads them', async () => {
    // Arrange: the editor open on the stored item.
    const { fakeServer } = renderEditorOnTheQualifyingItem();

    // Act: pick two columns, order by best lap, descending, and save.
    typeIntoField('Colunas mostradas', 'Melhor volta, Pontos');
    typeIntoField('Ordenar por', 'Melhor volta');
    chooseOptionInDropdown('Sentido', 'Decrescente');
    await pressSaveAndWaitForCommand(1, fakeServer);

    // Assert: one update carrying the three fields, the direction as its value. The typed
    // rows and heads may travel again unchanged: the editor compares a typed list by
    // identity, not by content (as for every graphic), so they are not checked here.
    expect(fakeServer.listCommandsReceived(), 'the three choices are saved').toEqual([
      {
        type: 'updateItemFields',
        itemId: idOfTheQualifyingItem,
        fields: expect.objectContaining({
          columnsShown: { kind: 'literal', value: 'Melhor volta, Pontos' },
          sortByColumn: { kind: 'literal', value: 'Melhor volta' },
          sortDirection: { kind: 'literal', value: 'descending' },
        }) as unknown,
      },
    ]);
  });
});
