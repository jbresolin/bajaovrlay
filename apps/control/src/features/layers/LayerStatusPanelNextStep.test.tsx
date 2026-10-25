/**
 * Layer status panel: "Próximo" for a graphic shown in steps (apps/control)
 *
 * What this module is for:
 *   The podium comes in steps: its head at the take, then the 3rd, 2nd and 1st place, one
 *   per "Próximo" (BAJAOVRLAY-47). The Camadas row of a layer whose graphic on air has
 *   more than one step says where it is ("Passo 2 de 4", from the instance's currentStep)
 *   and offers "Próximo", which sends nextOnLayer for that layer; on the last step the
 *   button is off, since the server would refuse it and "Limpar" is what comes next.
 *
 * What these tests prove:
 *   - The podium's row at its head reads "Passo 1 de 4", and "Próximo" sends nextOnLayer
 *     for the fullscreen layer from step 0 (the step on screen) and nothing else.
 *   - At its last step the row reads "Passo 4 de 4" and "Próximo" is off.
 *   - A graphic of one step (the race clock) shows neither the step nor "Próximo".
 *   - A refused nextOnLayer is shown under the rows, in the server's words.
 *
 * What these tests deliberately do not cover:
 *   - What the server does with nextOnLayer: apps/server's nextOnLayer.test.ts.
 *   - Reading a manifest's stepCount: packages/shared's graphicSteps.test.ts.
 */
import type { Graphic, Instance, Slices } from '@bajaovrlay/shared';
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import {
  buildRaceClockInstanceOnTheClockLayer,
  buildSlicesWithNothingOnAir,
} from '@/state/slicesLikeTheServerSends.testSupport';

import { LayerStatusPanel } from './LayerStatusPanel';

/** The podium as the server lists it: four steps, the head and one per place. */
function buildPodiumGraphic(): Graphic {
  return {
    id: 'podium',
    manifest: { id: 'baja-podium', name: 'Pódio', main: 'podium.js', stepCount: 4 },
    defaultLayerId: 'fullscreen',
    category: 'standings',
    thumbnailUrl: null,
    defaultFields: {},
  };
}

/** The enduro's podium on air on the fullscreen layer, at the step given. */
function buildPodiumOnAirAtStep(currentStep: number): Instance {
  return {
    id: 'podio-do-enduro',
    layerId: 'fullscreen',
    graphicId: 'podium',
    target: 'program',
    resolvedData: { title: 'PÓDIO' },
    currentStep,
    status: 'on-air',
    takenAt: '2026-11-14T19:30:00.000Z',
  };
}

/** The server's state with the podium registered and on air at the step given. */
function buildSlicesWithThePodiumAtStep(currentStep: number): Slices {
  const slices = buildSlicesWithNothingOnAir();
  return {
    ...slices,
    graphics: [...slices.graphics, buildPodiumGraphic()],
    instances: [buildPodiumOnAirAtStep(currentStep)],
  };
}

describe('"Próximo" on the rows of the layer status panel', () => {
  it('shows the podium at its head as step 1 of 4, and sends nextOnLayer for its layer', () => {
    // Arrange: the podium on air at its head.
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(
      <LayerStatusPanel />,
      buildSlicesWithThePodiumAtStep(0),
    );
    const fullscreenRow = within(screen.getByRole('listitem', { name: 'Tela cheia' }));

    // Act: press "Próximo" on its row.
    fireEvent.click(fullscreenRow.getByRole('button', { name: 'Próximo' }));

    // Assert: the row says where the podium is, and one command names the layer.
    expect(fullscreenRow.getByText('Passo 1 de 4'), 'the head is step 1 of 4').toBeVisible();
    expect(
      fakeServer.listCommandsReceived(),
      '"Próximo" must ask for the next step of that layer only',
    ).toEqual([{ type: 'nextOnLayer', layerId: 'fullscreen', fromStep: 0 }]);
    fakeServer.acceptLastCommand();
  });

  it('turns "Próximo" off on the last step', () => {
    // Arrange: the podium with all three places revealed.
    const slices = buildSlicesWithThePodiumAtStep(3);

    // Act: draw the panel.
    renderOnControlPageConnectedToFakeServer(<LayerStatusPanel />, slices);

    // Assert: step 4 of 4, and the button off.
    const fullscreenRow = within(screen.getByRole('listitem', { name: 'Tela cheia' }));
    expect(fullscreenRow.getByText('Passo 4 de 4'), 'the last step is 4 of 4').toBeVisible();
    expect(
      fullscreenRow.getByRole('button', { name: 'Próximo' }),
      'nothing comes after the last step',
    ).toBeDisabled();
  });

  it('shows neither the step nor "Próximo" for a graphic of one step', () => {
    // Arrange: the race clock on air; its manifest gives no stepCount.
    const slices = {
      ...buildSlicesWithNothingOnAir(),
      instances: [buildRaceClockInstanceOnTheClockLayer('2026-11-14T13:00:00.000Z')],
    };

    // Act: draw the panel.
    renderOnControlPageConnectedToFakeServer(<LayerStatusPanel />, slices);

    // Assert: the clock's row has no step and no "Próximo".
    const clockRow = within(screen.getByRole('listitem', { name: 'Relógio' }));
    expect(clockRow.queryByText(/^Passo /), 'a one-step graphic has no step line').toBeNull();
    expect(
      clockRow.queryByRole('button', { name: 'Próximo' }),
      'a one-step graphic offers no "Próximo"',
    ).toBeNull();
  });

  it("shows the server's pt-BR message under the rows when nextOnLayer is refused", async () => {
    // Arrange: the podium on air at its head, and "Próximo" pressed.
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(
      <LayerStatusPanel />,
      buildSlicesWithThePodiumAtStep(0),
    );
    const fullscreenRow = within(screen.getByRole('listitem', { name: 'Tela cheia' }));
    fireEvent.click(fullscreenRow.getByRole('button', { name: 'Próximo' }));

    // Act: the server refused it (the podium was cleared from another page meanwhile).
    fakeServer.refuseLastCommand({
      code: 'NOTHING_ON_AIR_ON_LAYER',
      message: 'Não há nada no ar na camada "Tela cheia".',
    });

    // Assert: the reason is on screen.
    expect(
      await screen.findByRole('alert'),
      'a refused "Próximo" must be explained next to the rows',
    ).toHaveTextContent('Não há nada no ar na camada "Tela cheia".');
  });
});
