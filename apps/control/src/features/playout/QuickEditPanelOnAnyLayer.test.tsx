/**
 * "Edição rápida": the chosen graphic on air on a layer other than its own (apps/control)
 *
 * What this module is for:
 *   A rundown item can put a graphic on any layer: the race clock on the logo layer, for
 *   example. "Edição rápida" must still see it: show what it holds, offer "Atualizar" and
 *   send the update to that instance. If the graphic is on air twice, on different
 *   layers, the panel follows the one taken most recently and says so in a line.
 *   "Colocar no ar" does not follow anything: it always takes the graphic on its own
 *   default layer.
 *
 * What these tests prove:
 *   - With the race clock on the logo layer, the panel shows "Atualizar" and the form
 *     holds the on-air session name, flag and time.
 *   - "Atualizar" then sends `updateInstanceData` for that instance, with only the field
 *     the operator changed.
 *   - "Colocar no ar" still sends `takeGraphic` for the clock layer, even while the
 *     clock on air is on the logo layer.
 *   - With two race clocks on air, the form holds the data of the one taken later, a
 *     line says the panel follows the most recent one and names the graphic and the
 *     layer, and "Atualizar" goes to that one.
 *   - With one race clock on air there is no such line.
 *
 * What these tests deliberately do not cover:
 *   - Which instance is followed in every case; instanceOfGraphicToFollow.test.ts.
 *   - Everything else "Atualizar" does; QuickEditPanelUpdate.test.tsx.
 */
import type { Instance } from '@bajaovrlay/shared';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { chooseOptionInDropdown } from '@/features/schemaForm/schemaFormOnTestPage.testSupport';

import {
  pressButtonAndWaitForCommand,
  referenceTimeLabel,
  renderQuickEditPanelWithTheseInstancesOnAir,
} from './operatingTheQuickEditPanel.testSupport';

// The Saturday of the endurance race, in Brasília time: the first clock went on air at
// 9:45 and the second at 9:55.
const quarterToTen = '2026-10-10T12:45:00.000Z';
const fiveToTen = '2026-10-10T12:55:00.000Z';

const mostRecentInstanceLine =
  '"Relógio de prova" está no ar em 2 camadas. Este painel acompanha a entrada mais recente, na camada Logo.';

/** The first heat on the logo layer since 9:45: green flag, stopped at 12:34. */
function buildFirstHeatClockOnTheLogoLayer(): Instance {
  return {
    id: 'relogio-da-bateria-1-na-camada-logo',
    layerId: 'bug',
    graphicId: 'race-clock',
    target: 'program',
    resolvedData: {
      sessionName: 'Enduro de Resistência — Bateria 1',
      state: 'green',
      clockMode: 'elapsed',
      referenceTimeMs: 754_000,
      referenceWallClockMs: Date.parse(quarterToTen),
      running: false,
    },
    currentStep: 0,
    status: 'on-air',
    takenAt: quarterToTen,
    itemId: 'item-largada-do-enduro',
  };
}

/** The qualifying session on the clock layer, yellow flag, stopped at 5:00. */
function buildQualifyingClockOnTheClockLayer(takenAt: string): Instance {
  return {
    id: 'relogio-da-classificatoria-na-camada-relogio',
    layerId: 'clock',
    graphicId: 'race-clock',
    target: 'program',
    resolvedData: {
      sessionName: 'Classificatória',
      state: 'yellow',
      clockMode: 'elapsed',
      referenceTimeMs: 300_000,
      referenceWallClockMs: Date.parse(takenAt),
      running: false,
    },
    currentStep: 0,
    status: 'on-air',
    takenAt,
  };
}

describe('the quick edit panel with the race clock on the logo layer', () => {
  it('shows "Atualizar" and fills the form with what that clock holds', () => {
    // Arrange: an item put the first heat's clock on the logo layer; the clock layer is empty.
    const instancesOnAir = [buildFirstHeatClockOnTheLogoLayer()];

    // Act: draw the panel.
    renderQuickEditPanelWithTheseInstancesOnAir(instancesOnAir);

    // Assert: the panel sees the clock although it is not on the clock layer.
    expect(
      screen.queryByRole('button', { name: 'Atualizar' }),
      'a graphic on air on any layer must bring "Atualizar" to the panel',
    ).not.toBeNull();
    expect(
      screen.getByLabelText<HTMLInputElement>('Nome da sessão').value,
      'the form must hold the session name that is on air',
    ).toBe('Enduro de Resistência — Bateria 1');
    expect(
      screen.getByRole('combobox', { name: 'Bandeira' }).textContent,
      'the form must hold the flag that is on air',
    ).toBe('Verde');
    expect(
      screen.getByLabelText<HTMLInputElement>(referenceTimeLabel).value,
      'the form must hold the reference time that is on air',
    ).toBe('12:34');
    expect(
      screen.queryByText(mostRecentInstanceLine),
      'with the graphic on air once there is nothing to explain',
    ).toBeNull();
  });

  it('sends "Atualizar" to the instance on the logo layer, with only the changed field', async () => {
    // Arrange: the first heat's clock on the logo layer, and a yellow flag chosen in the form.
    const { fakeServer } = renderQuickEditPanelWithTheseInstancesOnAir([
      buildFirstHeatClockOnTheLogoLayer(),
    ]);
    chooseOptionInDropdown('Bandeira', 'Amarela');

    // Act: press "Atualizar".
    await pressButtonAndWaitForCommand('Atualizar', 1, fakeServer);

    // Assert: the update names the instance on the logo layer and carries the flag only.
    expect(
      fakeServer.listCommandsReceived(),
      '"Atualizar" must update the instance that is on air, wherever it is',
    ).toEqual([
      {
        type: 'updateInstanceData',
        instanceId: 'relogio-da-bateria-1-na-camada-logo',
        data: { state: 'yellow' },
        takeTimeFieldKeys: [],
      },
    ]);
    fakeServer.acceptLastCommand();
  });

  it('still sends "Colocar no ar" to the clock layer', async () => {
    // Arrange: the first heat's clock on the logo layer; the form is left as it was filled.
    const { fakeServer } = renderQuickEditPanelWithTheseInstancesOnAir([
      buildFirstHeatClockOnTheLogoLayer(),
    ]);

    // Act: press "Colocar no ar".
    await pressButtonAndWaitForCommand('Colocar no ar', 1, fakeServer);

    // Assert: a take for the race clock's own layer, not for the layer the other clock is on.
    expect(
      fakeServer.listCommandsReceived()[0],
      '"Colocar no ar" must target the graphic\'s default layer, not the layer of the instance on air',
    ).toMatchObject({ type: 'takeGraphic', graphicId: 'race-clock', layerId: 'clock' });
    fakeServer.acceptLastCommand();
  });
});

describe('the quick edit panel with two race clocks on air', () => {
  it('follows the one taken most recently, says so naming its layer, and updates that one', async () => {
    // Arrange: the qualifying clock on the clock layer since 9:45, and the first heat's
    // clock put on the logo layer at 9:55 (built for 9:45, so its takenAt is moved).
    const laterClockOnTheLogoLayer = { ...buildFirstHeatClockOnTheLogoLayer(), takenAt: fiveToTen };
    const { fakeServer } = renderQuickEditPanelWithTheseInstancesOnAir([
      buildQualifyingClockOnTheClockLayer(quarterToTen),
      laterClockOnTheLogoLayer,
    ]);

    // Act: the operator reads the panel, chooses the red flag and presses "Atualizar".
    const sessionNameShown = screen.getByLabelText<HTMLInputElement>('Nome da sessão').value;
    const lineShown = screen.queryByText(mostRecentInstanceLine);
    chooseOptionInDropdown('Bandeira', 'Vermelha');
    await pressButtonAndWaitForCommand('Atualizar', 1, fakeServer);

    // Assert: the form held the later clock, the line explained it, and the update went there.
    expect(sessionNameShown, 'the form must hold the instance taken most recently').toBe(
      'Enduro de Resistência — Bateria 1',
    );
    expect(
      lineShown,
      'with the graphic on air twice the panel must say which one it follows',
    ).not.toBeNull();
    expect(
      fakeServer.listCommandsReceived(),
      '"Atualizar" must go to the instance taken most recently',
    ).toEqual([
      {
        type: 'updateInstanceData',
        instanceId: 'relogio-da-bateria-1-na-camada-logo',
        data: { state: 'red' },
        takeTimeFieldKeys: [],
      },
    ]);
    fakeServer.acceptLastCommand();
  });
});
