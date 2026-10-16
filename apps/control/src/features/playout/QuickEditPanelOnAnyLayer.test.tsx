/**
 * "Edição rápida": a graphic loaded from a layer other than its own (apps/control)
 *
 * What this module is for:
 *   A rundown item can put a graphic on any layer: the race clock on the logo layer, for
 *   example. "Editar" on that layer's "Camadas" row loads that very instance into
 *   "Edição rápida": the form shows what it holds, "Atualizar" goes to its id, and
 *   "Colocar no ar" replaces it on ITS layer, because the panel works on that instance.
 *   With the same graphic on air on two layers, the panel works on the one loaded, never
 *   on the one taken most recently (that following was removed by BAJAOVRLAY-36).
 *
 * What these tests prove:
 *   - With the race clock on the logo layer loaded, the panel shows "Atualizar" and the
 *     form holds the on-air session name, flag and time.
 *   - "Atualizar" then sends `updateInstanceData` for that instance, with only the field
 *     the operator changed.
 *   - "Colocar no ar" sends `takeGraphic` for the logo layer, the layer of the instance
 *     loaded, and not for the race clock's default layer.
 *   - With two race clocks on air, the one loaded (taken earlier) is shown and updated,
 *     not the one taken later.
 *
 * What these tests deliberately do not cover:
 *   - How the panel decides what it works on: quickEditMode.test.ts.
 *   - The layer a new entry is taken on: QuickEditPanelNewTakeLayer.test.tsx.
 *   - Everything else "Atualizar" does; QuickEditPanelUpdate.test.tsx.
 */
import type { Instance } from '@bajaovrlay/shared';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { chooseOptionInDropdown } from '@/features/schemaForm/schemaFormOnTestPage.testSupport';

import {
  pressButtonAndWaitForCommand,
  pressEditOnTheLayerRow,
  readQuickEditHeader,
  referenceTimeLabel,
  renderQuickEditPanelWithTheseInstancesOnAir,
} from './operatingTheQuickEditPanel.testSupport';

// The Saturday of the endurance race, in Brasília time: the first clock went on air at
// 9:45 and the second at 9:55.
const quarterToTen = '2026-10-10T12:45:00.000Z';
const fiveToTen = '2026-10-10T12:55:00.000Z';

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

describe('the quick edit panel with the race clock on the logo layer loaded', () => {
  it('shows "Atualizar" and fills the form with what that clock holds', () => {
    // Arrange: an item put the first heat's clock on the logo layer; the clock layer is empty.
    renderQuickEditPanelWithTheseInstancesOnAir([buildFirstHeatClockOnTheLogoLayer()]);

    // Act: press "Editar" on the logo layer's row.
    pressEditOnTheLayerRow('Logo');

    // Assert: the panel works on that clock although it is not on the clock layer.
    expect(readQuickEditHeader(), 'the heading must name the logo layer').toBe(
      'Editando: Logo · Relógio de prova · No ar',
    );
    expect(
      screen.queryByRole('button', { name: 'Atualizar' }),
      'a loaded instance on air, on any layer, can be changed in place',
    ).not.toBeNull();
    expect(
      screen.getByLabelText<HTMLInputElement>('Título').value,
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
  });

  it('sends "Atualizar" to the instance on the logo layer, with only the changed field', async () => {
    // Arrange: the first heat's clock on the logo layer, loaded, and a yellow flag chosen.
    const { fakeServer } = renderQuickEditPanelWithTheseInstancesOnAir([
      buildFirstHeatClockOnTheLogoLayer(),
    ]);
    pressEditOnTheLayerRow('Logo');
    chooseOptionInDropdown('Bandeira', 'Amarela');

    // Act: press "Atualizar".
    await pressButtonAndWaitForCommand('Atualizar', 1, fakeServer);

    // Assert: the update names the instance on the logo layer and carries the flag only.
    expect(
      fakeServer.listCommandsReceived(),
      '"Atualizar" must update the instance loaded, wherever it is',
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

  it('sends "Colocar no ar" to the logo layer, where the loaded clock is', async () => {
    // Arrange: the first heat's clock on the logo layer, loaded; the form left as filled.
    const { fakeServer } = renderQuickEditPanelWithTheseInstancesOnAir([
      buildFirstHeatClockOnTheLogoLayer(),
    ]);
    pressEditOnTheLayerRow('Logo');

    // Act: press "Colocar no ar".
    await pressButtonAndWaitForCommand('Colocar no ar', 1, fakeServer);

    // Assert: a take for the layer of the loaded instance, which it replaces.
    expect(
      fakeServer.listCommandsReceived()[0],
      '"Colocar no ar" must go to the layer of the instance loaded, not to the default layer',
    ).toMatchObject({ type: 'takeGraphic', graphicId: 'race-clock', layerId: 'bug' });
    fakeServer.acceptLastCommand();
  });
});

describe('the quick edit panel with two race clocks on air', () => {
  it('works on the one loaded, not on the one taken most recently', async () => {
    // Arrange: the qualifying clock on the clock layer since 9:45, and the first heat's
    // clock put on the logo layer later, at 9:55. The operator loads the qualifying one.
    const laterClockOnTheLogoLayer = { ...buildFirstHeatClockOnTheLogoLayer(), takenAt: fiveToTen };
    const { fakeServer } = renderQuickEditPanelWithTheseInstancesOnAir([
      buildQualifyingClockOnTheClockLayer(quarterToTen),
      laterClockOnTheLogoLayer,
    ]);
    pressEditOnTheLayerRow('Relógio');

    // Act: the operator reads the panel, chooses the red flag and presses "Atualizar".
    const sessionNameShown = screen.getByLabelText<HTMLInputElement>('Título').value;
    chooseOptionInDropdown('Bandeira', 'Vermelha');
    await pressButtonAndWaitForCommand('Atualizar', 1, fakeServer);

    // Assert: the form held the loaded clock and the update went to it alone.
    expect(sessionNameShown, 'the form must hold the instance loaded').toBe('Classificatória');
    expect(
      fakeServer.listCommandsReceived(),
      '"Atualizar" must go to the instance loaded, even when another was taken later',
    ).toEqual([
      {
        type: 'updateInstanceData',
        instanceId: 'relogio-da-classificatoria-na-camada-relogio',
        data: { state: 'red' },
        takeTimeFieldKeys: [],
      },
    ]);
    fakeServer.acceptLastCommand();
  });
});
