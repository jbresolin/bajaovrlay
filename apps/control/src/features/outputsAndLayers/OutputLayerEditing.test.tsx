/**
 * "Saídas e camadas": the layers of an output (apps/control)
 *
 * What this module is for:
 *   Each output card lists its layers bottom to top. The operator adds one (it goes on
 *   top), renames it, says whether it stays on air across items, deletes it with two
 *   presses, and drags it to another place, with the mouse or from the keyboard, as the
 *   rundown's rows are dragged (BAJAOVRLAY-49). Every press is a command; the list only
 *   moves when the server's next layers slice says so.
 *
 * What these tests prove:
 *   - "Adicionar camada" sends createLayer on that output, on top of it (ten above its
 *     top layer), with an id made on the page.
 *   - "Salvar nome" sends updateLayer with the new name; the switch sends the new
 *     "persistent"; the replace-policy dropdown sends the policy chosen.
 *   - "Excluir" sends deleteLayer at the second press only; while armed it warns how many
 *     graphics default to the layer, naming the fallback layer by the name it has now.
 *   - A refusal of a delete shows the server's reason, which names what uses the layer.
 *   - A drag with the keyboard and one with the mouse each send one reorderLayers with
 *     the output's layers bottom to top in the new order; a drop where the row started
 *     sends nothing.
 *
 * How, and why this way:
 *   As in the rundown's reorder tests, jsdom draws nothing, so the test tells it where
 *   each row is (60 px tall, one under the other), and moves the page's clock by hand past
 *   dnd-kit's own timers instead of waiting.
 *
 * What these tests deliberately do not cover:
 *   - The outputs themselves; OutputsAndLayersPage.test.tsx.
 */
import { act, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import { buildSlicesWithThePipOutput } from '@/state/outputsLikeTheServerSends.testSupport';

import { OutputsAndLayersPage } from './OutputsAndLayersPage';

const heightOfOneRowInPixels = 60;
const widthOfTheCardInPixels = 600;

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

/** The page with program and PiP, connected to a fake server. */
function renderThePageWithThePip() {
  return renderOnControlPageConnectedToFakeServer(
    <OutputsAndLayersPage />,
    buildSlicesWithThePipOutput(),
  );
}

/** The card of one output, found by its name. */
function findCardOfOutput(outputName: string) {
  return within(screen.getByRole('region', { name: outputName }));
}

/** The row of one layer in one output's card. */
function findRowOfLayer(outputName: string, layerName: string) {
  return within(findCardOfOutput(outputName).getByRole('listitem', { name: layerName }));
}

/**
 * Tells the test browser where each layer row is: within its own list, the first at the
 * top and each next one 60 px lower. Freezes the page's clock for dnd-kit's timers.
 */
function prepareThePageForADrag(): void {
  vi.useFakeTimers();
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const rowOfThisElement = this.closest('li');
    const rowsOfItsList = rowOfThisElement?.parentElement?.querySelectorAll(':scope > li') ?? [];
    const rowIndex =
      rowOfThisElement === null ? 0 : Array.from(rowsOfItsList).indexOf(rowOfThisElement);
    return new DOMRect(
      0,
      rowIndex * heightOfOneRowInPixels,
      widthOfTheCardInPixels,
      heightOfOneRowInPixels,
    );
  });
}

/** Presses one key on a handle and moves the page's clock past dnd-kit's 20 ms. */
async function pressKeyOnHandle(handle: HTMLElement, keyCode: string): Promise<void> {
  const keyAsTheBrowserNamesIt = keyCode === 'Space' ? ' ' : keyCode;
  await act(async () => {
    fireEvent.keyDown(handle, { code: keyCode, key: keyAsTheBrowserNamesIt });
    await vi.advanceTimersByTimeAsync(20);
  });
}

/** Sends one pointer event and moves the page's clock past dnd-kit's timers. */
async function sendPointerEvent(sendEvent: () => void): Promise<void> {
  await act(async () => {
    sendEvent();
    await vi.advanceTimersByTimeAsync(20);
  });
}

describe('adding and editing a layer', () => {
  it('sends createLayer on top of the output, with an id made on the page', () => {
    // Arrange: the page; the PiP's top layer is the caption, at 20.
    const { fakeServer } = renderThePageWithThePip();
    const card = findCardOfOutput('PiP');

    // Act: add "Placar" to the PiP.
    fireEvent.change(card.getByRole('textbox', { name: 'Nome da nova camada de PiP' }), {
      target: { value: 'Placar' },
    });
    fireEvent.click(card.getByRole('button', { name: 'Adicionar camada' }));

    // Assert: one createLayer at 30, with the page's id.
    expect(fakeServer.listCommandsReceived(), 'one createLayer on top of the PiP').toEqual([
      {
        type: 'createLayer',
        layerId: expect.stringMatching(/^[0-9a-f-]{36}$/),
        outputId: 'pip',
        name: 'Placar',
        zIndex: 30,
        replacePolicy: 'out-then-in',
        persistent: false,
      },
    ]);
  });

  it('sends updateLayer with the new name, and with the switch the new persistence', () => {
    // Arrange: the page.
    const { fakeServer } = renderThePageWithThePip();
    const captionRow = findRowOfLayer('PiP', 'Legenda');

    // Act: rename the caption, then flip "Fica no ar entre itens" on.
    fireEvent.change(captionRow.getByRole('textbox', { name: 'Nome da camada Legenda' }), {
      target: { value: 'Legenda ao vivo' },
    });
    fireEvent.click(captionRow.getByRole('button', { name: 'Salvar nome' }));
    fireEvent.click(captionRow.getByRole('switch', { name: 'Fica no ar entre itens' }));

    // Assert: two updateLayer, each carrying only what changed.
    expect(fakeServer.listCommandsReceived(), 'the name, then the persistence').toEqual([
      { type: 'updateLayer', layerId: 'legenda-pip', name: 'Legenda ao vivo' },
      { type: 'updateLayer', layerId: 'legenda-pip', persistent: true },
    ]);
  });
});

describe('the replace policy of a layer', () => {
  it('sends updateLayer with the policy chosen', () => {
    // Arrange: the page; the caption swaps "out-then-in".
    const { fakeServer } = renderThePageWithThePip();
    const captionRow = findRowOfLayer('PiP', 'Legenda');

    // Act: choose "Corte seco" in the caption's dropdown.
    fireEvent.keyDown(captionRow.getByRole('combobox', { name: 'Troca de gráfico em Legenda' }), {
      key: 'Enter',
    });
    fireEvent.click(screen.getByRole('option', { name: 'Corte seco' }));

    // Assert: one updateLayer carrying the cut.
    expect(fakeServer.listCommandsReceived(), 'the policy chosen').toEqual([
      { type: 'updateLayer', layerId: 'legenda-pip', replacePolicy: 'cut' },
    ]);
  });
});

describe('deleting a layer', () => {
  it('sends deleteLayer at the second press, warning about the graphics that default to it', () => {
    // Arrange: the page; the race clock defaults to program's clock layer.
    const { fakeServer } = renderThePageWithThePip();
    const clockRow = findRowOfLayer('Programa', 'Relógio');

    // Act: press "Excluir" once, look, then confirm.
    fireEvent.click(clockRow.getByRole('button', { name: 'Excluir' }));
    const commandsAfterTheFirstPress = fakeServer.listCommandsReceived();
    const isWarningShownWhileArmed =
      clockRow.queryByText(
        '1 gráfico usa esta camada como padrão; ele passa a usar a camada Tela cheia.',
      ) !== null;
    fireEvent.click(clockRow.getByRole('button', { name: 'Confirmar: excluir' }));

    // Assert: nothing at first, the warning while armed, deleteLayer at the second press.
    expect(commandsAfterTheFirstPress, 'one press only arms the button').toEqual([]);
    expect(isWarningShownWhileArmed, 'the armed button warns about the graphic').toBe(true);
    expect(fakeServer.listCommandsReceived(), 'the second press deletes').toEqual([
      { type: 'deleteLayer', layerId: 'clock' },
    ]);
  });

  it('names the fallback layer by the name it has now, after "a camada" whatever its gender', () => {
    // Arrange: the page with the fullscreen layer renamed "Quadro cheio", a masculine name.
    const slices = buildSlicesWithThePipOutput();
    slices.layers = slices.layers.map((layer) =>
      layer.id === 'fullscreen' ? { ...layer, name: 'Quadro cheio' } : layer,
    );
    renderOnControlPageConnectedToFakeServer(<OutputsAndLayersPage />, slices);
    const clockRow = findRowOfLayer('Programa', 'Relógio');

    // Act: arm "Excluir" on the clock layer, which the race clock defaults to.
    fireEvent.click(clockRow.getByRole('button', { name: 'Excluir' }));

    // Assert: the warning names the layer the graphic will really use.
    expect(
      clockRow.getByText(
        '1 gráfico usa esta camada como padrão; ele passa a usar a camada Quadro cheio.',
      ),
      'the warning names the fallback layer as it is called now',
    ).toBeInTheDocument();
  });

  it("shows the server's reason, which names what uses the layer", async () => {
    // Arrange: the caption's delete confirmed.
    const { fakeServer } = renderThePageWithThePip();
    const captionRow = findRowOfLayer('PiP', 'Legenda');
    fireEvent.click(captionRow.getByRole('button', { name: 'Excluir' }));
    fireEvent.click(captionRow.getByRole('button', { name: 'Confirmar: excluir' }));

    // Act: the server refuses it.
    await act(async () => {
      fakeServer.refuseLastCommand({
        code: 'LAYER_IN_USE',
        message:
          'A camada "Legenda" não pode ser excluída. Usada por 1 item: "Legenda PiP — Baja UFPR"; 1 macro: "Fechar PiP". Mude ou exclua o que usa a camada antes.',
      });
    });

    // Assert: the PiP's card shows the whole reason.
    expect(
      findCardOfOutput('PiP').getByRole('alert'),
      'the reason lists the uses',
    ).toHaveTextContent('Usada por 1 item: "Legenda PiP — Baja UFPR"; 1 macro: "Fechar PiP".');
  });
});

describe('reordering the layers by drag', () => {
  it('sends reorderLayers bottom to top after a keyboard drag', async () => {
    // Arrange: the PiP's frame under its caption, each row given a place.
    prepareThePageForADrag();
    const { fakeServer } = renderThePageWithThePip();
    const frameHandle = findRowOfLayer('PiP', 'Moldura').getByRole('button', { name: 'Mover' });

    // Act: pick the frame up, move it one row down, drop it.
    await pressKeyOnHandle(frameHandle, 'Space');
    await pressKeyOnHandle(frameHandle, 'ArrowDown');
    await pressKeyOnHandle(frameHandle, 'Space');

    // Assert: the caption now first (bottom), the frame on top.
    expect(fakeServer.listCommandsReceived(), 'one reorderLayers of the PiP').toEqual([
      { type: 'reorderLayers', outputId: 'pip', orderedLayerIds: ['legenda-pip', 'moldura-pip'] },
    ]);
  });

  it('sends reorderLayers after a mouse drag', async () => {
    // Arrange: the same PiP, each row given a place.
    prepareThePageForADrag();
    const { fakeServer } = renderThePageWithThePip();
    const frameHandle = findRowOfLayer('PiP', 'Moldura').getByRole('button', { name: 'Mover' });

    // Act: press on the frame's handle, move the mouse a row and a half down, let go.
    await sendPointerEvent(() =>
      fireEvent.pointerDown(frameHandle, { clientX: 20, clientY: 20, isPrimary: true, button: 0 }),
    );
    await sendPointerEvent(() =>
      fireEvent.pointerMove(document, { clientX: 20, clientY: 50, isPrimary: true }),
    );
    await sendPointerEvent(() =>
      fireEvent.pointerMove(document, { clientX: 20, clientY: 90, isPrimary: true }),
    );
    await sendPointerEvent(() =>
      fireEvent.pointerUp(document, { clientX: 20, clientY: 90, isPrimary: true, button: 0 }),
    );

    // Assert: the same reorder as from the keyboard.
    expect(fakeServer.listCommandsReceived(), 'one reorderLayers of the PiP').toEqual([
      { type: 'reorderLayers', outputId: 'pip', orderedLayerIds: ['legenda-pip', 'moldura-pip'] },
    ]);
  });

  it('sends nothing for a row dropped where it started', async () => {
    // Arrange: the same PiP, each row given a place.
    prepareThePageForADrag();
    const { fakeServer } = renderThePageWithThePip();
    const frameHandle = findRowOfLayer('PiP', 'Moldura').getByRole('button', { name: 'Mover' });

    // Act: pick the frame up and drop it at once.
    await pressKeyOnHandle(frameHandle, 'Space');
    await pressKeyOnHandle(frameHandle, 'Space');

    // Assert: nothing sent.
    expect(fakeServer.listCommandsReceived(), 'no change, no command').toEqual([]);
  });
});
