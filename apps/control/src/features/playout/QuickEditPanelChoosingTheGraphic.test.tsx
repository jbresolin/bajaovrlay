/**
 * "Edição rápida": which graphic the panel shows, and a second graphic (apps/control)
 *
 * What this module is for:
 *   "Edição rápida" works for every graphic the server lists, with a form generated from
 *   that graphic's manifest. A dropdown says which graphic the form is for. The panel
 *   opens as a new entry of the first graphic listed; it shows another graphic only when
 *   the operator chooses it in the dropdown or loads an instance of it with "Editar" on a
 *   "Camadas" row. A take fired elsewhere never moves it (BAJAOVRLAY-36 removed the
 *   following of the graphic taken most recently). These tests use the lower third
 *   fixture next to the race clock: a graphic the control page has no code for.
 *
 * What these tests prove:
 *   - The dropdown lists every graphic by the name in its manifest.
 *   - The lower third loaded with "Editar" fills the form with what is on air, the two
 *     properties the form cannot edit shown for reading.
 *   - Choosing the lower third by hand brings a fresh form at that manifest's defaults,
 *     and "Colocar no ar" sends `takeGraphic` for that graphic on its own default layer.
 *   - "Colocar no ar" for a loaded graphic passes the properties the form cannot edit
 *     through untouched; "Atualizar" never sends them.
 *   - A graphic taken from elsewhere moves neither a new entry, nor a graphic chosen in
 *     the dropdown, nor a panel with an instance loaded.
 *   - When the loaded lower third leaves the air, the panel keeps its values, so
 *     "Colocar no ar" puts the same thing back.
 *   - Going to another graphic and back starts from a fresh form: the unsent edit is gone.
 *   - With no graphics on the server the panel says so and draws no form and no buttons.
 *
 * What these tests deliberately do not cover:
 *   - The rule of what the panel works on: quickEditMode.test.ts and
 *     QuickEditPanelTarget.test.tsx.
 *   - Every control of the lower third's form; features/schemaForm has its own tests.
 */
import type { Instance } from '@bajaovrlay/shared';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { buildLowerThirdDataForCar42 } from '@/features/schemaForm/lowerThirdFixtureSchema.testSupport';
import {
  chooseOptionInDropdown,
  typeIntoField,
} from '@/features/schemaForm/schemaFormOnTestPage.testSupport';
import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import { buildLowerThirdFixtureInstanceOnProgram } from '@/state/lowerThirdFixtureGraphic.testSupport';
import {
  buildRaceClockInstanceOnTheClockLayer,
  buildSlicesWithNothingOnAir,
} from '@/state/slicesLikeTheServerSends.testSupport';

import {
  pressButtonAndWaitForCommand,
  pressEditOnTheLayerRow,
  readQuickEditHeader,
  renderQuickEditPanelWithTheseInstancesOnAir,
} from './operatingTheQuickEditPanel.testSupport';
import { QuickEditPanel } from './QuickEditPanel';

// The Saturday of the endurance race, in Brasília time: the clock went on air at 9:45
// and the interview's lower third at 10:00.
const quarterToTen = '2026-10-10T12:45:00.000Z';
const tenOClock = '2026-10-10T13:00:00.000Z';

const graphicDropdownName = 'Gráfico a editar';

/** The lower third of Ana Souza (car 42, Baja UFPR) on the "Tarja" layer since 10:00. */
function buildLowerThirdOfCar42OnAirSinceTenOClock(): Instance {
  return buildLowerThirdFixtureInstanceOnProgram({
    id: 'tarja-da-ana-souza',
    layerId: 'lower-third',
    resolvedData: buildLowerThirdDataForCar42(),
    takenAt: tenOClock,
  });
}

/** What this page hears when the lower third is fired from the rundown at 10:00. */
function letTheLowerThirdGoOnAirNextToTheseInstances(
  fakeServer: ReturnType<typeof renderQuickEditPanelWithTheseInstancesOnAir>['fakeServer'],
  instancesAlreadyOnAir: Instance[],
): void {
  fakeServer.sendMessage({
    type: 'slice',
    name: 'instances',
    slice: [...instancesAlreadyOnAir, buildLowerThirdOfCar42OnAirSinceTenOClock()],
  });
}

describe('the graphic dropdown of "Edição rápida"', () => {
  it('lists every graphic the server sent, by the name in its manifest', () => {
    // Arrange: the panel with nothing on air; the server lists two graphics.
    renderQuickEditPanelWithTheseInstancesOnAir([]);

    // Act: open the dropdown from the keyboard.
    fireEvent.keyDown(screen.getByRole('combobox', { name: graphicDropdownName }), {
      key: 'Enter',
    });

    // Assert: both graphics are offered under their manifest names, in the server's order.
    expect(
      screen.getAllByRole('option').map((option) => option.textContent),
      'the dropdown must offer every graphic the server lists',
    ).toEqual(['Relógio de prova', 'Tarja de entrevista']);
  });

  it('shows the lower third loaded from its row, filled with what is on air', () => {
    // Arrange: the race clock on air since 9:45 and the lower third since 10:00.
    renderQuickEditPanelWithTheseInstancesOnAir([
      buildRaceClockInstanceOnTheClockLayer(quarterToTen),
      buildLowerThirdOfCar42OnAirSinceTenOClock(),
    ]);

    // Act: press "Editar" on the "Tarja" row.
    pressEditOnTheLayerRow('Tarja');

    // Assert: the panel is on the lower third, its form holds car 42's data, and the two
    // properties the form cannot edit are there to read.
    expect(
      screen.getByRole('combobox', { name: graphicDropdownName }),
      'the panel must show the graphic of the instance loaded',
    ).toHaveTextContent('Tarja de entrevista');
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

  it('brings a fresh form for the lower third when it is chosen, and takes it on its own layer', async () => {
    // Arrange: the panel with nothing on air, showing the race clock.
    const { fakeServer } = renderQuickEditPanelWithTheseInstancesOnAir([]);

    // Act: choose the lower third, fill its two required fields that have no default,
    // and press "Colocar no ar".
    chooseOptionInDropdown(graphicDropdownName, 'Tarja de entrevista');
    const raceClockFieldAfterTheChoice = screen.queryByLabelText('Título');
    const teamShownBeforeTyping = screen.getByRole('combobox', { name: 'Equipe' }).textContent;
    typeIntoField('Nome', 'Ana Souza');
    typeIntoField('Número do carro', '42');
    await pressButtonAndWaitForCommand('Colocar no ar', 1, fakeServer);

    // Assert: the race clock's fields are gone, the lower third opened at its manifest
    // defaults, and the take names the lower third and its default layer. The optional
    // fields left blank are not in the data, and no field is left to the server to fill.
    expect(
      raceClockFieldAfterTheChoice,
      'the form of the graphic left behind must not stay on screen',
    ).toBeNull();
    expect(teamShownBeforeTyping, 'the team must start at the manifest default').toBe('Baja UFPR');
    expect(
      fakeServer.listCommandsReceived(),
      "the take must be for the chosen graphic, on that graphic's default layer",
    ).toEqual([
      {
        type: 'takeGraphic',
        graphicId: 'lower-third-fixture',
        layerId: 'lower-third',
        data: {
          nome: 'Ana Souza',
          equipe: 'baja-ufpr',
          duracaoMs: 8_000,
          destaque: false,
          numeroDoCarro: 42,
        },
        takeTimeFieldKeys: [],
      },
    ]);
    fakeServer.acceptLastCommand();
  });

  it('passes the properties the form cannot edit through a take, and leaves them out of an update', async () => {
    // Arrange: the lower third on air with its sponsors (a list) and social networks (a
    // nested object), which the form shows for reading only. The operator loads it with
    // "Editar" and corrects the name.
    const { fakeServer } = renderQuickEditPanelWithTheseInstancesOnAir([
      buildLowerThirdOfCar42OnAirSinceTenOClock(),
    ]);
    pressEditOnTheLayerRow('Tarja');
    typeIntoField('Nome', 'Ana Souza Lima');

    // Act: press "Atualizar"; the server refuses it, so the edit stays pending, and the
    // operator then presses "Colocar no ar".
    await pressButtonAndWaitForCommand('Atualizar', 1, fakeServer);
    fakeServer.refuseLastCommand({
      code: 'INSTANCE_NOT_FOUND',
      message: 'Este gráfico não está mais no ar.',
    });
    await screen.findByRole('alert');
    await pressButtonAndWaitForCommand('Colocar no ar', 2, fakeServer);

    // Assert: the update carried the name alone. The take carried the whole data, the
    // sponsors and social networks exactly as they were on air: replacing the instance
    // must not lose what the form could not show as fields.
    expect(
      fakeServer.listCommandsReceived()[0],
      '"Atualizar" must not send a property the form cannot edit',
    ).toEqual({
      type: 'updateInstanceData',
      instanceId: 'tarja-da-ana-souza',
      data: { nome: 'Ana Souza Lima' },
      takeTimeFieldKeys: [],
    });
    expect(
      fakeServer.listCommandsReceived()[1],
      '"Colocar no ar" must carry the properties the form cannot edit as they were on air',
    ).toEqual({
      type: 'takeGraphic',
      graphicId: 'lower-third-fixture',
      layerId: 'lower-third',
      data: { ...buildLowerThirdDataForCar42(), nome: 'Ana Souza Lima' },
      takeTimeFieldKeys: [],
    });
    fakeServer.acceptLastCommand();
  });
});

describe('"Edição rápida" when another graphic goes on air', () => {
  const scenariosWhereTheLowerThirdIsFiredFromTheRundown: Array<{
    name: string;
    whatTheOperatorDidBefore: () => void;
    expectedHeading: string;
  }> = [
    // Nobody is using the panel: it stays a new entry of the first graphic listed.
    {
      name: 'a new entry stays on the race clock',
      whatTheOperatorDidBefore: () => undefined,
      expectedHeading: 'Nova entrada — não altera nenhum item',
    },
    // The operator said which graphic they want: the panel must not second-guess them.
    {
      name: 'a panel whose operator chose the race clock in the dropdown stays on it',
      whatTheOperatorDidBefore: () => {
        chooseOptionInDropdown(graphicDropdownName, 'Tarja de entrevista');
        chooseOptionInDropdown(graphicDropdownName, 'Relógio de prova');
      },
      expectedHeading: 'Nova entrada — não altera nenhum item',
    },
    // The operator loaded the race clock to change it: it stays the one being edited.
    {
      name: 'a panel with the race clock loaded stays on it',
      whatTheOperatorDidBefore: () => pressEditOnTheLayerRow('Relógio'),
      expectedHeading: 'Editando: Relógio · Relógio de prova · No ar',
    },
  ];

  it.each(scenariosWhereTheLowerThirdIsFiredFromTheRundown)(
    '$name',
    ({ whatTheOperatorDidBefore, expectedHeading }) => {
      // Arrange: the race clock on air since 9:45, and the operator having done what the
      // scenario says.
      const raceClockOnAir = buildRaceClockInstanceOnTheClockLayer(quarterToTen);
      const { fakeServer } = renderQuickEditPanelWithTheseInstancesOnAir([raceClockOnAir]);
      whatTheOperatorDidBefore();

      // Act: the lower third is fired from the rundown at 10:00.
      letTheLowerThirdGoOnAirNextToTheseInstances(fakeServer, [raceClockOnAir]);

      // Assert: the panel is still on the race clock, doing what it was doing.
      expect(
        screen.getByRole('combobox', { name: graphicDropdownName }),
        'a take fired elsewhere must never move the panel to another graphic',
      ).toHaveTextContent('Relógio de prova');
      expect(readQuickEditHeader(), 'a take fired elsewhere must not change what is edited').toBe(
        expectedHeading,
      );
    },
  );

  it('starts from a fresh form when the operator goes to another graphic and comes back', () => {
    // Arrange: the panel with nothing on air, and a session name typed and not sent.
    renderQuickEditPanelWithTheseInstancesOnAir([]);
    typeIntoField('Título', 'Enduro — Bateria 2');

    // Act: choose the lower third, then the race clock again.
    chooseOptionInDropdown(graphicDropdownName, 'Tarja de entrevista');
    chooseOptionInDropdown(graphicDropdownName, 'Relógio de prova');

    // Assert: the typed name is gone and the manifest default is back. Each graphic's
    // form lives only while it is the chosen one.
    expect(
      screen.getByLabelText('Título'),
      'coming back to a graphic must start its form again from the defaults',
    ).toHaveValue('Enduro de Resistência');
  });
});

describe('"Edição rápida" when the loaded lower third leaves the air', () => {
  it('keeps the values that were on air, so "Colocar no ar" puts the same thing back', async () => {
    // Arrange: the race clock on air since 9:45 and the lower third since 10:00; the
    // operator loaded the lower third and touched nothing.
    const raceClockOnAir = buildRaceClockInstanceOnTheClockLayer(quarterToTen);
    const { fakeServer } = renderQuickEditPanelWithTheseInstancesOnAir([
      raceClockOnAir,
      buildLowerThirdOfCar42OnAirSinceTenOClock(),
    ]);
    pressEditOnTheLayerRow('Tarja');

    // Act: the lower third leaves the air (someone pressed "Limpar" on its layer, or its
    // time ran out); the race clock stays. Then the operator presses "Colocar no ar".
    fakeServer.sendMessage({ type: 'slice', name: 'instances', slice: [raceClockOnAir] });
    const graphicShownAfterTheLowerThirdLeft = screen.getByRole('combobox', {
      name: graphicDropdownName,
    }).textContent;
    const updateButtonAfterTheLowerThirdLeft = screen.queryByRole('button', { name: 'Atualizar' });
    await pressButtonAndWaitForCommand('Colocar no ar', 1, fakeServer);

    // Assert: the panel did not jump to the race clock, "Atualizar" is gone, and the take
    // puts back exactly the lower third that was on air, on its layer.
    expect(
      graphicShownAfterTheLowerThirdLeft,
      'the panel must stay on the graphic that just left the air',
    ).toBe('Tarja de entrevista');
    expect(
      updateButtonAfterTheLowerThirdLeft,
      'there is nothing to update once the graphic is off air',
    ).toBeNull();
    expect(
      fakeServer.listCommandsReceived()[0],
      '"Colocar no ar" must put back the lower third as it was on air',
    ).toEqual({
      type: 'takeGraphic',
      graphicId: 'lower-third-fixture',
      layerId: 'lower-third',
      data: buildLowerThirdDataForCar42(),
      takeTimeFieldKeys: [],
    });
    fakeServer.acceptLastCommand();
  });
});

describe('"Edição rápida" with no graphics on the server', () => {
  it('says so and draws no form and no buttons', () => {
    // Arrange: a server with no built graphic package at all.
    const slicesWithoutGraphics = { ...buildSlicesWithNothingOnAir(), graphics: [] };

    // Act: draw the panel.
    renderOnControlPageConnectedToFakeServer(<QuickEditPanel />, slicesWithoutGraphics);

    // Assert: a plain pt-BR line, and nothing to press.
    expect(
      screen.getByText('O servidor não enviou nenhum gráfico.'),
      'the panel must say why it has no form',
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Colocar no ar' }),
      'with no graphic there is nothing to take',
    ).toBeNull();
    expect(screen.queryByRole('combobox'), 'with no graphic there is nothing to choose').toBeNull();
  });
});
