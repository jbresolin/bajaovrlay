/**
 * "Valor agora" follows every slice it reads (apps/control)
 *
 * What this module is for:
 *   Since BAJAOVRLAY-45 the item editor redraws nothing when a slice arrives; only a bound
 *   field's "Valor agora" line listens to the store, and only it redraws, when its text
 *   changes. Before, every slice redrew the whole form, which kept the line right by
 *   accident whatever slice changed. These tests prove the line still follows each slice
 *   it reads besides the data itself (ItemEditorPanelRenders.test.tsx covers a poll).
 *
 * What these tests prove, on a stored battle card whose fields read cars 31 and 38 live,
 * each car picked once as the card opens (BAJAOVRLAY-66), the team's line read in the car
 * behind's "Valores agora":
 *   - A correction of car 38's team arriving (the overrides slice) turns the team's line
 *     into the corrected name with "(corrigido)".
 *   - The simulator renamed (the dataSources slice): the car behind's "Fonte de …" dropdown
 *     shows the new name, and the line still reads the team.
 *   - The simulator deleted: the line says the source no longer exists.
 *   The correction reaches the line through its own subscription alone (with that
 *   subscription doing nothing, the first test fails). A rename or a deletion changes the
 *   list of sources, which hands every bound field new options and so redraws it as well.
 *
 * What these tests deliberately do not cover:
 *   - A team edited in Cadastros reaching a withTeamLogos binding: the battle card has none;
 *     the resolution's own tests (packages/shared bindingResolution) cover the teams.
 *   - What the server does with a correction or a deleted source: apps/server's tests.
 */
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  buildBattleCardOfTheLeadersItem,
  buildDataSourcesSliceWithNoSourceLeft,
  buildDataSourcesSliceWithTheSimulatorRenamed,
  buildOverridesSliceWithTheSecondCarsTeamCorrected,
  buildSlicesWithTheBattleCardOfTheLeaders,
  findRowOfField,
} from './battleCardOfTheLeaders.testSupport';
import { renderItemEditorPanelOnFakeServerWithSlices } from './itemEditorOnFakeServer.testSupport';

// The row these tests read: the team of the car behind, car 38, "Coruja Racing".
const secondCarsTeamLabel = 'Equipe do carro de trás';

/** Opens the editor on the stored battle card of the two leaders, the race at lap 34. */
function renderEditorOnTheBattleCardOfTheLeaders() {
  return renderItemEditorPanelOnFakeServerWithSlices(
    buildBattleCardOfTheLeadersItem(),
    buildSlicesWithTheBattleCardOfTheLeaders(),
  );
}

/** The "Valor agora" text of one field's row, as the operator reads it. */
function readValueNowOfField(fieldLabel: string): string {
  const valueNowLine = within(findRowOfField(fieldLabel)).getByText(/agora/);
  return valueNowLine.textContent ?? '';
}

describe('"Valor agora" on a battle card read live', () => {
  it('shows the corrected team with "(corrigido)" once a correction arrives', () => {
    // Arrange: the editor open on the battle card, car 38's team as the simulator sends it.
    const { fakeServer } = renderEditorOnTheBattleCardOfTheLeaders();
    const valueNowBefore = readValueNowOfField(secondCarsTeamLabel);

    // Act: the corrections slice arrives with car 38's team corrected.
    fakeServer.sendMessage(buildOverridesSliceWithTheSecondCarsTeamCorrected());

    // Assert: the line read the simulator's name before, and the correction after.
    expect(valueNowBefore, 'before the correction, the simulator’s name').toBe(
      'Valor agora: Coruja Racing',
    );
    expect(
      readValueNowOfField(secondCarsTeamLabel),
      'the line must follow the correction, marked as corrected',
    ).toBe('Valor agora: Coruja Racing EESC (corrigido)');
  });

  it('follows a renamed source, in the dropdown and in the line', () => {
    // Arrange: the editor open on the battle card, the source named "Simulador — Enduro".
    const { fakeServer } = renderEditorOnTheBattleCardOfTheLeaders();

    // Act: the sources slice arrives with the simulator renamed.
    fakeServer.sendMessage(buildDataSourcesSliceWithTheSimulatorRenamed('Simulador — Ensaio'));

    // Assert: the dropdown names the source anew, and the line still reads car 38's team.
    expect(
      screen.getByRole('combobox', { name: 'Fonte de Carro de trás' }),
      'the source dropdown must show the new name',
    ).toHaveTextContent('Simulador — Ensaio');
    expect(
      readValueNowOfField(secondCarsTeamLabel),
      'a rename must not change what the field reads',
    ).toBe('Valor agora: Coruja Racing');
  });

  it('says why there is nothing to read once the source is deleted', () => {
    // Arrange: the editor open on the battle card, reading the simulator.
    const { fakeServer } = renderEditorOnTheBattleCardOfTheLeaders();

    // Act: the sources slice arrives without the simulator.
    fakeServer.sendMessage(buildDataSourcesSliceWithNoSourceLeft());

    // Assert: the line gives the pt-BR reason a take would be refused with.
    expect(readValueNowOfField(secondCarsTeamLabel), 'the line must say the source is gone').toBe(
      'Não dá para ler agora: a fonte de dados "simulador-enduro" não existe.',
    );
  });
});
