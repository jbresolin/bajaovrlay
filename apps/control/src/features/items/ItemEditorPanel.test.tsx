/**
 * Item editor panel: preparing a new item (apps/control)
 *
 * What this module is for:
 *   Before a session the operator prepares items: a graphic, the layer it goes on, the
 *   values of its fields, and a label, colour and notes to find it in the rundown. The
 *   item editor panel is where that is typed. The fields of the graphic are not written
 *   by hand for any graphic: they are generated from the graphic's manifest. "Salvar
 *   item" sends one `createItem` command, and the panel asks to be closed once the server
 *   has accepted it.
 *
 * What these tests prove:
 *   - For a new item the panel opens titled "Novo item" with an empty label, the neutral
 *     colour, empty notes and no auto-out; its header does not say "Item salvo", which
 *     belongs to a stored item.
 *   - Choosing the race clock by name draws its fields generated from its manifest, at
 *     the manifest's defaults, and its reference moment opens as "filled by the server
 *     at the take".
 *   - The colour dropdown offers the six fixed colours, each with a name in words.
 *   - "Salvar item" builds the right `createItem` from what was typed and chosen, with
 *     the clock's reference moment left to the take, and the panel asks to be closed
 *     only after the server accepted it.
 *   - A reference moment switched to "Valor digitado" is saved as the typed number.
 *   - A layer chosen by hand is the one sent.
 *   - "Cancelar" asks to be closed and sends nothing.
 *   - With another generated form of the same graphic on the page, the editor's fields
 *     are its own: typing into one does not touch the other form's field of that name.
 *
 * What these tests deliberately do not cover:
 *   - A new item before a graphic is chosen ("Escolha um gráfico…", the save buttons
 *     off, no fields): ItemEditorPanelNoGraphicChosen.test.tsx.
 *   - A graphic other than the race clock, and changing the graphic of a new item:
 *     ItemEditorPanelOtherGraphic.test.tsx.
 *   - Editing an existing item: ItemEditorPanelEditing.test.tsx, and
 *     ItemEditorPanelUpdateOnAir.test.tsx for an item that is on air.
 *   - Field messages, a refused save and the lost connection:
 *     ItemEditorPanelProblems.test.tsx.
 *   - Every control and rule of a generated form: features/schemaForm.
 *   - The rundown that opens this panel and the real server: features/rundown and
 *     e2e/, which use the real ones.
 */
import raceClockManifest from '@bajaovrlay/race-clock/race-clock.ograf.json';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  buildEmptySchemaFormValues,
  describeSchemaFormFromDataSchema,
} from '@/features/schemaForm';
import {
  chooseOptionInDropdown,
  renderSchemaFormOnTestPage,
  typeIntoField,
} from '@/features/schemaForm/schemaFormOnTestPage.testSupport';

import {
  chooseGraphicInTheEditor,
  pressSaveAndWaitForCommand,
  raceClockGraphicName,
  renderItemEditorPanelForNewRaceClockItem,
  renderItemEditorPanelOnFakeServer,
} from './itemEditorOnFakeServer.testSupport';
import {
  raceClockLapsLabel,
  raceClockReferenceMomentLabel,
  raceClockReferenceTimeLabel,
} from './itemsLikeTheEditorSaves.testSupport';

describe('the item editor panel for a new item', () => {
  it('opens titled "Novo item" with an empty label, the neutral colour, no notes and no auto-out', () => {
    // Arrange: a connected page that knows the race clock and the interview lower third.

    // Act: draw the editor for a new item.
    renderItemEditorPanelOnFakeServer(null);

    // Assert: the panel is a named region titled "Novo item", with every field at its
    // start. (The graphic, chosen by nobody yet: ItemEditorPanelNoGraphicChosen.test.tsx.)
    const editorPanel = screen.getByRole('region', { name: 'Editor de item' });
    expect(
      within(editorPanel).getByRole('heading', { name: 'Novo item' }),
      'the panel must say it is preparing a new item',
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Item salvo — vale para os próximos disparos'),
      'a new item is not saved yet, so its header must not say it is',
    ).toBeNull();
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
  });

  it("draws the race clock's fields generated from its manifest, at the manifest's defaults, once it is chosen", () => {
    // Arrange: the editor for a new item.
    renderItemEditorPanelOnFakeServer(null);

    // Act: choose the race clock by name.
    chooseGraphicInTheEditor(raceClockGraphicName);

    // Assert: the layer moved to the clock's default, and the fields the manifest
    // describes are there, each at its default. The reference moment is not typed: it
    // is left for the server to stamp at the take.
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
      'the session name must start as the manifest default',
    ).toHaveValue('Enduro de Resistência');
    expect(
      screen.getByRole('combobox', { name: 'Bandeira' }),
      'the flag must start as "Pré-largada"',
    ).toHaveTextContent('Pré-largada');
    expect(
      screen.getByRole('combobox', { name: 'Modo do relógio' }),
      'the clock mode must start as "Tempo decorrido"',
    ).toHaveTextContent('Tempo decorrido');
    expect(
      screen.getByLabelText(raceClockReferenceTimeLabel),
      'the reference time must be typed as mm:ss and start at zero',
    ).toHaveValue('0:00');
    expect(
      screen.getByRole('switch', { name: 'Relógio correndo' }),
      'the clock must start stopped',
    ).not.toBeChecked();
    expect(
      screen.getByLabelText(raceClockLapsLabel),
      'the laps are optional and must start blank',
    ).toHaveValue(null);
    expect(
      screen.getByRole('combobox', { name: `Como preencher ${raceClockReferenceMomentLabel}` }),
      'the reference moment of a new item must start as "filled at the take"',
    ).toHaveTextContent('Momento da entrada no ar');
    expect(
      screen.queryByText(/Editor genérico chega em BAJAOVRLAY-14/),
      'the notice that promised the generated form must be gone',
    ).toBeNull();
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
    // Arrange: the editor on the race clock, filled for the start of the endurance
    // race: the clock stopped at 240:00 and counting down, green in the rundown, off
    // air by itself after 90 s.
    const { fakeServer, onClose } = renderItemEditorPanelForNewRaceClockItem();
    typeIntoField('Rótulo', 'Largada do Enduro');
    chooseOptionInDropdown('Cor', 'Sucesso');
    typeIntoField('Observações', 'Entrar quando os carros alinharem.');
    typeIntoField('Saída automática (segundos, opcional)', '90');
    typeIntoField('Título', 'Enduro de Resistência — Largada');
    chooseOptionInDropdown('Modo do relógio', 'Tempo restante');
    typeIntoField(raceClockReferenceTimeLabel, '240:00');

    // Act: press "Salvar item", and then the server accepts the command.
    await pressSaveAndWaitForCommand(1, fakeServer);
    const timesClosedBeforeTheServerAnswered = onClose.mock.calls.length;
    fakeServer.acceptLastCommand();

    // Assert: one createItem for the main session's rundown with the form as literals
    // (240:00 is 14 400 000 ms, 90 s is 90 000 ms). The clock's reference moment is not
    // a number: it is left for the server to stamp when the item is taken. The blank
    // laps are not in the fields at all; the band switch is stored at its default, on.
    expect(
      fakeServer.listCommandsReceived(),
      'the press must send exactly one createItem carrying the whole form',
    ).toEqual([
      {
        type: 'createItem',
        home: { kind: 'rundown', rundownId: 'sessao-principal' },
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
          referenceWallClockMs: { kind: 'takeTime' },
          running: { kind: 'literal', value: false },
          showFlagBand: { kind: 'literal', value: true },
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

  it('saves a reference moment switched to "Valor digitado" as the number that was typed', async () => {
    // Arrange: a new clock item whose operator wants the clock to count from a fixed
    // instant, the official start at 10:00 in Brasília on race day, whenever it is taken.
    const officialStartInMilliseconds = Date.parse('2026-10-10T13:00:00.000Z');
    const { fakeServer } = renderItemEditorPanelForNewRaceClockItem();
    typeIntoField('Rótulo', 'Relógio desde a largada oficial');

    // Act: switch the reference moment to a typed value, type the instant and save.
    chooseOptionInDropdown(`Como preencher ${raceClockReferenceMomentLabel}`, 'Valor digitado');
    typeIntoField(raceClockReferenceMomentLabel, String(officialStartInMilliseconds));
    await pressSaveAndWaitForCommand(1, fakeServer);

    // Assert: the item stores the typed number as a literal, not "the moment of the take".
    expect(
      fakeServer.listCommandsReceived()[0],
      'a typed reference moment must be stored as that number',
    ).toMatchObject({
      type: 'createItem',
      fields: {
        referenceWallClockMs: { kind: 'literal', value: officialStartInMilliseconds },
      },
    });
    // (Then the server answers, so no command is left waiting for its 5-second timeout.)
    fakeServer.acceptLastCommand();
  });

  it('sends the layer the operator chose by hand instead of the default one', async () => {
    // Arrange: a new race clock item that the operator wants on the full-screen layer.
    const { fakeServer } = renderItemEditorPanelForNewRaceClockItem();
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
    const { fakeServer, onClose } = renderItemEditorPanelForNewRaceClockItem();
    typeIntoField('Rótulo', 'Largada do Enduro');

    // Act: press "Cancelar".
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    // Assert: the panel asked to be closed once, and the server heard nothing.
    expect(onClose, '"Cancelar" must ask to be closed').toHaveBeenCalledTimes(1);
    expect(fakeServer.listCommandsReceived(), '"Cancelar" must not send any command').toEqual([]);
  });
});

describe('the item editor panel on the same page as another generated form', () => {
  it('keeps its fields apart from the fields of the same name in the other form', () => {
    // Arrange: the page as the operator has it: the editor for a new race clock item
    // and, beside it, another form generated from the race clock's manifest (on the
    // real page that is "Edição rápida"; here a plain generated form stands in for it).
    // Both draw a "Título" field.
    renderItemEditorPanelForNewRaceClockItem();
    const raceClockFormDescription = describeSchemaFormFromDataSchema(raceClockManifest.schema);
    renderSchemaFormOnTestPage({
      description: raceClockFormDescription,
      formValues: buildEmptySchemaFormValues(raceClockFormDescription),
    });
    const editorPanel = screen.getByRole('region', { name: 'Editor de item' });
    const sessionNameFields = screen.getAllByLabelText('Título');
    const sessionNameFieldOfTheEditor = within(editorPanel).getByLabelText('Título');

    // Act: type a session name into the editor's field.
    fireEvent.change(sessionNameFieldOfTheEditor, { target: { value: 'Enduro — Bateria 2' } });

    // Assert: there are two separate fields, and only the editor's one changed. (With
    // equal ids, the editor's label would point at the other form's field instead.)
    const sessionNameFieldOfTheOtherForm = sessionNameFields.find(
      (sessionNameField) => sessionNameField !== sessionNameFieldOfTheEditor,
    );
    expect(sessionNameFields, 'each form must have its own session name field').toHaveLength(2);
    expect(
      sessionNameFieldOfTheEditor,
      'the editor field must hold what was typed into it',
    ).toHaveValue('Enduro — Bateria 2');
    expect(
      sessionNameFieldOfTheOtherForm,
      'the field of the other form must be left as it was',
    ).toHaveValue('Enduro de Resistência');
  });
});
