/**
 * Item editor panel: any graphic, not only the race clock (apps/control)
 *
 * What this module is for:
 *   A new graphic must cost no control-page code. The item editor reads the fields of
 *   whichever graphic is chosen from that graphic's manifest and draws them. These tests
 *   use a second graphic, the interview lower third ("Tarja de entrevista"), which exists
 *   only as a manifest in test support, to prove the editor needs nothing written for it.
 *
 * What these tests prove:
 *   - Choosing the lower third for a new item moves the layer to its default, takes the
 *     race clock's fields away and draws the lower third's fields at its manifest's
 *     defaults; a property the form cannot edit yet is named with a note saying so.
 *   - "Salvar item" builds the right `createItem` for it: typed values as literals, and
 *     an optional field left without a value not sent at all.
 *   - An optional field typed and then cleared with "limpar" is left out of the item.
 *   - Choosing another graphic and coming back starts that graphic's fields from its
 *     defaults again; what was typed for it before is not kept.
 *   - A stored lower third item opens with what it stores, and a change to one field
 *     sends an `updateItemFields` with that one field.
 *   - A graphic whose manifest has no data schema draws no fields and saves empty fields.
 *   - A stored item whose graphic the server no longer has says so, shows no fields of
 *     the graphic, and can still have its label changed without any field travelling.
 *
 * What these tests deliberately do not cover:
 *   - The race clock through the same generated form: ItemEditorPanel.test.tsx and
 *     ItemEditorPanelEditing.test.tsx.
 *   - Every control, default and rule of a generated form: features/schemaForm.
 *   - Whether the server accepts the values at the take (apps/server); `createItem` does
 *     not check them against the graphic.
 */
import type { Graphic, Item } from '@bajaovrlay/shared';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  chooseOptionInDropdown,
  flipSwitch,
  pressButton,
  typeIntoField,
} from '@/features/schemaForm/schemaFormOnTestPage.testSupport';

import {
  pressSaveAndWaitForCommand,
  renderItemEditorPanelOnFakeServer,
  renderItemEditorPanelOnFakeServerWithSlices,
} from './itemEditorOnFakeServer.testSupport';
import {
  buildInterviewLowerThirdItem,
  buildSlicesWithTheRaceClockAndTheLowerThird,
} from './itemsLikeTheEditorSaves.testSupport';

/** The competition's logo: a graphic that shows no data, so its manifest has no schema. */
function buildCompetitionLogoGraphic(): Graphic {
  return {
    id: 'competition-logo',
    manifest: { id: 'baja-competition-logo', name: 'Logo da competição', main: 'logo.js' },
    defaultLayerId: 'bug',
    category: 'bug',
    thumbnailUrl: null,
    defaultFields: {},
  };
}

/** An item a script stored for a sponsor board whose graphic package was later removed. */
function buildItemOfAGraphicTheServerNoLongerHas(): Item {
  return {
    id: '9a4d7e21-6c3b-4f5a-8e10-2b7c9d0f1a36',
    rundownId: 'sessao-principal',
    order: 2,
    graphicId: 'sponsor-board',
    layerId: 'fullscreen',
    fields: { sponsorName: { kind: 'literal', value: 'Autopeças Curitiba' } },
    label: 'Painel de patrocinadores',
    color: 'neutral',
    notes: '',
  };
}

describe('the item editor panel for a new item of the interview lower third', () => {
  it("moves the layer, drops the race clock's fields and draws the lower third's fields at their defaults", () => {
    // Arrange: the editor for a new item, which opens on the race clock.
    renderItemEditorPanelOnFakeServer(null);

    // Act: choose the interview lower third as the graphic.
    chooseOptionInDropdown('Gráfico', 'Tarja de entrevista');

    // Assert: the layer followed the graphic, the clock's fields are gone, and the
    // fields of the lower third's manifest are there with its defaults.
    expect(
      screen.getByRole('combobox', { name: 'Camada' }),
      "the layer must move to the new graphic's default layer",
    ).toHaveTextContent('Tarja');
    expect(
      screen.queryByLabelText('Nome da sessão'),
      "the race clock's fields must not be offered for another graphic",
    ).toBeNull();
    expect(screen.getByLabelText('Nome'), 'the name has no default and starts empty').toHaveValue(
      '',
    );
    expect(
      screen.getByRole('combobox', { name: 'Equipe' }),
      'the team must start as the manifest default, shown by its label',
    ).toHaveTextContent('Baja UFPR');
    expect(
      screen.getByLabelText('Tempo no ar'),
      'the 8 000 ms default must be shown as mm:ss',
    ).toHaveValue('0:08');
    expect(
      screen.getByRole('switch', { name: 'Destaque' }),
      'the highlight must start off, as the manifest says',
    ).not.toBeChecked();
    expect(
      screen.getAllByText('O formulário ainda não sabe editar este campo, e ele está sem valor.'),
      'the list and the nested object, which the form cannot edit yet, must each say so',
    ).toHaveLength(2);
  });

  it('builds the right createItem for the lower third, leaving out the optional fields without a value', async () => {
    // Arrange: a new item for the interview with Ana Souza, captain of Baja UFPR, car 42.
    const { fakeServer } = renderItemEditorPanelOnFakeServer(null);
    chooseOptionInDropdown('Gráfico', 'Tarja de entrevista');
    typeIntoField('Rótulo', 'Tarja da equipe 42');
    typeIntoField('Nome', 'Ana Souza');
    typeIntoField('Cargo', 'Capitã');
    typeIntoField('Tempo no ar', '0:10');
    flipSwitch('Destaque');
    typeIntoField('Número do carro', '42');

    // Act: press "Salvar item".
    await pressSaveAndWaitForCommand(1, fakeServer);

    // Assert: one createItem on the lower third's layer. Each typed value is a literal
    // (0:10 is 10 000 ms); the interview time and the car's weight were left without a
    // value and are not sent; nor are the two properties the form cannot edit.
    expect(
      fakeServer.listCommandsReceived(),
      'the press must send one createItem with the fields the manifest describes',
    ).toEqual([
      {
        type: 'createItem',
        rundownId: 'sessao-principal',
        graphicId: 'lower-third-fixture',
        layerId: 'lower-third',
        label: 'Tarja da equipe 42',
        color: 'neutral',
        notes: '',
        fields: {
          nome: { kind: 'literal', value: 'Ana Souza' },
          cargo: { kind: 'literal', value: 'Capitã' },
          equipe: { kind: 'literal', value: 'baja-ufpr' },
          duracaoMs: { kind: 'literal', value: 10_000 },
          destaque: { kind: 'literal', value: true },
          numeroDoCarro: { kind: 'literal', value: 42 },
        },
      },
    ]);
    // (Then the server answers, so no command is left waiting for its 5-second timeout.)
    fakeServer.acceptLastCommand();
  });

  it('leaves an optional field out of the item when it was typed and then cleared with "limpar"', async () => {
    // Arrange: the same new item, with a role typed by mistake.
    const { fakeServer } = renderItemEditorPanelOnFakeServer(null);
    chooseOptionInDropdown('Gráfico', 'Tarja de entrevista');
    typeIntoField('Rótulo', 'Tarja da equipe 42');
    typeIntoField('Nome', 'Ana Souza');
    typeIntoField('Número do carro', '42');
    typeIntoField('Cargo', 'Pilota');

    // Act: clear the role and save.
    pressButton('Limpar Cargo');
    await pressSaveAndWaitForCommand(1, fakeServer);

    // Assert: the item is created with no role at all, not with an empty text.
    const createItemCommand = fakeServer.listCommandsReceived()[0];
    expect(
      createItemCommand,
      'a cleared optional field must not be among the fields of a new item',
    ).not.toHaveProperty('fields.cargo');
    expect(createItemCommand, 'the fields that have a value must still be sent').toMatchObject({
      type: 'createItem',
      fields: { nome: { kind: 'literal', value: 'Ana Souza' } },
    });
    // (Then the server answers, so no command is left waiting for its 5-second timeout.)
    fakeServer.acceptLastCommand();
  });

  it('starts the fields of a graphic from its defaults again after another graphic was chosen in between', () => {
    // Arrange: a new item on the race clock, with a session name typed.
    renderItemEditorPanelOnFakeServer(null);
    typeIntoField('Nome da sessão', 'Enduro — Bateria 2');

    // Act: choose the lower third, then go back to the race clock.
    chooseOptionInDropdown('Gráfico', 'Tarja de entrevista');
    chooseOptionInDropdown('Gráfico', 'Relógio de prova');

    // Assert: the clock's fields are back at the manifest's defaults. What was typed for
    // the clock before belongs to a form that was replaced.
    expect(
      screen.getByLabelText('Nome da sessão'),
      'the fields must start from the defaults of the graphic chosen last',
    ).toHaveValue('Enduro de Resistência');
    expect(
      screen.getByRole('combobox', { name: 'Camada' }),
      "the layer must be back on the race clock's default layer",
    ).toHaveTextContent('Relógio');
  });
});

describe('the item editor panel for a stored item of the interview lower third', () => {
  it('opens with what the item stores and sends only the one field that was changed', async () => {
    // Arrange: the stored lower third of Ana Souza, open in the editor.
    const { fakeServer } = renderItemEditorPanelOnFakeServer(buildInterviewLowerThirdItem());
    const nameShownAtTheOpening = (screen.getByLabelText('Nome') as HTMLInputElement).value;
    const carNumberShownAtTheOpening = (
      screen.getByLabelText('Número do carro') as HTMLInputElement
    ).value;

    // Act: the co-pilot is interviewed instead; type his name and save.
    typeIntoField('Nome', 'Bruno Lima');
    await pressSaveAndWaitForCommand(1, fakeServer);

    // Assert: the form showed the stored values, and the update carries the name alone.
    expect(nameShownAtTheOpening, 'the name must open as the stored one').toBe('Ana Souza');
    expect(carNumberShownAtTheOpening, 'the car number must open as the stored one').toBe('42');
    expect(
      fakeServer.listCommandsReceived(),
      'the save must send one updateItemFields carrying only the changed field',
    ).toEqual([
      {
        type: 'updateItemFields',
        itemId: '5e1a9c73-2b64-4f08-b3d1-7a9e0c6d8f25',
        fields: { nome: { kind: 'literal', value: 'Bruno Lima' } },
      },
    ]);
    // (Then the server answers, so no command is left waiting for its 5-second timeout.)
    fakeServer.acceptLastCommand();
  });
});

describe('the item editor panel for a graphic whose manifest has no data schema', () => {
  it('draws no fields for the graphic and saves the item with empty fields', async () => {
    // Arrange: a server that also has the competition's logo, which shows no data.
    const slicesAfterBoot = buildSlicesWithTheRaceClockAndTheLowerThird();
    const { fakeServer } = renderItemEditorPanelOnFakeServerWithSlices(null, {
      ...slicesAfterBoot,
      graphics: [...slicesAfterBoot.graphics, buildCompetitionLogoGraphic()],
    });
    typeIntoField('Rótulo', 'Logo Baja SAE Brasil');

    // Act: choose the logo and save.
    chooseOptionInDropdown('Gráfico', 'Logo da competição');
    const isAnyClockFieldStillShown = screen.queryByLabelText('Nome da sessão') !== null;
    await pressSaveAndWaitForCommand(1, fakeServer);

    // Assert: nothing of another graphic is left on screen, and the item has no fields.
    expect(
      isAnyClockFieldStillShown,
      'a graphic without data must not show the fields of the graphic chosen before',
    ).toBe(false);
    expect(
      fakeServer.listCommandsReceived(),
      'an item of a graphic without data must be created with empty fields',
    ).toEqual([
      {
        type: 'createItem',
        rundownId: 'sessao-principal',
        graphicId: 'competition-logo',
        layerId: 'bug',
        label: 'Logo Baja SAE Brasil',
        color: 'neutral',
        notes: '',
        fields: {},
      },
    ]);
    // (Then the server answers, so no command is left waiting for its 5-second timeout.)
    fakeServer.acceptLastCommand();
  });
});

describe('the item editor panel for a stored item whose graphic the server no longer has', () => {
  it('says so, shows no fields of the graphic, and still saves a new label without any field', async () => {
    // Arrange: an item of the sponsor board, whose package is not registered any more.
    const { fakeServer } = renderItemEditorPanelOnFakeServer(
      buildItemOfAGraphicTheServerNoLongerHas(),
    );

    // Act: give the item a clearer label and save.
    typeIntoField('Rótulo', 'Painel de patrocinadores (sem gráfico)');
    await pressSaveAndWaitForCommand(1, fakeServer);

    // Assert: the notice explains the missing fields, and the update carries the label
    // alone, so the values the item stores are left exactly as they are.
    expect(
      screen.getByText(/O gráfico deste item não está registrado no servidor/),
      'the panel must say why the fields of the graphic are not shown',
    ).toBeInTheDocument();
    expect(
      fakeServer.listCommandsReceived(),
      'without a manifest no field may be sent; only the label changed',
    ).toEqual([
      {
        type: 'updateItemFields',
        itemId: '9a4d7e21-6c3b-4f5a-8e10-2b7c9d0f1a36',
        label: 'Painel de patrocinadores (sem gráfico)',
      },
    ]);
    // (Then the server answers, so no command is left waiting for its 5-second timeout.)
    fakeServer.acceptLastCommand();
  });
});
