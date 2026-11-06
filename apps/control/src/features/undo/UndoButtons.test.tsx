/**
 * "Desfazer", "Desfazer última" and Ctrl+Z (apps/control)
 *
 * What this module is for:
 *   A wrong take, or a wrong "Limpar", is put right with one press (concept §7 rule 5,
 *   BAJAOVRLAY-30). The server remembers what each layer showed before its last changes
 *   (the programHistory slice); the page only offers the presses and says, before the
 *   press, what will come back: "Desfazer" on each Camadas row that has something to undo
 *   (undoOnLayer), and "Desfazer última" beside "Limpar tudo", always on screen
 *   (undoLastChangeOnProgram), also on Ctrl+Z.
 *
 * What these tests prove (the page wired as in the browser, on a fake server):
 *   - A row with history offers "Desfazer", whose tooltip names the item that comes back,
 *     or says the layer comes back empty; the press sends undoOnLayer for that layer.
 *   - A row with no history offers no "Desfazer".
 *   - "Desfazer última" names in its tooltip every layer the newest change touched and
 *     what comes back on each; its press sends undoLastChangeOnProgram.
 *   - With nothing to undo, "Desfazer última" stays on screen, off, saying why.
 *   - Ctrl+Z sends undoLastChangeOnProgram; in a text field it is left to the field, and
 *     Ctrl+Shift+Z (a redo elsewhere) sends nothing.
 *
 * What these tests deliberately do not cover:
 *   - What the server puts back and what it refuses; apps/server's undoOnProgram.test.ts.
 *   - A refusal's message under Camadas; CommandErrorMessage shows it as for every command.
 */
import type { Item, ProgramHistory, Slices } from '@bajaovrlay/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  buildEnduranceStartClockItem,
  buildInterviewLowerThirdItem,
  buildSlicesWithTheRaceClockAndTheLowerThird,
} from '@/features/items/itemsLikeTheEditorSaves.testSupport';
import { LayerStatusPanel } from '@/features/layers/LayerStatusPanel';
import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';

import { UndoLastChangeButton } from './UndoLastChangeButton';

/**
 * What the server remembers after the start clock was taken (at 14:00, change 1) and
 * then, at 14:05 (change 2), "Limpar tudo" took the clock and the interview lower third
 * off; before change 2 the lower third had been taken over an empty layer (change 1 too).
 */
function buildHistoryAfterAClearAllOfTheClockAndTheLowerThird(): ProgramHistory {
  const startClockItem = buildEnduranceStartClockItem();
  const interviewItem = buildInterviewLowerThirdItem();
  return [
    {
      layerId: 'clock',
      entries: [
        { changeNumber: 1, changedAt: '2026-10-10T14:00:00.000Z', shownBefore: { kind: 'empty' } },
        {
          changeNumber: 2,
          changedAt: '2026-10-10T14:05:00.000Z',
          shownBefore: {
            kind: 'item',
            itemId: startClockItem.id,
            graphicId: startClockItem.graphicId,
            itemLabel: startClockItem.label,
            typedValues: { sessionName: 'Enduro de Resistência' },
          },
        },
      ],
    },
    {
      layerId: 'lower-third',
      entries: [
        { changeNumber: 1, changedAt: '2026-10-10T14:00:00.000Z', shownBefore: { kind: 'empty' } },
        {
          changeNumber: 2,
          changedAt: '2026-10-10T14:05:00.000Z',
          shownBefore: {
            kind: 'item',
            itemId: interviewItem.id,
            graphicId: interviewItem.graphicId,
            itemLabel: interviewItem.label,
            typedValues: { nome: 'Ana Souza', cargo: 'Capitã' },
          },
        },
      ],
    },
  ];
}

/** The page's slices with the two items prepared and the given history, nothing on air. */
function buildSlicesWithHistory(programHistory: ProgramHistory): Slices {
  const items: Item[] = [buildEnduranceStartClockItem(), buildInterviewLowerThirdItem()];
  return { ...buildSlicesWithTheRaceClockAndTheLowerThird(), items, programHistory };
}

/** Draws Camadas and "Desfazer última" together, as the console does. */
function renderCamadasWithUndo(programHistory: ProgramHistory) {
  return renderOnControlPageConnectedToFakeServer(
    <>
      <LayerStatusPanel />
      <UndoLastChangeButton />
    </>,
    buildSlicesWithHistory(programHistory),
  );
}

/** The Camadas row of one layer. */
function findLayerRow(layerName: string) {
  return within(screen.getByRole('listitem', { name: layerName }));
}

/** Reads the tooltip a button opens when the keyboard reaches it. */
async function readTooltipOf(button: HTMLElement): Promise<string> {
  fireEvent.focus(button);
  const tooltip = await waitFor(() => screen.getByRole('tooltip'));
  return tooltip.textContent ?? '';
}

describe('"Desfazer" on a Camadas row', () => {
  it('names in its tooltip the item that comes back', async () => {
    // Arrange: the history after "Limpar tudo" took the interview lower third off.
    renderCamadasWithUndo(buildHistoryAfterAClearAllOfTheClockAndTheLowerThird());

    // Act: reach the "Tarja" row's "Desfazer" with the keyboard.
    const tooltipText = await readTooltipOf(
      findLayerRow('Tarja').getByRole('button', { name: 'Desfazer' }),
    );

    // Assert: the tooltip names the item, as the rundown names it.
    expect(tooltipText, 'the operator must know what comes back before pressing').toContain(
      'Volta: "Tarja da equipe 42"',
    );
  });

  it('says the layer comes back empty when it showed nothing before', async () => {
    // Arrange: only the take of the lower third over an empty layer is remembered.
    const historyOfOneTake: ProgramHistory = [
      {
        layerId: 'lower-third',
        entries: [
          {
            changeNumber: 1,
            changedAt: '2026-10-10T14:00:00.000Z',
            shownBefore: { kind: 'empty' },
          },
        ],
      },
    ];
    renderCamadasWithUndo(historyOfOneTake);

    // Act: reach the "Tarja" row's "Desfazer" with the keyboard.
    const tooltipText = await readTooltipOf(
      findLayerRow('Tarja').getByRole('button', { name: 'Desfazer' }),
    );

    // Assert: the tooltip says the layer is emptied.
    expect(tooltipText, 'undoing a take on an empty layer empties it').toContain(
      'Volta: camada vazia',
    );
  });

  it('sends undoOnLayer for its layer', () => {
    // Arrange: the history after "Limpar tudo".
    const { fakeServer } = renderCamadasWithUndo(
      buildHistoryAfterAClearAllOfTheClockAndTheLowerThird(),
    );

    // Act: press "Desfazer" on the "Relógio" row.
    fireEvent.click(findLayerRow('Relógio').getByRole('button', { name: 'Desfazer' }));

    // Assert: one command, for the clock layer.
    expect(fakeServer.listCommandsReceived(), 'the undo must name the row’s layer').toEqual([
      { type: 'undoOnLayer', layerId: 'clock' },
    ]);
  });

  it('is not offered on a row with nothing to undo', () => {
    // Arrange: the history after "Limpar tudo", which never touched "Tela cheia".
    renderCamadasWithUndo(buildHistoryAfterAClearAllOfTheClockAndTheLowerThird());

    // Act: look at the "Tela cheia" row.
    const fullscreenRow = findLayerRow('Tela cheia');

    // Assert: no "Desfazer" there.
    expect(
      fullscreenRow.queryByRole('button', { name: 'Desfazer' }),
      'a layer with no change remembered has nothing to undo',
    ).toBeNull();
  });
});

describe('"Desfazer última"', () => {
  it('names every layer of the newest change and what comes back on each', async () => {
    // Arrange: the history after "Limpar tudo" of the clock and the lower third.
    renderCamadasWithUndo(buildHistoryAfterAClearAllOfTheClockAndTheLowerThird());

    // Act: reach "Desfazer última" with the keyboard.
    const tooltipText = await readTooltipOf(
      screen.getByRole('button', { name: 'Desfazer última' }),
    );

    // Assert: both layers, each with its item, in the order Camadas lists them.
    expect(tooltipText, 'one press brings back both layers "Limpar tudo" emptied').toContain(
      'Volta: Relógio: "Largada do Enduro" · Tarja: "Tarja da equipe 42"',
    );
  });

  it('sends undoLastChangeOnProgram', () => {
    // Arrange: the history after "Limpar tudo".
    const { fakeServer } = renderCamadasWithUndo(
      buildHistoryAfterAClearAllOfTheClockAndTheLowerThird(),
    );

    // Act: press "Desfazer última".
    fireEvent.click(screen.getByRole('button', { name: 'Desfazer última' }));

    // Assert: one command, with nothing to name.
    expect(fakeServer.listCommandsReceived(), 'the press must undo the newest change').toEqual([
      { type: 'undoLastChangeOnProgram' },
    ]);
  });

  it('stays on screen, off, saying why, when there is nothing to undo', () => {
    // Arrange: nothing remembered at all.
    const { fakeServer } = renderCamadasWithUndo([]);

    // Act: try to press "Desfazer última".
    const undoLastButton = screen.getByRole('button', { name: 'Desfazer última' });
    fireEvent.click(undoLastButton);

    // Assert: the button is there but off, and nothing was sent.
    expect(
      undoLastButton,
      'the button is always on screen, off with nothing to undo',
    ).toHaveProperty('disabled', true);
    expect(fakeServer.listCommandsReceived(), 'nothing to undo, nothing sent').toEqual([]);
  });
});

describe('Ctrl+Z', () => {
  it('sends undoLastChangeOnProgram', () => {
    // Arrange: the history after "Limpar tudo".
    const { fakeServer } = renderCamadasWithUndo(
      buildHistoryAfterAClearAllOfTheClockAndTheLowerThird(),
    );

    // Act: press Ctrl+Z on the page.
    fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true });

    // Assert: the same command as "Desfazer última".
    expect(fakeServer.listCommandsReceived(), 'Ctrl+Z is "Desfazer última"').toEqual([
      { type: 'undoLastChangeOnProgram' },
    ]);
  });

  const keyPressesThatSendNothing = [
    // The operator undoing their typing in a field must not undo a take.
    { name: 'leaves Ctrl+Z in a text field to the field', isInATextField: true, shiftKey: false },
    // Ctrl+Shift+Z is "redo" in most programs; there is no redo here, and no undo either.
    { name: 'sends nothing on Ctrl+Shift+Z', isInATextField: false, shiftKey: true },
  ];

  it.each(keyPressesThatSendNothing)('$name', ({ isInATextField, shiftKey }) => {
    // Arrange: the history after "Limpar tudo", and a search field on the page.
    const { fakeServer } = renderCamadasWithUndo(
      buildHistoryAfterAClearAllOfTheClockAndTheLowerThird(),
    );
    const searchField = document.createElement('input');
    document.body.append(searchField);

    // Act: press the keys, in the field or on the page.
    const target = isInATextField ? searchField : document.body;
    fireEvent.keyDown(target, { key: shiftKey ? 'Z' : 'z', ctrlKey: true, shiftKey });

    // Assert: nothing sent.
    expect(fakeServer.listCommandsReceived(), 'this press must not undo anything').toEqual([]);
    searchField.remove();
  });
});
