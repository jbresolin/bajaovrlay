/**
 * "Saídas e camadas": the outputs (apps/control)
 *
 * What this module is for:
 *   The settings page (#/saidas, opened from the header's "Saídas" in a new tab) where
 *   João adds an output for an OBS scene with a picture-in-picture box, copies its
 *   renderer address into a second browser source, and edits its layers
 *   (BAJAOVRLAY-49). The page sends commands and shows the server's answer; it keeps no
 *   outputs of its own.
 *
 * What these tests prove:
 *   - Program comes first, then PiP, each with its layers bottom to top and the address
 *     to paste into OBS (program's is plain /render/).
 *   - "Adicionar saída" sends createOutput with the address suggested from the name, and
 *     the operator may type another address.
 *   - "Renomear" sends renameOutput with the new name.
 *   - "Excluir saída" sends deleteOutput at the second press only; program has no such
 *     button.
 *   - A refusal shows the server's pt-BR reason in the card that sent the command.
 *   - "Copiar" puts the address on the clipboard and says so; over plain http, where the
 *     browser offers no clipboard, it copies the selected text the older way, and says
 *     how to copy by hand when even that fails.
 *   - The header's "Saídas" link opens #/saidas in a new tab.
 *
 * What these tests deliberately do not cover:
 *   - The layers of a card (add, rename, delete, drag); OutputLayerEditing.test.tsx.
 *   - The server's rules; apps/server/src/modules/outputs.
 */
import { act, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from '@/App';
import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import { buildSlicesWithThePipOutput } from '@/state/outputsLikeTheServerSends.testSupport';

import { OutputsAndLayersPage } from './OutputsAndLayersPage';

// The copy tests replace the browser's clipboard and give the page an older copy command
// (the test browser has none); these take both away after each test so nothing leaks
// into the next.
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(document, 'execCommand');
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

/** The layer names of one output's list, as the rows read, top of the page first. */
function readLayerNamesOfOutput(outputName: string): (string | null)[] {
  const list = findCardOfOutput(outputName).getByRole('list');
  return within(list)
    .getAllByRole('listitem')
    .map((row) => row.getAttribute('aria-label'));
}

describe('the list of outputs', () => {
  it('shows program first, then PiP, each with its layers bottom to top and its address', () => {
    // Arrange and act: the page with program and PiP.
    renderThePageWithThePip();

    // Assert: the two cards in order, their layers, and their addresses.
    expect(
      screen.getAllByRole('region').map((card) => card.getAttribute('aria-label')),
      'the new-output form, then program, then PiP',
    ).toEqual(['Nova saída', 'Programa', 'PiP']);
    expect(readLayerNamesOfOutput('Programa'), "program's layers, bottom to top").toEqual([
      'Logo',
      'Letreiro',
      'Relógio',
      'Torre',
      'Tarja',
      'Tela cheia',
    ]);
    expect(readLayerNamesOfOutput('PiP'), "the PiP's layers, bottom to top").toEqual([
      'Moldura',
      'Legenda',
    ]);
    expect(
      findCardOfOutput('Programa').getByRole('textbox', { name: 'Endereço para o OBS' }),
      "program's address is the plain one OBS already has",
    ).toHaveValue(`${window.location.origin}/render/`);
    expect(
      findCardOfOutput('PiP').getByRole('textbox', { name: 'Endereço para o OBS' }),
      "the PiP's address names it",
    ).toHaveValue(`${window.location.origin}/render/?output=pip`);
  });
});

describe('adding an output', () => {
  it('sends createOutput with the address suggested from the name', () => {
    // Arrange: the page.
    const { fakeServer } = renderThePageWithThePip();
    const form = findCardOfOutput('Nova saída');

    // Act: type "Câmera 2" and add it.
    fireEvent.change(form.getByRole('textbox', { name: 'Nome' }), {
      target: { value: 'Câmera 2' },
    });
    fireEvent.click(form.getByRole('button', { name: 'Adicionar saída' }));

    // Assert: the address follows the name, and createOutput is sent.
    expect(form.getByRole('textbox', { name: 'Endereço' }), 'suggested from the name').toHaveValue(
      'camera-2',
    );
    expect(fakeServer.listCommandsReceived(), 'one createOutput').toEqual([
      { type: 'createOutput', outputId: 'camera-2', name: 'Câmera 2' },
    ]);
  });

  it('keeps an address typed by hand', () => {
    // Arrange: the page.
    const { fakeServer } = renderThePageWithThePip();
    const form = findCardOfOutput('Nova saída');

    // Act: type the address first, then the name, and add it.
    fireEvent.change(form.getByRole('textbox', { name: 'Endereço' }), {
      target: { value: 'box' },
    });
    fireEvent.change(form.getByRole('textbox', { name: 'Nome' }), {
      target: { value: 'Câmera do box' },
    });
    fireEvent.click(form.getByRole('button', { name: 'Adicionar saída' }));

    // Assert: the typed address is the one sent.
    expect(fakeServer.listCommandsReceived(), 'the address typed by hand wins').toEqual([
      { type: 'createOutput', outputId: 'box', name: 'Câmera do box' },
    ]);
  });

  it('shows the reason the server refused it', async () => {
    // Arrange: the page, with "PiP" typed in again.
    const { fakeServer } = renderThePageWithThePip();
    const form = findCardOfOutput('Nova saída');
    fireEvent.change(form.getByRole('textbox', { name: 'Nome' }), { target: { value: 'PiP' } });
    fireEvent.click(form.getByRole('button', { name: 'Adicionar saída' }));

    // Act: the server refuses it.
    await act(async () => {
      fakeServer.refuseLastCommand({
        code: 'OUTPUT_ALREADY_EXISTS',
        message:
          'Já existe uma saída com o endereço "pip" ("PiP"). Escolha outro endereço para a nova saída.',
      });
    });

    // Assert: the form shows the reason.
    expect(form.getByRole('alert'), "the server's reason is shown").toHaveTextContent(
      'Já existe uma saída com o endereço "pip" ("PiP").',
    );
  });
});

describe('renaming and deleting an output', () => {
  it('sends renameOutput with the new name', () => {
    // Arrange: the page.
    const { fakeServer } = renderThePageWithThePip();
    const card = findCardOfOutput('PiP');

    // Act: rename the PiP.
    fireEvent.change(card.getByRole('textbox', { name: 'Nome da saída PiP' }), {
      target: { value: 'PiP da câmera' },
    });
    fireEvent.click(card.getByRole('button', { name: 'Renomear' }));

    // Assert: renameOutput, keeping the id.
    expect(fakeServer.listCommandsReceived(), 'one renameOutput').toEqual([
      { type: 'renameOutput', outputId: 'pip', name: 'PiP da câmera' },
    ]);
  });

  it('sends deleteOutput at the second press only, and offers no delete for program', () => {
    // Arrange: the page.
    const { fakeServer } = renderThePageWithThePip();
    const card = findCardOfOutput('PiP');

    // Act: press "Excluir saída" once, look, then confirm.
    fireEvent.click(card.getByRole('button', { name: 'Excluir saída' }));
    const commandsAfterTheFirstPress = fakeServer.listCommandsReceived();
    fireEvent.click(card.getByRole('button', { name: 'Confirmar: excluir saída' }));

    // Assert: nothing after the first press, deleteOutput after the second; program says
    // why it has no such button.
    expect(commandsAfterTheFirstPress, 'one press only arms the button').toEqual([]);
    expect(fakeServer.listCommandsReceived(), 'the second press deletes').toEqual([
      { type: 'deleteOutput', outputId: 'pip' },
    ]);
    expect(
      findCardOfOutput('Programa').queryByRole('button', { name: 'Excluir saída' }),
      'program cannot be deleted',
    ).toBeNull();
    expect(
      findCardOfOutput('Programa').getByText(
        'A saída Programa é a fonte principal do OBS e não pode ser excluída.',
      ),
      'program says why',
    ).toBeInTheDocument();
  });

  it('shows a refusal in the card whose command it was', async () => {
    // Arrange: the PiP's delete confirmed.
    const { fakeServer } = renderThePageWithThePip();
    const card = findCardOfOutput('PiP');
    fireEvent.click(card.getByRole('button', { name: 'Excluir saída' }));
    fireEvent.click(card.getByRole('button', { name: 'Confirmar: excluir saída' }));

    // Act: the server refuses it.
    await act(async () => {
      fakeServer.refuseLastCommand({
        code: 'OUTPUT_HAS_LAYERS',
        message:
          'A saída "PiP" ainda tem 2 camadas: "Moldura", "Legenda". Exclua as camadas ou mude-as de saída antes de excluir a saída.',
      });
    });

    // Assert: the PiP's card shows it; program's card shows nothing.
    expect(card.getByRole('alert'), "the PiP's card shows the reason").toHaveTextContent(
      'A saída "PiP" ainda tem 2 camadas: "Moldura", "Legenda".',
    );
    expect(
      findCardOfOutput('Programa').queryByRole('alert'),
      'another card shows nothing',
    ).toBeNull();
  });
});

describe('"Copiar"', () => {
  it('puts the address on the clipboard and says so', async () => {
    // Arrange: a browser that offers a clipboard (https or localhost).
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    renderThePageWithThePip();
    const card = findCardOfOutput('PiP');

    // Act: press "Copiar".
    await act(async () => {
      fireEvent.click(card.getByRole('button', { name: 'Copiar' }));
    });

    // Assert: the PiP's address was copied, and the card says so.
    expect(writeText, 'the address goes on the clipboard').toHaveBeenCalledWith(
      `${window.location.origin}/render/?output=pip`,
    );
    expect(card.getByText('Endereço copiado.'), 'the card says it was copied').toBeInTheDocument();
  });

  it('copies the selected address the older way over plain http', async () => {
    // Arrange: a tablet on the LAN over http: no clipboard, but the older copy works.
    vi.stubGlobal('navigator', { ...navigator, clipboard: undefined });
    const copyTheSelection = vi.fn(() => true);
    document.execCommand = copyTheSelection;
    renderThePageWithThePip();
    const card = findCardOfOutput('PiP');

    // Act: press "Copiar".
    await act(async () => {
      fireEvent.click(card.getByRole('button', { name: 'Copiar' }));
    });

    // Assert: the selection was copied, and the card says so.
    expect(copyTheSelection, 'the older copy is used').toHaveBeenCalledWith('copy');
    expect(card.getByText('Endereço copiado.'), 'the card says it was copied').toBeInTheDocument();
  });

  it('says how to copy by hand when the browser copies nothing', async () => {
    // Arrange: neither copy works.
    vi.stubGlobal('navigator', { ...navigator, clipboard: undefined });
    document.execCommand = vi.fn(() => false);
    renderThePageWithThePip();
    const card = findCardOfOutput('PiP');

    // Act: press "Copiar".
    await act(async () => {
      fireEvent.click(card.getByRole('button', { name: 'Copiar' }));
    });

    // Assert: the card says what to do.
    expect(
      card.getByText('Não foi possível copiar. Selecione o endereço e use Ctrl+C.'),
      'the card says how to copy by hand',
    ).toBeInTheDocument();
  });
});

describe('the header link', () => {
  it('opens "Saídas e camadas" in a new tab', () => {
    // Arrange and act: the console.
    renderOnControlPageConnectedToFakeServer(<App />, buildSlicesWithThePipOutput());

    // Assert: "Saídas" points at #/saidas in a new tab.
    const outputsLink = within(screen.getByRole('banner')).getByRole('link', { name: 'Saídas' });
    expect(outputsLink, 'the link names the page').toHaveAttribute('href', '#/saidas');
    expect(outputsLink, 'the console stays in this tab').toHaveAttribute('target', '_blank');
  });
});
