/**
 * The macro editor (apps/control)
 *
 * What this module is for:
 *   The macro editor prepares a new macro or changes a stored one: a label, a colour and a
 *   vertical list of steps, each with a kind and what that kind needs (an item picked by
 *   label, a layer picked by name, nothing for "Limpar tudo", a wait typed in seconds).
 *   Steps are added with "+ Passo", removed with their "Remover" and put in a new order by
 *   dragging their handle (dnd-kit, as the rundown). "Salvar macro" sends createMacro or
 *   updateMacro; "Excluir macro", pressed twice, sends deleteMacro.
 *
 * What these tests prove:
 *   - Building "Abrir a sessão" in the editor (clock on, wait 0,5 s, logo on, clear the
 *     lower third) sends createMacro with exactly those steps, in that order.
 *   - A missing label, a step without its item and a wrong wait are refused with pt-BR
 *     messages and nothing is sent.
 *   - "Remover" takes a step out, and a keyboard drag puts a step in a new place; the
 *     saved steps follow the list on screen.
 *   - A stored macro saved with a new label sends updateMacro with the label only, and the
 *     editor closes once the server accepts.
 *   - "Excluir macro" asks for a second press, then sends deleteMacro.
 *
 * What these tests deliberately do not cover:
 *   - Every way a row becomes a step, and the wait's limits: macroStepDrafts.test.ts.
 *   - Which parts an update carries: macroCommandsFromEditor.test.ts.
 *   - Dragging with the mouse: dnd-kit's, checked by hand in the browser.
 */
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import {
  bajaLogoItemId,
  buildSlicesWithShortcutsAndMacros,
  buildTwoMacros,
  enduranceClockItemId,
} from '@/state/quickFireLikeTheServerSends.testSupport';

import { MacroEditorPanel } from './MacroEditorPanel';

// The drag test replaces a browser function; this puts the real one back after each test.
afterEach(() => {
  vi.restoreAllMocks();
});

/** Draws the editor on a connected page, for a new macro or for `macroBeingEdited`. */
function renderMacroEditor(macroBeingEdited: ReturnType<typeof buildTwoMacros>[number] | null) {
  const onClose = vi.fn<() => void>();
  const controlPage = renderOnControlPageConnectedToFakeServer(
    <MacroEditorPanel macroBeingEdited={macroBeingEdited} onClose={onClose} />,
    buildSlicesWithShortcutsAndMacros(),
  );
  return { ...controlPage, onClose };
}

/** Opens a dropdown found by its accessible name and picks one of its options. */
function chooseOption(dropdownName: string, optionName: string): void {
  fireEvent.keyDown(screen.getByRole('combobox', { name: dropdownName }), { key: 'Enter' });
  fireEvent.click(screen.getByRole('option', { name: optionName }));
}

/** Presses "+ Passo" and gives the new step (number `stepNumber`) its kind. */
function addStepOfKind(stepNumber: number, kindName: string): void {
  fireEvent.click(screen.getByRole('button', { name: '+ Passo' }));
  chooseOption(`Tipo do passo ${stepNumber}`, kindName);
}

describe('building a new macro', () => {
  it('sends createMacro with the steps exactly as listed', () => {
    // Arrange: the editor for a new macro.
    const { fakeServer } = renderMacroEditor(null);

    // Act: name it, colour it, add four steps, and save.
    fireEvent.change(screen.getByLabelText('Rótulo da macro'), {
      target: { value: 'Abrir a sessão' },
    });
    chooseOption('Cor da macro', 'Sucesso');
    addStepOfKind(1, 'Pôr item no ar');
    chooseOption('Item do passo 1', 'Relógio do enduro (Atalhos)');
    addStepOfKind(2, 'Esperar');
    fireEvent.change(screen.getByLabelText('Espera do passo 2 (segundos)'), {
      target: { value: '0,5' },
    });
    addStepOfKind(3, 'Pôr item no ar');
    chooseOption('Item do passo 3', 'Logo Baja (Atalhos)');
    addStepOfKind(4, 'Limpar camada');
    chooseOption('Camada do passo 4', 'Tarja');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar macro' }));

    // Assert: one createMacro, its steps in the order on screen.
    expect(
      fakeServer.listCommandsReceived(),
      'the macro must be sent with exactly the steps listed, in order',
    ).toEqual([
      {
        type: 'createMacro',
        label: 'Abrir a sessão',
        color: 'success',
        steps: [
          { kind: 'takeItem', itemId: enduranceClockItemId },
          { kind: 'wait', ms: 500 },
          { kind: 'takeItem', itemId: bajaLogoItemId },
          { kind: 'clearLayer', layerId: 'lower-third' },
        ],
      },
    ]);
  });

  it('refuses a missing label, a step without its item and a wrong wait, and sends nothing', () => {
    // Arrange: the editor for a new macro, with a take that has no item and a long wait.
    const { fakeServer } = renderMacroEditor(null);
    addStepOfKind(1, 'Pôr item no ar');
    addStepOfKind(2, 'Esperar');
    fireEvent.change(screen.getByLabelText('Espera do passo 2 (segundos)'), {
      target: { value: '12' },
    });

    // Act: save without a label.
    fireEvent.click(screen.getByRole('button', { name: 'Salvar macro' }));

    // Assert: three messages, nothing sent.
    expect(
      screen.getByText('Informe o rótulo da macro.'),
      'a missing label must be named',
    ).toBeVisible();
    expect(
      within(screen.getByRole('listitem', { name: 'Passo 1' })).getByText(
        'Escolha o item deste passo.',
      ),
      'the step without an item must say so on its own row',
    ).toBeVisible();
    expect(
      within(screen.getByRole('listitem', { name: 'Passo 2' })).getByText(
        'Informe a espera em segundos, de 0,001 a 10 (por exemplo 0,5).',
      ),
      'a wait over ten seconds must be refused on its own row',
    ).toBeVisible();
    expect(fakeServer.listCommandsReceived(), 'nothing may be sent while a part is wrong').toEqual(
      [],
    );
  });

  it('leaves a removed step out of the saved macro', () => {
    // Arrange: a macro of two steps, "Limpar tudo" then a wait.
    const { fakeServer } = renderMacroEditor(null);
    fireEvent.change(screen.getByLabelText('Rótulo da macro'), {
      target: { value: 'Limpar e esperar' },
    });
    addStepOfKind(1, 'Limpar tudo');
    addStepOfKind(2, 'Esperar');
    fireEvent.change(screen.getByLabelText('Espera do passo 2 (segundos)'), {
      target: { value: '1' },
    });

    // Act: remove the first step and save.
    fireEvent.click(screen.getByRole('button', { name: 'Remover passo 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar macro' }));

    // Assert: only the wait is saved.
    expect(fakeServer.listCommandsReceived(), 'a removed step must not be saved').toEqual([
      {
        type: 'createMacro',
        label: 'Limpar e esperar',
        color: 'neutral',
        steps: [{ kind: 'wait', ms: 1000 }],
      },
    ]);
  });
});

describe('changing a stored macro', () => {
  it('sends updateMacro with the new label only and closes once the server accepts', async () => {
    // Arrange: the editor for "Abrir a sessão".
    const [openTheSession] = buildTwoMacros();
    const { fakeServer, onClose } = renderMacroEditor(openTheSession ?? null);

    // Act: rename it, save, and the server accepts.
    fireEvent.change(screen.getByLabelText('Rótulo da macro'), {
      target: { value: 'Abrir a bateria' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar macro' }));
    fakeServer.acceptLastCommand();

    // Assert: the label alone was sent, and the editor asked to close.
    expect(
      fakeServer.listCommandsReceived(),
      'only the label changed, so only the label may be sent',
    ).toEqual([{ type: 'updateMacro', macroId: 'macro-abrir-sessao', label: 'Abrir a bateria' }]);
    await waitFor(() => {
      expect(onClose, 'the editor must close once the server accepted').toHaveBeenCalledTimes(1);
    });
  });

  it('puts a step in a new place with a keyboard drag of its handle', async () => {
    // Arrange: the editor for "Abrir a sessão" (clock, wait, logo), each row given a
    // place on screen 60 px under the one before, which dnd-kit reads.
    vi.useFakeTimers();
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element,
    ) {
      const rowsOnScreen = Array.from(document.querySelectorAll('li'));
      const rowOfThisElement = this.closest('li');
      const rowIndex = rowOfThisElement === null ? 0 : rowsOnScreen.indexOf(rowOfThisElement);
      return new DOMRect(0, rowIndex * 60, 320, 60);
    });
    const [openTheSession] = buildTwoMacros();
    const { fakeServer } = renderMacroEditor(openTheSession ?? null);
    const handleOfTheFirstStep = screen.getByRole('button', { name: 'Mover passo 1' });

    // Act: pick the first step up, move it one row down, drop it, and save.
    for (const keyCode of ['Space', 'ArrowDown', 'Space']) {
      await act(async () => {
        fireEvent.keyDown(handleOfTheFirstStep, {
          code: keyCode,
          key: keyCode === 'Space' ? ' ' : keyCode,
        });
        await vi.advanceTimersByTimeAsync(20);
      });
    }
    fireEvent.click(screen.getByRole('button', { name: 'Salvar macro' }));

    // Assert: the wait now comes first, and the whole new list is sent.
    expect(
      fakeServer.listCommandsReceived(),
      'the saved steps must follow the new order on screen',
    ).toEqual([
      {
        type: 'updateMacro',
        macroId: 'macro-abrir-sessao',
        steps: [
          { kind: 'wait', ms: 500 },
          { kind: 'takeItem', itemId: enduranceClockItemId },
          { kind: 'takeItem', itemId: bajaLogoItemId },
        ],
      },
    ]);
  });

  it('deletes the macro at the second press of "Excluir macro"', () => {
    // Arrange: the editor for "Fechar a sessão".
    const [, closeTheSession] = buildTwoMacros();
    const { fakeServer } = renderMacroEditor(closeTheSession ?? null);

    // Act: press "Excluir macro", then "Confirmar: excluir macro".
    fireEvent.click(screen.getByRole('button', { name: 'Excluir macro' }));
    const commandsAfterTheFirstPress = fakeServer.listCommandsReceived().length;
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar: excluir macro' }));

    // Assert: nothing at the first press, deleteMacro at the second.
    expect(commandsAfterTheFirstPress, 'the first press must only arm the button').toBe(0);
    expect(fakeServer.listCommandsReceived(), 'the second press must delete the macro').toEqual([
      { type: 'deleteMacro', macroId: 'macro-fechar-sessao' },
    ]);
  });
});
