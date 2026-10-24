/**
 * Item editor panel: a new item before a graphic is chosen (apps/control)
 *
 * What this module is for:
 *   A new item ("+ Item", "+ Atalho", "Novo gráfico…") opens with no graphic chosen. The
 *   server lists its graphics in the order of their package folders, which means nothing
 *   on air, so none is chosen for the operator (decided in PR #20): "Gráfico" shows
 *   "Escolha um gráfico…", and the editor refuses to save or fire until one is chosen.
 *
 * What these tests prove:
 *   - The editor opens with "Escolha um gráfico…", no layer and no fields of any graphic,
 *     also when the page already knew the server's graphics when it opened (the "+ Item"
 *     case, where a default taken from the list would show up).
 *   - "Salvar item", "Salvar e disparar" and "Salvar e prévia" are off, a line says why,
 *     and a press sends nothing.
 *   - Choosing a graphic by name turns the buttons on, takes the line away and draws
 *     that graphic's fields.
 *
 * What these tests deliberately do not cover:
 *   - The rest of a new item (the fields at their defaults, what "Salvar item" sends):
 *     ItemEditorPanel.test.tsx; the rule "Escolha o gráfico." of the form itself, for a
 *     press that gets past the buttons: itemEditorForm.test.ts.
 *   - A stored item, whose graphic is read-only, and a prefill ("Salvar como item"),
 *     which opens on its own graphic: ItemEditorPanelEditing.test.tsx and
 *     ItemEditorPanelPrefill.test.tsx.
 */
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { typeIntoField } from '@/features/schemaForm/schemaFormOnTestPage.testSupport';

import {
  chooseGraphicInTheEditor,
  raceClockGraphicName,
  renderItemEditorPanelOnFakeServer,
  renderItemEditorPanelOpenedOnAPageThatAlreadyKnowsTheGraphics,
} from './itemEditorOnFakeServer.testSupport';

/** The line beside the buttons while no graphic is chosen. */
const reasonTheSaveButtonsAreOff = 'Escolha um gráfico para salvar o item.';

/** The three buttons that save a new item, by name; all are off until a graphic is chosen. */
const namesOfTheSaveButtons = ['Salvar item', 'Salvar e disparar', 'Salvar e prévia'];

describe('the item editor panel for a new item before a graphic is chosen', () => {
  it('opens with no graphic chosen, no layer and no fields of any graphic', () => {
    // Arrange: a connected page that knows the race clock and the interview lower third.

    // Act: draw the editor for a new item.
    renderItemEditorPanelOnFakeServer(null);

    // Assert: "Novo item", the dropdown asking for a graphic, and no graphic's fields.
    const editorPanel = screen.getByRole('region', { name: 'Editor de item' });
    expect(
      within(editorPanel).getByRole('heading', { name: 'Novo item' }),
      'the panel must say it is preparing a new item',
    ).toBeInTheDocument();
    expect(
      screen.getByRole('combobox', { name: 'Gráfico' }),
      'no graphic may be chosen for the operator: the dropdown must ask for one',
    ).toHaveTextContent('Escolha um gráfico…');
    expect(
      screen.getByRole('combobox', { name: 'Camada' }),
      'the layer follows the graphic, so it must not be chosen before one is',
    ).toHaveTextContent('Escolha…');
    expect(
      screen.queryByLabelText('Título'),
      "no graphic is chosen, so no graphic's fields may be drawn",
    ).toBeNull();
  });

  it('opens with no graphic chosen even when the page already knew the graphics, as after "+ Item"', () => {
    // Arrange: a connected page that already holds the graphics and the layers. (The
    // test above draws the editor before the server's hello; a real operator presses
    // "+ Item" long after it, and this is where a default taken from the list would
    // show up.)

    // Act: open the editor for a new item with a button press.
    renderItemEditorPanelOpenedOnAPageThatAlreadyKnowsTheGraphics();

    // Assert: the dropdown still asks for a graphic; the order the server lists the
    // graphics in (their package folders) must never choose one for the operator.
    expect(
      screen.getByRole('combobox', { name: 'Gráfico' }),
      'the first graphic the server lists must not be chosen for the operator',
    ).toHaveTextContent('Escolha um gráfico…');
    expect(
      screen.queryByLabelText('Título'),
      'no graphic is chosen, so the race clock fields must not be on screen',
    ).toBeNull();
  });

  it('refuses to save or fire while no graphic is chosen, and says why', () => {
    // Arrange: the editor for a new item with a label typed but no graphic chosen.
    const { fakeServer } = renderItemEditorPanelOnFakeServer(null);
    typeIntoField('Rótulo', 'Largada do Enduro');

    // Act: press each of the three save buttons.
    for (const buttonName of namesOfTheSaveButtons) {
      fireEvent.click(screen.getByRole('button', { name: buttonName }));
    }

    // Assert: the three buttons are off with the reason beside them, and nothing was sent.
    for (const buttonName of namesOfTheSaveButtons) {
      expect(
        screen.getByRole('button', { name: buttonName }),
        `"${buttonName}" must be off: a new item without a graphic has nothing to save or to put on air`,
      ).toBeDisabled();
    }
    expect(
      screen.getByText(reasonTheSaveButtonsAreOff),
      'the operator must be told why the save buttons are off',
    ).toBeVisible();
    expect(
      fakeServer.listCommandsReceived(),
      'a press with no graphic chosen must send nothing',
    ).toEqual([]);
  });

  it("turns the save buttons on and draws the graphic's fields once a graphic is chosen", () => {
    // Arrange: the editor for a new item, its save buttons off for want of a graphic.
    renderItemEditorPanelOnFakeServer(null);

    // Act: choose the race clock by name.
    chooseGraphicInTheEditor(raceClockGraphicName);

    // Assert: the dropdown shows the choice, the layer followed it, the clock's fields
    // are on screen, the three buttons are on and the reason is gone.
    expect(
      screen.getByRole('combobox', { name: 'Gráfico' }),
      'the dropdown must show the graphic that was chosen',
    ).toHaveTextContent('Relógio de prova');
    expect(
      screen.getByRole('combobox', { name: 'Camada' }),
      "the layer must move to the race clock's default layer",
    ).toHaveTextContent('Relógio');
    expect(
      screen.getByLabelText('Título'),
      "the chosen graphic's fields must be drawn, at the manifest's defaults",
    ).toHaveValue('Enduro de Resistência');
    for (const buttonName of namesOfTheSaveButtons) {
      expect(
        screen.getByRole('button', { name: buttonName }),
        `"${buttonName}" must come on once a graphic is chosen`,
      ).toBeEnabled();
    }
    expect(
      screen.queryByText(reasonTheSaveButtonsAreOff),
      'the reason must go away once a graphic is chosen',
    ).toBeNull();
  });
});
