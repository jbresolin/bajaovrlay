/**
 * The lines under the "Prévia" monitor (apps/control)
 *
 * What this module is for:
 *   The preview output can hold one graphic per layer, so several things can be in
 *   preview at once (a clock and an interview band). Under the "Prévia" monitor the page
 *   lists them, one line per layer that holds a preview, each naming the layer and what
 *   is previewed on it and offering two buttons: "Tomar" sends that preview to air
 *   (`takePreview`), "Descartar" throws it away (`stopPreview`). The list only repeats
 *   the server's instances; a line leaves when the server says the preview is gone.
 *
 * What these tests prove:
 *   - With nothing previewed the area says "Nada em prévia.", and an instance on the
 *     program output is not listed.
 *   - There is one line per layer that holds a preview, in the layer panel's order (from
 *     the bottom layer to the top one), whatever order the server lists the instances in.
 *   - A line names what is previewed: the label of the rundown item it was made from;
 *     the graphic's name for a preview made by hand in "Edição rápida" or whose item was
 *     deleted since; and the graphic's id when the server no longer lists the graphic.
 *   - "Tomar" sends `takePreview` and "Descartar" sends `stopPreview`, each with the layer
 *     of its own line and nothing else.
 *   - The page removes no line by itself: the line goes when the server's next instances
 *     slice no longer holds that preview.
 *   - A refusal of either command is shown under the lines, in the server's words.
 *   - While the page is not connected both buttons are disabled.
 *
 * What these tests deliberately do not cover:
 *   - A status badge: a preview never gets one. Its status stays "loading" for good,
 *     because the pages that draw previews never report, so a badge would always read
 *     "Carregando" and mean nothing.
 *   - What `takePreview` does on the server (the data goes on air as it was seen, the
 *     clock's moment is stamped again, the cursor moves on); apps/server's
 *     takePreview.test.ts and takePreviewCursor.test.ts.
 *   - Space and Backspace, which send the same two commands: commandForOperatorKey.test.ts.
 *   - The preview of the next item that follows an accepted "Tomar" while "Prévia
 *     automática" is on: PreviewedLayersListPreviewAfterTake.test.tsx. (Here the cursor
 *     never moves, so no "Tomar" is followed by anything.)
 *   - What the monitor above the lines frames: OutputMonitor.test.tsx.
 */
import type { Instance, Slices } from '@bajaovrlay/shared';
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import { buildLowerThirdFixtureGraphic } from '@/state/lowerThirdFixtureGraphic.testSupport';
import {
  buildLowerThirdPreviewMadeByHand,
  buildRaceClockPreviewOfItem,
} from '@/state/previewLikeTheServerSends.testSupport';
import {
  buildSlicesWithTheEnduranceRundown,
  enduranceStartItemId,
} from '@/state/rundownLikeTheServerSends.testSupport';
import {
  buildRaceClockGraphic,
  buildRaceClockInstanceOnTheClockLayer,
} from '@/state/slicesLikeTheServerSends.testSupport';

import { PreviewedLayersList } from './PreviewedLayersList';

// Saturday of the endurance race: the start is previewed at 9:58, the band at 9:59.
const momentTheStartWasPreviewed = '2026-10-10T12:58:00.000Z';
const momentTheBandWasPreviewed = '2026-10-10T12:59:00.000Z';

/**
 * What the server sends for these tests: its five layers, the race clock and the lower
 * third as graphics, the three items of the endurance race, and these instances.
 */
function buildSlicesWithTheseInstances(instances: Instance[]): Slices {
  return {
    ...buildSlicesWithTheEnduranceRundown(enduranceStartItemId),
    graphics: [buildRaceClockGraphic(), buildLowerThirdFixtureGraphic()],
    instances,
  };
}

/** The state with the start of the endurance race previewed on the clock layer. */
function buildSlicesWithTheStartPreviewed(): Slices {
  return buildSlicesWithTheseInstances([
    buildRaceClockPreviewOfItem(enduranceStartItemId, momentTheStartWasPreviewed),
  ]);
}

/** The state with two previews: the interview band (listed first) and the start. */
function buildSlicesWithTheBandAndTheStartPreviewed(): Slices {
  return buildSlicesWithTheseInstances([
    buildLowerThirdPreviewMadeByHand(momentTheBandWasPreviewed),
    buildRaceClockPreviewOfItem(enduranceStartItemId, momentTheStartWasPreviewed),
  ]);
}

/** Reads the layer names of the lines on screen, top line first. */
function listLayerNamesOfTheLines(): (string | null)[] {
  const list = screen.queryByRole('list', { name: 'Em prévia' });
  if (list === null) {
    return [];
  }
  return within(list)
    .getAllByRole('listitem')
    .map((line) => line.getAttribute('aria-label'));
}

describe('the lines under the "Prévia" monitor', () => {
  it('says "Nada em prévia." when nothing is previewed, even with a graphic on air', () => {
    // Arrange: the race clock is on the PROGRAM output and nothing is previewed.
    const slices = buildSlicesWithTheseInstances([
      buildRaceClockInstanceOnTheClockLayer(momentTheStartWasPreviewed),
    ]);

    // Act: draw the area.
    renderOnControlPageConnectedToFakeServer(<PreviewedLayersList />, slices);

    // Assert: the area says so in words, and offers nothing to take or discard.
    expect(
      screen.getByText('Nada em prévia.'),
      'an empty preview output must be said in words, not left as a blank area',
    ).toBeInTheDocument();
    expect(
      listLayerNamesOfTheLines(),
      'what is on the program output must never be listed as a preview',
    ).toEqual([]);
    expect(
      screen.queryByRole('button', { name: 'Tomar' }),
      'with nothing previewed there is nothing to take',
    ).toBeNull();
  });

  it('lists one line per previewed layer, from the bottom layer to the top one', () => {
    // Arrange: two previews, and the server lists the upper layer's (the band) first.
    const slices = buildSlicesWithTheBandAndTheStartPreviewed();

    // Act: draw the area.
    renderOnControlPageConnectedToFakeServer(<PreviewedLayersList />, slices);

    // Assert: two lines in the layer panel's order, "Relógio" (lower) above "Tarja".
    expect(
      listLayerNamesOfTheLines(),
      'the lines must follow the z-order of the layers, as the layer panel does',
    ).toEqual(['Relógio', 'Tarja']);
    expect(
      screen.queryByText('Nada em prévia.'),
      'with previews listed the area must not also say it is empty',
    ).toBeNull();
  });

  const labelScenarios: Array<{
    name: string;
    buildSlices: () => Slices;
    layerName: string;
    expectedLabel: string;
  }> = [
    // The everyday case: → or a row's "Prévia" button previewed a rundown item, and the
    // operator knows it by the label they gave it.
    {
      name: 'names a preview made from a rundown item by the label of that item',
      buildSlices: buildSlicesWithTheStartPreviewed,
      layerName: 'Relógio',
      expectedLabel: 'Largada do enduro',
    },
    // "Edição rápida" previews with no item behind it, so the graphic's name is all
    // there is to say.
    {
      name: 'names a preview made by hand by the name of its graphic',
      buildSlices: () =>
        buildSlicesWithTheseInstances([
          buildLowerThirdPreviewMadeByHand(momentTheBandWasPreviewed),
        ]),
      layerName: 'Tarja',
      expectedLabel: 'Tarja de entrevista',
    },
    // The item was deleted after it was previewed; the preview stays (the server keeps
    // it), still carrying the id of an item nobody can look up any more.
    {
      name: 'names a preview whose item was deleted since by the name of its graphic',
      buildSlices: () => {
        const slices = buildSlicesWithTheStartPreviewed();
        slices.items = [];
        return slices;
      },
      layerName: 'Relógio',
      expectedLabel: 'Relógio de prova',
    },
    // A graphic the server no longer lists: the line must still exist, so the preview
    // can be discarded; the id is the only name left.
    {
      name: 'names a preview made by hand by its graphic id when the graphic is not listed',
      buildSlices: () => {
        const slices = buildSlicesWithTheseInstances([
          buildLowerThirdPreviewMadeByHand(momentTheBandWasPreviewed),
        ]);
        slices.graphics = [buildRaceClockGraphic()];
        return slices;
      },
      layerName: 'Tarja',
      expectedLabel: 'lower-third-fixture',
    },
  ];

  it.each(labelScenarios)('$name', ({ buildSlices, layerName, expectedLabel }) => {
    // Arrange: the state of this row.
    const slices = buildSlices();

    // Act: draw the area.
    renderOnControlPageConnectedToFakeServer(<PreviewedLayersList />, slices);

    // Assert: the line of that layer says what is previewed on it.
    const line = within(screen.getByRole('listitem', { name: layerName }));
    expect(
      line.getByText(layerName),
      'the line must name the layer the preview is on',
    ).toBeInTheDocument();
    expect(
      line.getByText(expectedLabel),
      'the line must name what is previewed, in the words the operator knows it by',
    ).toBeInTheDocument();
  });

  const buttonScenarios = [
    // "Tomar" on the lower line: the band goes on air, the clock preview stays.
    {
      name: '"Tomar" sends takePreview for the layer of its own line',
      layerName: 'Tarja',
      buttonName: 'Tomar',
      expectedCommand: { type: 'takePreview', layerId: 'lower-third' },
    },
    // The same button on the other line, to prove each carries its own layer.
    {
      name: '"Tomar" on the clock line sends takePreview for the clock layer',
      layerName: 'Relógio',
      buttonName: 'Tomar',
      expectedCommand: { type: 'takePreview', layerId: 'clock' },
    },
    // "Descartar" names its layer too: it must never be the "every layer" form (null),
    // or one press would throw the other preview away as well.
    {
      name: '"Descartar" sends stopPreview for the layer of its own line',
      layerName: 'Tarja',
      buttonName: 'Descartar',
      expectedCommand: { type: 'stopPreview', layerId: 'lower-third' },
    },
    // And on the other line.
    {
      name: '"Descartar" on the clock line sends stopPreview for the clock layer',
      layerName: 'Relógio',
      buttonName: 'Descartar',
      expectedCommand: { type: 'stopPreview', layerId: 'clock' },
    },
  ];

  it.each(buttonScenarios)('$name', ({ layerName, buttonName, expectedCommand }) => {
    // Arrange: the band and the start are both previewed.
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(
      <PreviewedLayersList />,
      buildSlicesWithTheBandAndTheStartPreviewed(),
    );

    // Act: press the button on that layer's line.
    const line = within(screen.getByRole('listitem', { name: layerName }));
    fireEvent.click(line.getByRole('button', { name: buttonName }));

    // Assert: one command, naming that layer.
    expect(
      fakeServer.listCommandsReceived(),
      `"${buttonName}" on "${layerName}" must send one command for that layer and nothing else`,
    ).toEqual([expectedCommand]);
    // (Then the server answers, so no command is left waiting for its 5-second timeout.)
    fakeServer.acceptLastCommand();
  });

  it('keeps the line until the server says the preview is gone', () => {
    // Arrange: the start is previewed, and "Descartar" was pressed.
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(
      <PreviewedLayersList />,
      buildSlicesWithTheStartPreviewed(),
    );
    const clockLine = within(screen.getByRole('listitem', { name: 'Relógio' }));
    fireEvent.click(clockLine.getByRole('button', { name: 'Descartar' }));
    const layerNamesRightAfterThePress = listLayerNamesOfTheLines();

    // Act: the server sends its instances without the preview, then answers ok.
    fakeServer.sendMessage({ type: 'slice', name: 'instances', slice: [] });
    fakeServer.acceptLastCommand();

    // Assert: the page waited for the server, then followed it.
    expect(
      layerNamesRightAfterThePress,
      'right after the press the line must still be there: the page decides nothing by itself',
    ).toEqual(['Relógio']);
    expect(
      screen.getByText('Nada em prévia.'),
      'once the server says the preview is gone the area must say it is empty',
    ).toBeInTheDocument();
  });

  it("shows the server's pt-BR message under the lines when a take of the preview is refused", async () => {
    // Arrange: the start is previewed, and "Tomar" was pressed.
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(
      <PreviewedLayersList />,
      buildSlicesWithTheStartPreviewed(),
    );
    const clockLine = within(screen.getByRole('listitem', { name: 'Relógio' }));
    fireEvent.click(clockLine.getByRole('button', { name: 'Tomar' }));

    // Act: another operator discarded that preview a moment earlier, so the server refuses.
    fakeServer.refuseLastCommand({
      code: 'LAYER_PREVIEW_EMPTY',
      message: 'Não há nada em prévia na camada "Relógio" para colocar no ar.',
    });

    // Assert: the reason is on screen, where the operator pressed.
    expect(
      await screen.findByRole('alert'),
      'a refused "Tomar" must be explained next to the buttons, in the words of the server',
    ).toHaveTextContent('Não há nada em prévia na camada "Relógio" para colocar no ar.');
  });

  it('shows the refusal of a "Descartar" under the lines too', async () => {
    // Arrange: the start is previewed, and "Descartar" was pressed.
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(
      <PreviewedLayersList />,
      buildSlicesWithTheStartPreviewed(),
    );
    const clockLine = within(screen.getByRole('listitem', { name: 'Relógio' }));
    fireEvent.click(clockLine.getByRole('button', { name: 'Descartar' }));

    // Act: the server answers that it failed to save the change.
    fakeServer.refuseLastCommand({
      code: 'UNEXPECTED_SERVER_ERROR',
      message:
        'Erro inesperado no servidor ao executar o comando. Procure o erro no log do servidor.',
    });

    // Assert: the reason is on screen.
    expect(
      await screen.findByRole('alert'),
      'a refused "Descartar" must be explained next to the buttons',
    ).toHaveTextContent(
      'Erro inesperado no servidor ao executar o comando. Procure o erro no log do servidor.',
    );
  });

  it('disables "Tomar" and "Descartar" while the connection is down', () => {
    // Arrange: the start is previewed on a connected page.
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(
      <PreviewedLayersList />,
      buildSlicesWithTheStartPreviewed(),
    );

    // Act: the line drops.
    fakeServer.dropConnection();

    // Assert: the preview is still listed (the last known state), but nothing can be sent.
    const clockLine = within(screen.getByRole('listitem', { name: 'Relógio' }));
    expect(
      clockLine.getByRole('button', { name: 'Tomar' }),
      '"Tomar" cannot be pressed without a connection',
    ).toBeDisabled();
    expect(
      clockLine.getByRole('button', { name: 'Descartar' }),
      '"Descartar" cannot be pressed without a connection',
    ).toBeDisabled();
  });
});
