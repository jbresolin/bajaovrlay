/**
 * Take panel: the race clock on air on a layer other than the clock layer (apps/control)
 *
 * What this module is for:
 *   A rundown item can put the race clock on any layer, the logo layer for example. The
 *   take panel must still see it: show what it holds, offer "Atualizar" and send the
 *   update to that instance. If two race clocks are on air on different layers the panel
 *   follows the one taken most recently and says so in a line. "Colocar no ar" does not
 *   follow anything: it always takes the clock on its own default layer.
 *
 * What these tests prove:
 *   - With the race clock on the logo layer, the panel shows "Atualizar" and the form
 *     holds the on-air session name, flag and time.
 *   - "Atualizar" then sends `updateInstanceData` for that instance, with only the field
 *     the operator changed.
 *   - "Colocar no ar" still sends `takeGraphic` for the clock layer, even while the
 *     clock on air is on the logo layer.
 *   - With two race clocks on air, the form holds the data of the one taken later, a
 *     line says the panel follows the most recent one and names its layer, and
 *     "Atualizar" goes to that one.
 *   - With one race clock on air there is no such line.
 *
 * What these tests deliberately do not cover:
 *   - Which instance is followed in every case; raceClockInstanceToFollow.test.ts.
 *   - Everything else "Atualizar" does; TakeRaceClockPanelUpdate.test.tsx.
 */
import type { Instance } from '@bajaovrlay/shared';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import { buildSlicesWithNothingOnAir } from '@/state/slicesLikeTheServerSends.testSupport';

import {
  chooseOptionInDropdown,
  pressButtonAndWaitForCommand,
} from './operatingTheRaceClockForm.testSupport';
import { TakeRaceClockPanel } from './TakeRaceClockPanel';

// The Saturday of the endurance race, in Brasília time: the first clock went on air at
// 9:45, the second at 9:55, and the operator looks at the panel at 10:00.
const quarterToTen = '2026-10-10T12:45:00.000Z';
const fiveToTen = '2026-10-10T12:55:00.000Z';
const tenOClock = '2026-10-10T13:00:00.000Z';

const mostRecentClockLine =
  'Há 2 relógios no ar. Este painel acompanha o mais recente, na camada Logo.';

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

/** Draws the panel at 10:00 on a connected page with these instances on air. */
function renderPanelAtTenOClock(instancesOnAir: Instance[]) {
  return renderOnControlPageConnectedToFakeServer(
    <TakeRaceClockPanel readCurrentTimeInMilliseconds={() => Date.parse(tenOClock)} />,
    { ...buildSlicesWithNothingOnAir(), instances: instancesOnAir },
  );
}

describe('the take panel with the race clock on the logo layer', () => {
  it('shows "Atualizar" and fills the form with what that clock holds', () => {
    // Arrange: an item put the first heat's clock on the logo layer; the clock layer is empty.
    const instancesOnAir = [buildFirstHeatClockOnTheLogoLayer()];

    // Act: draw the panel.
    renderPanelAtTenOClock(instancesOnAir);

    // Assert: the panel sees the clock although it is not on the clock layer.
    expect(
      screen.queryByRole('button', { name: 'Atualizar' }),
      'a race clock on air on any layer must bring "Atualizar" to the panel',
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
      screen.getByLabelText<HTMLInputElement>('Tempo de referência (mm:ss)').value,
      'the form must hold the time the clock on air shows',
    ).toBe('12:34');
    expect(
      screen.queryByText(mostRecentClockLine),
      'with one race clock on air there is nothing to explain',
    ).toBeNull();
  });

  it('sends "Atualizar" to the instance on the logo layer, with only the changed field', async () => {
    // Arrange: the first heat's clock on the logo layer, and a yellow flag chosen in the form.
    const { fakeServer } = renderPanelAtTenOClock([buildFirstHeatClockOnTheLogoLayer()]);
    chooseOptionInDropdown('Bandeira', 'Amarela');

    // Act: press "Atualizar".
    await pressButtonAndWaitForCommand('Atualizar', 1, fakeServer);

    // Assert: the update names the instance on the logo layer and carries the flag only.
    expect(
      fakeServer.listCommandsReceived(),
      '"Atualizar" must update the race clock that is on air, wherever it is',
    ).toEqual([
      {
        type: 'updateInstanceData',
        instanceId: 'relogio-da-bateria-1-na-camada-logo',
        data: { state: 'yellow' },
      },
    ]);
  });

  it('still sends "Colocar no ar" to the clock layer', async () => {
    // Arrange: the first heat's clock on the logo layer; the form is left as it was filled.
    const { fakeServer } = renderPanelAtTenOClock([buildFirstHeatClockOnTheLogoLayer()]);

    // Act: press "Colocar no ar".
    await pressButtonAndWaitForCommand('Colocar no ar', 1, fakeServer);

    // Assert: a take for the race clock's own layer, not for the layer the other clock is on.
    const commandsReceived = fakeServer.listCommandsReceived() as Array<Record<string, unknown>>;
    expect(commandsReceived[0]?.type, '"Colocar no ar" must send a take').toBe('takeGraphic');
    expect(
      commandsReceived[0]?.layerId,
      '"Colocar no ar" must target the race clock\'s default layer, not the layer of the clock on air',
    ).toBe('clock');
  });
});

describe('the take panel with two race clocks on air', () => {
  it('follows the one taken most recently, says so naming its layer, and updates that one', async () => {
    // Arrange: the qualifying clock on the clock layer since 9:45, and the first heat's
    // clock put on the logo layer at 9:55 (built for 9:45, so its takenAt is moved).
    const laterClockOnTheLogoLayer = { ...buildFirstHeatClockOnTheLogoLayer(), takenAt: fiveToTen };
    const { fakeServer } = renderPanelAtTenOClock([
      buildQualifyingClockOnTheClockLayer(quarterToTen),
      laterClockOnTheLogoLayer,
    ]);

    // Act: the operator reads the panel, chooses the red flag and presses "Atualizar".
    const sessionNameShown = screen.getByLabelText<HTMLInputElement>('Nome da sessão').value;
    const lineShown = screen.queryByText(mostRecentClockLine);
    chooseOptionInDropdown('Bandeira', 'Vermelha');
    await pressButtonAndWaitForCommand('Atualizar', 1, fakeServer);

    // Assert: the form held the later clock, the line explained it, and the update went there.
    expect(sessionNameShown, 'the form must hold the race clock taken most recently').toBe(
      'Enduro de Resistência — Bateria 1',
    );
    expect(
      lineShown,
      'with two race clocks on air the panel must say which one it follows',
    ).not.toBeNull();
    expect(
      fakeServer.listCommandsReceived(),
      '"Atualizar" must go to the race clock taken most recently',
    ).toEqual([
      {
        type: 'updateInstanceData',
        instanceId: 'relogio-da-bateria-1-na-camada-logo',
        data: { state: 'red' },
      },
    ]);
  });
});
