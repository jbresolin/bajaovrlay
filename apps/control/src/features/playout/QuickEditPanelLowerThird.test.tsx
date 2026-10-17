/**
 * "Edição rápida" on a graphic other than the race clock: the lower third (apps/control)
 *
 * What this module is for:
 *   "Edição rápida" draws the form of whatever graphic the loaded instance shows, from
 *   that graphic's manifest; nothing in it is written for one graphic. The lower third
 *   fixture has text, a dropdown, a duration and properties the form cannot edit (a list
 *   and a nested object), which it shows for reading only.
 *
 * What these tests prove:
 *   - The lower third loaded with "Editar" fills the form with what is on air, names the
 *     instance in the heading, and shows the properties the form cannot edit for reading.
 *   - "Atualizar" sends only the field changed, never a property the form cannot edit.
 *
 * What these tests deliberately do not cover:
 *   - Loading, losing and letting go of an instance: QuickEditPanelTarget.test.tsx.
 *   - Every control of the lower third's form; features/schemaForm has its own tests.
 */
import type { Instance } from '@bajaovrlay/shared';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { buildLowerThirdDataForCar42 } from '@/features/schemaForm/lowerThirdFixtureSchema.testSupport';
import { typeIntoField } from '@/features/schemaForm/schemaFormOnTestPage.testSupport';
import { buildLowerThirdFixtureInstanceOnProgram } from '@/state/lowerThirdFixtureGraphic.testSupport';
import { buildRaceClockInstanceOnTheClockLayer } from '@/state/slicesLikeTheServerSends.testSupport';

import {
  pressButtonAndWaitForCommand,
  pressEditOnTheLayerRow,
  readQuickEditHeader,
  renderQuickEditPanelWithTheseInstancesOnAir,
} from './operatingTheQuickEditPanel.testSupport';

// The Saturday of the endurance race, in Brasília time: the clock went on air at 9:45
// and the interview's lower third at 10:00.
const quarterToTen = '2026-10-10T12:45:00.000Z';
const tenOClock = '2026-10-10T13:00:00.000Z';

/** The lower third of Ana Souza (car 42, Baja UFPR) on the "Tarja" layer since 10:00. */
function buildLowerThirdOfCar42OnAirSinceTenOClock(): Instance {
  return buildLowerThirdFixtureInstanceOnProgram({
    id: 'tarja-da-ana-souza',
    layerId: 'lower-third',
    resolvedData: buildLowerThirdDataForCar42(),
    takenAt: tenOClock,
  });
}

describe('"Edição rápida" with the lower third loaded', () => {
  it('fills the form with what is on air, the properties it cannot edit shown for reading', () => {
    // Arrange: the race clock on air since 9:45 and the lower third since 10:00.
    renderQuickEditPanelWithTheseInstancesOnAir([
      buildRaceClockInstanceOnTheClockLayer(quarterToTen),
      buildLowerThirdOfCar42OnAirSinceTenOClock(),
    ]);

    // Act: press "Editar" on the "Tarja" row.
    pressEditOnTheLayerRow('Tarja');

    // Assert: the heading names the lower third on air, its form holds car 42's data, and
    // the two properties the form cannot edit are there to read.
    expect(readQuickEditHeader(), 'the heading must name the instance loaded').toBe(
      'Editando: Tarja · Tarja de entrevista · No ar',
    );
    expect(screen.getByLabelText('Nome'), 'the name must be the one on air').toHaveValue(
      'Ana Souza',
    );
    expect(
      screen.getByRole('combobox', { name: 'Equipe' }),
      'the team must be the one on air, under its label',
    ).toHaveTextContent('Baja UFPR');
    expect(
      screen.getByLabelText('Tempo no ar'),
      'the 8 000 ms on air must show as minutes and seconds',
    ).toHaveValue('0:08');
    expect(
      screen.getByLabelText<HTMLTextAreaElement>('Patrocinadores').value,
      'a list the form cannot edit must be shown as JSON for reading',
    ).toContain('Oficina do Zé');
    expect(
      screen.getByRole('button', { name: 'Atualizar' }),
      'the lower third loaded is on air, so "Atualizar" must be offered',
    ).toBeInTheDocument();
  });

  it('sends only the field changed, never a property the form cannot edit', async () => {
    // Arrange: the lower third on air with its sponsors (a list) and social networks (a
    // nested object), loaded with "Editar", and its name corrected.
    const { fakeServer } = renderQuickEditPanelWithTheseInstancesOnAir([
      buildLowerThirdOfCar42OnAirSinceTenOClock(),
    ]);
    pressEditOnTheLayerRow('Tarja');
    typeIntoField('Nome', 'Ana Souza Lima');

    // Act: press "Atualizar".
    await pressButtonAndWaitForCommand('Atualizar', 1, fakeServer);

    // Assert: the update carried the name alone.
    expect(
      fakeServer.listCommandsReceived(),
      '"Atualizar" must not send a property the form cannot edit',
    ).toEqual([
      {
        type: 'updateInstanceData',
        instanceId: 'tarja-da-ana-souza',
        data: { nome: 'Ana Souza Lima' },
        takeTimeFieldKeys: [],
      },
    ]);
    fakeServer.acceptLastCommand();
  });
});
