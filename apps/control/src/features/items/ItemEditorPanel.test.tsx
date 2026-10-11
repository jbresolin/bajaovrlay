/**
 * Item editor panel: preparing a new item (apps/control)
 *
 * What this module is for:
 *   Before a session the operator prepares items: a graphic, the layer it goes on, the
 *   values of its fields, and a label, colour and notes to find it in the rundown. The
 *   item editor panel is where that is typed. "Salvar item" sends one `createItem`
 *   command, and the panel asks to be closed once the server has accepted it.
 *
 * What these tests prove:
 *   - For a new item the panel opens with the first graphic chosen, that graphic's
 *     default layer, an empty label, the neutral colour and the race clock fields at
 *     their defaults — whether the server's graphics arrive after the panel is drawn
 *     or were already on the page when it opened (the "+ Item" case).
 *   - The colour dropdown offers the six fixed colours, each with a name in words.
 *   - "Salvar item" builds the right `createItem` from what was typed and chosen, and
 *     the panel asks to be closed only after the server accepted it.
 *   - Choosing a graphic the editor has no form for moves the layer to that graphic's
 *     default, replaces the race clock fields by the "BAJAOVRLAY-14" notice, and saves
 *     an item with empty fields.
 *   - A layer chosen by hand is the one sent.
 *   - "Cancelar" asks to be closed and sends nothing.
 *   - With the take panel on the same page, the editor's race clock fields are its own:
 *     typing into one does not touch the take panel's field of the same name.
 *
 * What these tests deliberately do not cover:
 *   - Editing an existing item: ItemEditorPanelEditing.test.tsx.
 *   - Field messages, a refused save and the lost connection:
 *     ItemEditorPanelProblems.test.tsx.
 *   - Every combination of values: itemCommandsFromForm.test.ts, without drawing.
 *   - The rundown that opens this panel and the real server: features/rundown and
 *     e2e/, which use the real ones.
 *   - How a clock saved as running behaves when taken hours later; the panel only
 *     shows the notice that explains it.
 */
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  chooseOptionInDropdown,
  typeIntoField,
} from '@/features/playout/operatingTheRaceClockForm.testSupport';
import { TakeRaceClockPanel } from '@/features/playout/TakeRaceClockPanel';
import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import { buildSlicesWithNothingOnAir } from '@/state/slicesLikeTheServerSends.testSupport';

import {
  momentOfTheSaveInMilliseconds,
  pressSaveAndWaitForCommand,
  renderItemEditorPanelOnFakeServer,
  renderItemEditorPanelOpenedOnAPageThatAlreadyKnowsTheGraphics,
} from './itemEditorOnFakeServer.testSupport';
import { ItemEditorPanel } from './ItemEditorPanel';
import { idOfTheMainSessionRundown } from './itemsLikeTheEditorSaves.testSupport';

describe('the item editor panel for a new item', () => {
  it('opens with the first graphic, its default layer, an empty label and the neutral colour', () => {
    // Arrange: a connected page that knows the race clock and the driver lower third.

    // Act: draw the editor for a new item.
    renderItemEditorPanelOnFakeServer(null);

    // Assert: the panel is a named region titled "Novo item", with every field at its start.
    const editorPanel = screen.getByRole('region', { name: 'Editor de item' });
    expect(
      within(editorPanel).getByRole('heading', { name: 'Novo item' }),
      'the panel must say it is preparing a new item',
    ).toBeInTheDocument();
    expect(
      screen.getByRole('combobox', { name: 'Gráfico' }),
      'the first graphic of the server must be chosen already',
    ).toHaveTextContent('Relógio de prova');
    expect(
      screen.getByRole('combobox', { name: 'Camada' }),
      "the layer must start as the race clock's default layer",
    ).toHaveTextContent('Relógio');
    expect(screen.getByLabelText('Rótulo'), 'the label must start empty').toHaveValue('');
    expect(
      screen.getByRole('combobox', { name: 'Cor' }),
      'the colour must start neutral',
    ).toHaveTextContent('Neutra');
    expect(screen.getByLabelText('Observações'), 'the notes must start empty').toHaveValue('');
    expect(
      screen.getByLabelText('Saída automática (segundos, opcional)'),
      'the auto-out must start blank, meaning "stay on air"',
    ).toHaveValue('');
    expect(
      screen.getByLabelText('Nome da sessão'),
      'the race clock fields must be there, at the defaults of the take panel',
    ).toHaveValue('Enduro de Resistência');
    expect(
      screen.getByLabelText('Tempo de referência (mm:ss)'),
      'the reference time must start at zero',
    ).toHaveValue('0:00');
    expect(
      screen.getByText(/Relógio correndo: conta a partir do momento em que o item foi salvo/),
      'the panel must warn how a clock saved running behaves when taken later',
    ).toBeInTheDocument();
  });

  it('opens with the first graphic and its layer when the page already knew the graphics, as after "+ Item"', () => {
    // Arrange: a connected page that already holds the graphics and the layers. (The
    // test above draws the editor before the server's hello; a real operator presses
    // "+ Item" long after it.)

    // Act: open the editor for a new item with a button press.
    renderItemEditorPanelOpenedOnAPageThatAlreadyKnowsTheGraphics();

    // Assert: the graphic and the layer are chosen at once and the clock fields are there.
    expect(
      screen.getByRole('combobox', { name: 'Gráfico' }),
      'the first graphic must be chosen as soon as the editor opens',
    ).toHaveTextContent('Relógio de prova');
    expect(
      screen.getByRole('combobox', { name: 'Camada' }),
      "the layer must be the race clock's default layer as soon as the editor opens",
    ).toHaveTextContent('Relógio');
    expect(
      screen.getByLabelText('Nome da sessão'),
      'the race clock fields must be on screen for the graphic chosen at the start',
    ).toBeInTheDocument();
  });

  it('offers the six fixed colours, each with a name in words', () => {
    // Arrange: the editor for a new item.
    renderItemEditorPanelOnFakeServer(null);

    // Act: open the colour dropdown.
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Cor' }), { key: 'Enter' });

    // Assert: six options, in the order of the shared contract, told apart by text and
    // not by colour alone.
    const namesOfTheColourOptions = screen
      .getAllByRole('option')
      .map((colourOption) => colourOption.textContent);
    expect(
      namesOfTheColourOptions,
      'the six colours must be offered by name, in the fixed order',
    ).toEqual(['Neutra', 'Informação', 'Sucesso', 'Atenção', 'Perigo', 'Destaque']);
  });

  it('builds the right createItem from what was typed and asks to be closed once the server accepts', async () => {
    // Arrange: the editor filled for the start of the endurance race: the clock stopped
    // at 240:00 and counting down, green in the rundown, off air by itself after 90 s.
    const { fakeServer, onClose } = renderItemEditorPanelOnFakeServer(null);
    typeIntoField('Rótulo', 'Largada do Enduro');
    chooseOptionInDropdown('Cor', 'Sucesso');
    typeIntoField('Observações', 'Entrar quando os carros alinharem.');
    typeIntoField('Saída automática (segundos, opcional)', '90');
    typeIntoField('Nome da sessão', 'Enduro de Resistência — Largada');
    chooseOptionInDropdown('Modo do relógio', 'Tempo restante');
    typeIntoField('Tempo de referência (mm:ss)', '240:00');

    // Act: press "Salvar item", and then the server accepts the command.
    await pressSaveAndWaitForCommand(1, fakeServer);
    const timesClosedBeforeTheServerAnswered = onClose.mock.calls.length;
    fakeServer.acceptLastCommand();

    // Assert: one createItem for the main session's rundown with the form as literals
    // (240:00 is 14 400 000 ms, 90 s is 90 000 ms, the reference moment is the save).
    expect(
      fakeServer.listCommandsReceived(),
      'the press must send exactly one createItem carrying the whole form',
    ).toEqual([
      {
        type: 'createItem',
        rundownId: 'sessao-principal',
        graphicId: 'race-clock',
        layerId: 'clock',
        label: 'Largada do Enduro',
        color: 'success',
        notes: 'Entrar quando os carros alinharem.',
        autoOutAfterMs: 90_000,
        fields: {
          sessionName: { kind: 'literal', value: 'Enduro de Resistência — Largada' },
          state: { kind: 'literal', value: 'pre' },
          clockMode: { kind: 'literal', value: 'remaining' },
          referenceTimeMs: { kind: 'literal', value: 14_400_000 },
          referenceWallClockMs: { kind: 'literal', value: momentOfTheSaveInMilliseconds },
          running: { kind: 'literal', value: false },
        },
      },
    ]);
    expect(
      timesClosedBeforeTheServerAnswered,
      'the panel must stay open while the server has not answered',
    ).toBe(0);
    await waitFor(() => {
      expect(
        onClose,
        'the panel must ask to be closed once the save was accepted',
      ).toHaveBeenCalledTimes(1);
    });
  });

  it('shows the BAJAOVRLAY-14 notice instead of fields for a graphic without a form, and saves empty fields', async () => {
    // Arrange: the editor for a new item, with a label for team 42's lower third.
    const { fakeServer } = renderItemEditorPanelOnFakeServer(null);
    typeIntoField('Rótulo', 'Tarja da equipe 42');

    // Act: choose the driver lower third as the graphic, then save.
    chooseOptionInDropdown('Gráfico', 'Tarja de piloto');
    const layerShownAfterChoosingTheGraphic = screen.getByRole('combobox', {
      name: 'Camada',
    }).textContent;
    const isRaceClockFormStillShown = screen.queryByLabelText('Nome da sessão') !== null;
    await pressSaveAndWaitForCommand(1, fakeServer);

    // Assert: the layer followed the graphic's default, the race clock fields are gone,
    // the notice is shown, and the item is created with no field values.
    expect(
      layerShownAfterChoosingTheGraphic,
      "the layer must move to the new graphic's default layer",
    ).toContain('Tarja');
    expect(
      isRaceClockFormStillShown,
      'the race clock fields must not be offered for another graphic',
    ).toBe(false);
    expect(
      screen.getByText(/Editor genérico chega em BAJAOVRLAY-14/),
      'the panel must say when the fields of this graphic arrive',
    ).toBeInTheDocument();
    expect(
      fakeServer.listCommandsReceived(),
      'an item of a graphic without a form must be created with empty fields',
    ).toEqual([
      {
        type: 'createItem',
        rundownId: 'sessao-principal',
        graphicId: 'driver-lower-third',
        layerId: 'lower-third',
        label: 'Tarja da equipe 42',
        color: 'neutral',
        notes: '',
        fields: {},
      },
    ]);
    // (Then the server answers, so no command is left waiting for its 5-second timeout
    // once the test is over.)
    fakeServer.acceptLastCommand();
  });

  it('sends the layer the operator chose by hand instead of the default one', async () => {
    // Arrange: a new race clock item that the operator wants on the full-screen layer.
    const { fakeServer } = renderItemEditorPanelOnFakeServer(null);
    typeIntoField('Rótulo', 'Relógio em tela cheia');

    // Act: choose the layer by hand and save.
    chooseOptionInDropdown('Camada', 'Tela cheia');
    await pressSaveAndWaitForCommand(1, fakeServer);

    // Assert: the command names the chosen layer, not the race clock's default.
    expect(
      fakeServer.listCommandsReceived()[0],
      'the layer chosen by hand must be the one sent',
    ).toMatchObject({ type: 'createItem', graphicId: 'race-clock', layerId: 'fullscreen' });
    // (Then the server answers, so no command is left waiting for its 5-second timeout.)
    fakeServer.acceptLastCommand();
  });

  it('asks to be closed and sends nothing when "Cancelar" is pressed', () => {
    // Arrange: the editor with a label already typed.
    const { fakeServer, onClose } = renderItemEditorPanelOnFakeServer(null);
    typeIntoField('Rótulo', 'Largada do Enduro');

    // Act: press "Cancelar".
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    // Assert: the panel asked to be closed once, and the server heard nothing.
    expect(onClose, '"Cancelar" must ask to be closed').toHaveBeenCalledTimes(1);
    expect(fakeServer.listCommandsReceived(), '"Cancelar" must not send any command').toEqual([]);
  });
});

describe('the item editor panel on the same page as the take panel', () => {
  it('keeps its race clock fields apart from the take panel fields of the same name', () => {
    // Arrange: the page as the operator has it: the take panel (the quick manual path)
    // and, below it, the editor for a new item. Both draw a "Nome da sessão" field.
    renderOnControlPageConnectedToFakeServer(
      <>
        <TakeRaceClockPanel />
        <ItemEditorPanel
          rundownId={idOfTheMainSessionRundown}
          itemBeingEdited={null}
          onClose={() => undefined}
        />
      </>,
      buildSlicesWithNothingOnAir(),
    );
    const editorPanel = screen.getByRole('region', { name: 'Editor de item' });
    const sessionNameFields = screen.getAllByLabelText('Nome da sessão');
    const sessionNameFieldOfTheEditor = within(editorPanel).getByLabelText('Nome da sessão');

    // Act: type a session name into the editor's field.
    fireEvent.change(sessionNameFieldOfTheEditor, { target: { value: 'Enduro — Bateria 2' } });

    // Assert: there are two separate fields, and only the editor's one changed. (With
    // equal ids, the editor's label would point at the take panel's field instead.)
    const sessionNameFieldOfTheTakePanel = sessionNameFields.find(
      (sessionNameField) => sessionNameField !== sessionNameFieldOfTheEditor,
    );
    expect(sessionNameFields, 'each panel must have its own session name field').toHaveLength(2);
    expect(
      sessionNameFieldOfTheEditor,
      'the editor field must hold what was typed into it',
    ).toHaveValue('Enduro — Bateria 2');
    expect(
      sessionNameFieldOfTheTakePanel,
      'the take panel field must be left as it was',
    ).toHaveValue('Enduro de Resistência');
  });
});
