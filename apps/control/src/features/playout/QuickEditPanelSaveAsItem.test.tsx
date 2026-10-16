/**
 * "Salvar como item" of "Edição rápida" (apps/control)
 *
 * What this module is for:
 *   What "Edição rápida" holds can be kept as an item, to be fired again from the rundown
 *   or a shortcut button. "Salvar como item" checks the form and opens the page's one
 *   item editor (in the rundown column) prefilled with the panel's graphic, layer and
 *   fields; the operator gives the label, may change "Onde", and saves there. Nothing is
 *   sent by the press itself.
 *
 * What these tests prove:
 *   - The press sends nothing, and opens the editor on the race clock and the layer the
 *     panel had, with the typed title.
 *   - "Salvar item" then sends createItem with that graphic, that layer and the fields
 *     in the kinds the panel showed, in the rundown on screen.
 *   - A form with a field its rules refuse opens nothing and shows the field's message.
 *
 * What these tests deliberately do not cover:
 *   - Every field kind and the choice of home: itemSavedFromQuickEdit.test.ts.
 *   - The editor's prefilled opening in general: features/items/ItemEditorPanelPrefill.test.tsx.
 */
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RundownPanel } from '@/features/rundown/RundownPanel';
import {
  chooseOptionInDropdown,
  typeIntoField,
} from '@/features/schemaForm/schemaFormOnTestPage.testSupport';
import {
  letThePageFinishWhatItStarted,
  renderOnControlPageConnectedToFakeServer,
} from '@/state/controlPageOnFakeServer.testSupport';
import { buildSlicesWithNothingOnAir } from '@/state/slicesLikeTheServerSends.testSupport';

import { QuickEditPanel } from './QuickEditPanel';

/** The rundown column (with its item editor) and "Edição rápida", nothing on air. */
function renderTheRundownAndTheQuickEditPanel() {
  return renderOnControlPageConnectedToFakeServer(
    <>
      <RundownPanel />
      <QuickEditPanel />
    </>,
    buildSlicesWithNothingOnAir(),
  );
}

describe('"Salvar como item" of "Edição rápida"', () => {
  it('opens the item editor prefilled, and "Salvar item" creates the item from it', async () => {
    // Arrange: a race clock for the qualifying, on the "Tarja" layer, typed in the panel.
    const { fakeServer } = renderTheRundownAndTheQuickEditPanel();
    chooseOptionInDropdown('Camada da nova entrada', 'Tarja');
    typeIntoField('Título', 'Classificação');

    // Act: press "Salvar como item", then give the label in the editor and save.
    fireEvent.click(screen.getByRole('button', { name: 'Salvar como item' }));
    const editor = within(await screen.findByRole('region', { name: 'Editor de item' }));
    const commandsRightAfterThePress = [...fakeServer.listCommandsReceived()];
    fireEvent.change(editor.getByLabelText('Rótulo'), {
      target: { value: 'Relógio da classificação' },
    });
    fireEvent.click(editor.getByRole('button', { name: 'Salvar item' }));
    await waitFor(() => {
      expect(
        fakeServer.listCommandsReceived(),
        '"Salvar item" must send one createItem',
      ).toHaveLength(1);
    });

    // Assert: the press itself sent nothing; the editor's save carried what the panel held.
    expect(commandsRightAfterThePress, '"Salvar como item" alone must send nothing').toEqual([]);
    expect(
      editor.getByLabelText('Título'),
      'the editor must open with the title typed in the panel',
    ).toHaveValue('Classificação');
    expect(
      fakeServer.listCommandsReceived()[0],
      'the item must keep the graphic, the layer and the fields of the panel',
    ).toEqual({
      type: 'createItem',
      home: { kind: 'rundown', rundownId: 'sessao-principal' },
      graphicId: 'race-clock',
      layerId: 'lower-third',
      label: 'Relógio da classificação',
      color: 'neutral',
      notes: '',
      fields: {
        sessionName: { kind: 'literal', value: 'Classificação' },
        state: { kind: 'literal', value: 'pre' },
        clockMode: { kind: 'literal', value: 'elapsed' },
        referenceTimeMs: { kind: 'literal', value: 0 },
        referenceWallClockMs: { kind: 'takeTime' },
        running: { kind: 'literal', value: false },
      },
    });
    fakeServer.acceptLastCommand();
  });

  it('opens nothing while a field holds a value its rules refuse', async () => {
    // Arrange: the title erased, which the race clock requires.
    const { fakeServer } = renderTheRundownAndTheQuickEditPanel();
    typeIntoField('Título', '');

    // Act: press "Salvar como item".
    fireEvent.click(screen.getByRole('button', { name: 'Salvar como item' }));
    await letThePageFinishWhatItStarted();

    // Assert: the field explains itself, no editor opened, nothing was sent.
    expect(
      await screen.findByText('O campo "Título" é obrigatório.'),
      'the missing title must be explained under its field',
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('region', { name: 'Editor de item' }),
      'an item must not be prepared from a form that fails its rules',
    ).toBeNull();
    expect(fakeServer.listCommandsReceived(), 'nothing may be sent').toEqual([]);
  });
});
