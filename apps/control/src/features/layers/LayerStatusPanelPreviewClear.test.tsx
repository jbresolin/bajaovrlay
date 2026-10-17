/**
 * Layer status panel: "Prévia: limpar" and the "vai limpar" chip (apps/control)
 *
 * What this module is for:
 *   Prévia shows what the screen will look like after the take. To prepare a take that
 *   takes something OFF the air, the operator marks a layer "will be cleared": the row's
 *   "Prévia: limpar" sends previewClearLayer, the Prévia monitor then draws that layer
 *   empty, and the next take of it ("Tomar" or "Tomar tudo") clears it on program. While
 *   a layer is marked its row carries the chip "vai limpar", next to its name.
 *
 * What these tests prove:
 *   - A row with something on air offers "Prévia: limpar", which sends previewClearLayer
 *     for that layer and nothing else; an empty row, and a row already marked, do not
 *     offer it.
 *   - A marked layer carries the chip "vai limpar" and still names what is on air.
 *   - A refused previewClearLayer is shown under the rows, in the server's words.
 *
 * What these tests deliberately do not cover:
 *   - The lines under the Prévia monitor for a marked layer, with "Tomar" and
 *     "Descartar": features/outputMonitors/PreviewedLayersListTakeAll.test.tsx.
 *   - What the server does with the mark: apps/server's previewClearLayer.test.ts.
 *   - "Editar" on a row, which loads the instance into "Edição rápida":
 *     features/playout/QuickEditPanelTarget.test.tsx.
 */
import type { Instance, Slices } from '@bajaovrlay/shared';
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import {
  buildRaceClockInstanceOnTheClockLayer,
  buildSlicesWithNothingOnAir,
} from '@/state/slicesLikeTheServerSends.testSupport';

import { LayerStatusPanel } from './LayerStatusPanel';

// Saturday of the endurance race: the clock went on air at 10:00.
const momentTheClockWentOnAir = '2026-10-10T13:00:00.000Z';

/** The server's state with the race clock on air and these layers marked "vai limpar". */
function buildSlicesWithTheClockOnAirAndTheseMarks(previewClearedLayerIds: string[]): Slices {
  const clockOnAir: Instance = {
    ...buildRaceClockInstanceOnTheClockLayer(momentTheClockWentOnAir),
    status: 'on-air',
  };
  return {
    ...buildSlicesWithNothingOnAir(),
    instances: [clockOnAir],
    previewClearedLayerIds,
  };
}

describe('"Prévia: limpar" on the rows of the layer status panel', () => {
  it('is offered on a row with something on air and sends previewClearLayer for it', () => {
    // Arrange: the clock is on air and nothing is marked.
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(
      <LayerStatusPanel />,
      buildSlicesWithTheClockOnAirAndTheseMarks([]),
    );

    // Act: press "Prévia: limpar" on the clock's row.
    const clockRow = within(screen.getByRole('listitem', { name: 'Relógio' }));
    fireEvent.click(clockRow.getByRole('button', { name: 'Prévia: limpar' }));

    // Assert: one command, naming the clock layer; nothing is cleared on air yet.
    expect(
      fakeServer.listCommandsReceived(),
      '"Prévia: limpar" must mark that layer, never clear it on air',
    ).toEqual([{ type: 'previewClearLayer', layerId: 'clock' }]);
    fakeServer.acceptLastCommand();
  });

  it('is not offered on an empty row, where there is nothing to clear', () => {
    // Arrange: the clock is on air, so the "Tarja" layer is empty.
    const slices = buildSlicesWithTheClockOnAirAndTheseMarks([]);

    // Act: draw the panel.
    renderOnControlPageConnectedToFakeServer(<LayerStatusPanel />, slices);

    // Assert: the empty row has no "Prévia: limpar".
    const lowerThirdRow = within(screen.getByRole('listitem', { name: 'Tarja' }));
    expect(
      lowerThirdRow.queryByRole('button', { name: 'Prévia: limpar' }),
      'an empty layer has nothing a take could clear',
    ).toBeNull();
  });

  it('is not offered on a row that is already marked, where pressing it again would do nothing', () => {
    // Arrange: the clock is on air and its layer is already marked "vai limpar".
    const slices = buildSlicesWithTheClockOnAirAndTheseMarks(['clock']);

    // Act: draw the panel.
    renderOnControlPageConnectedToFakeServer(<LayerStatusPanel />, slices);

    // Assert: the marked row has no "Prévia: limpar".
    const clockRow = within(screen.getByRole('listitem', { name: 'Relógio' }));
    expect(
      clockRow.queryByRole('button', { name: 'Prévia: limpar' }),
      'a layer already marked must not offer to mark it again',
    ).toBeNull();
  });

  it('marks a layer the next take clears with the chip "vai limpar", and still names what is on air', () => {
    // Arrange: the clock's layer is marked.
    const slices = buildSlicesWithTheClockOnAirAndTheseMarks(['clock']);

    // Act: draw the panel.
    renderOnControlPageConnectedToFakeServer(<LayerStatusPanel />, slices);

    // Assert: the chip is on the clock's row only, and the row still shows the clock.
    const clockRow = within(screen.getByRole('listitem', { name: 'Relógio' }));
    const logoRow = within(screen.getByRole('listitem', { name: 'Logo' }));
    expect(
      clockRow.getByText('vai limpar'),
      'a marked layer must say that the next take clears it',
    ).toBeInTheDocument();
    expect(
      clockRow.getByText('Relógio de prova'),
      'the mark changes nothing on air yet: the row must still name the clock',
    ).toBeInTheDocument();
    expect(
      logoRow.queryByText('vai limpar'),
      'a layer that is not marked must not carry the chip',
    ).toBeNull();
  });

  it("shows the server's pt-BR message under the rows when previewClearLayer is refused", async () => {
    // Arrange: the clock is on air and "Prévia: limpar" was pressed.
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(
      <LayerStatusPanel />,
      buildSlicesWithTheClockOnAirAndTheseMarks([]),
    );
    const clockRow = within(screen.getByRole('listitem', { name: 'Relógio' }));
    fireEvent.click(clockRow.getByRole('button', { name: 'Prévia: limpar' }));

    // Act: the server could not save the change.
    fakeServer.refuseLastCommand({
      code: 'UNEXPECTED_SERVER_ERROR',
      message:
        'Erro inesperado no servidor ao executar o comando. Procure o erro no log do servidor.',
    });

    // Assert: the reason is on screen.
    expect(
      await screen.findByRole('alert'),
      'a refused "Prévia: limpar" must be explained next to the rows',
    ).toHaveTextContent(
      'Erro inesperado no servidor ao executar o comando. Procure o erro no log do servidor.',
    );
  });
});
