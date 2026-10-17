/**
 * The layer of a new entry in "Edição rápida" (apps/control)
 *
 * What this module is for:
 *   With nothing loaded from "Camadas", "Edição rápida" makes a new entry: the operator
 *   picks a graphic and, since BAJAOVRLAY-36, a layer ("Camada da nova entrada"), which
 *   starts on the graphic's default layer. "Colocar no ar" and "Prévia" both use the
 *   layer chosen there, so a race clock can go on the "Tarja" layer without preparing an
 *   item first.
 *
 * What these tests prove:
 *   - The layer dropdown starts on the chosen graphic's default layer, and moves to the
 *     default of another graphic when that graphic is chosen.
 *   - "Colocar no ar" and "Prévia" send the layer chosen in the dropdown.
 *   - While an instance is loaded the dropdown is not offered: the heading names the
 *     instance's layer, and that is where its commands go.
 *
 * What these tests deliberately do not cover:
 *   - Loading an instance and what happens when it goes: QuickEditPanelTarget.test.tsx.
 *   - The data a take carries, field by field: QuickEditPanel.test.tsx.
 */
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { chooseOptionInDropdown } from '@/features/schemaForm/schemaFormOnTestPage.testSupport';
import { buildRaceClockInstanceOnTheClockLayer } from '@/state/slicesLikeTheServerSends.testSupport';

import {
  pressButtonAndWaitForCommand,
  pressEditOnTheLayerRow,
  renderQuickEditPanelWithTheseInstancesOnAir,
} from './operatingTheQuickEditPanel.testSupport';

const layerDropdownName = 'Camada da nova entrada';

describe('the layer of a new entry in "Edição rápida"', () => {
  it("starts on the graphic's default layer and follows a newly chosen graphic", () => {
    // Arrange: nothing on air; the panel opens on the race clock.
    renderQuickEditPanelWithTheseInstancesOnAir([]);
    const layerShownForTheClock = screen.getByRole('combobox', {
      name: layerDropdownName,
    }).textContent;

    // Act: choose the lower third.
    chooseOptionInDropdown('Gráfico a editar', 'Tarja de entrevista');

    // Assert: the clock started on "Relógio", the lower third on "Tarja".
    expect(layerShownForTheClock, 'the race clock defaults to the clock layer').toBe('Relógio');
    expect(
      screen.getByRole('combobox', { name: layerDropdownName }),
      "choosing a graphic moves the layer to that graphic's default",
    ).toHaveTextContent('Tarja');
  });

  const commandScenarios = [
    // "Colocar no ar" on another layer than the default: a clock on the "Tarja" layer.
    {
      name: '"Colocar no ar" sends the chosen layer',
      buttonName: 'Colocar no ar',
      type: 'takeGraphic',
    },
    // "Prévia" goes to the same layer, so what is seen is where it will go.
    { name: '"Prévia" sends the chosen layer', buttonName: 'Prévia', type: 'previewGraphic' },
  ];

  it.each(commandScenarios)('$name', async ({ buttonName, type }) => {
    // Arrange: the race clock, moved to the "Tarja" layer in the dropdown.
    const { fakeServer } = renderQuickEditPanelWithTheseInstancesOnAir([]);
    chooseOptionInDropdown(layerDropdownName, 'Tarja');

    // Act: press the button.
    await pressButtonAndWaitForCommand(buttonName, 1, fakeServer);

    // Assert: the command names the race clock and the "Tarja" layer.
    expect(
      fakeServer.listCommandsReceived(),
      `"${buttonName}" must use the layer chosen for the new entry`,
    ).toEqual([expect.objectContaining({ type, graphicId: 'race-clock', layerId: 'lower-third' })]);
  });

  it('is not offered while an instance is loaded', () => {
    // Arrange: the race clock on air.
    renderQuickEditPanelWithTheseInstancesOnAir([
      buildRaceClockInstanceOnTheClockLayer('2026-10-10T13:00:00.000Z'),
    ]);

    // Act: load it from its row.
    pressEditOnTheLayerRow('Relógio');

    // Assert: no layer dropdown; the heading says which layer is being edited.
    expect(
      screen.queryByRole('combobox', { name: layerDropdownName }),
      'a loaded instance stays on its own layer',
    ).toBeNull();
  });
});
