/**
 * "Edição rápida" with the race clock (apps/control)
 *
 * What this module is for:
 *   The centre panel where the operator fills a graphic's data and puts it on air with
 *   "Colocar no ar". While that graphic is on air a second button, "Atualizar", sends only
 *   what the operator touched, as an `updateInstanceData` for the instance on air. The
 *   graphic changes in place, so a flag change in the middle of a race never takes the
 *   clock off the screen. The form is generated from the graphic's manifest; these tests
 *   use the real race clock manifest.
 *
 * What these tests prove:
 *   - With nothing on air the form opens with the manifest's defaults, the reference
 *     moment set to "filled by the server", and no "Atualizar".
 *   - "Colocar no ar" sends one `takeGraphic` for the graphic's default layer, built from
 *     what was typed and chosen. The reference moment is not in the data: it is named in
 *     `takeTimeFieldKeys` for the server to fill. A blank optional field is left out.
 *   - Pressing Enter in a field sends nothing.
 *   - When the page loads with the clock already on air (a reload in the middle of a
 *     race), the form shows what is on air as the server holds it; the one exception is
 *     the time, which shows what the screen shows at that moment.
 *   - "Atualizar" after such a reload sends `updateInstanceData` naming the instance on
 *     air and holding only what the operator changed; a field cleared with "limpar" goes
 *     as null; a field switched to "filled by the server" is named in `takeTimeFieldKeys`.
 *   - "Atualizar" with nothing changed sends nothing.
 *
 * What these tests deliberately do not cover:
 *   - The form after a command the server accepted, and on-air data the form cannot show
 *     or refuses: QuickEditPanelUpdate.test.tsx.
 *   - Someone else changing the graphic on air: QuickEditPanelOtherOperator.test.tsx.
 *   - Field messages, refusals and a dropped connection: QuickEditPanelProblems.test.tsx.
 *   - Another graphic, and which graphic the panel shows: QuickEditPanelChoosingTheGraphic.test.tsx.
 *   - Every control and every rule of a generated form: features/schemaForm has its own tests.
 *   - The time field following the screen second by second, and what the cursor and
 *     typing do to it: QuickEditPanelTimeOnScreen.test.tsx.
 *   - The clock's arithmetic. What the panel sends knows no clock rule: a typed time or
 *     a stopped clock goes out as that one field (see the scenarios below). The server
 *     is what keeps the clock from jumping: the race clock's manifest names the update
 *     rule `carryClockForward`, which also writes the time on screen and the moment of
 *     the update. QuickEditPanelUpdate.test.tsx shows the form taking that answer.
 *   - The real server filling the moment, carrying the clock forward and laying the
 *     fields over what is on air; apps/server's tests prove that, and e2e walks it in a
 *     real browser (clockStoppedOnAir.e2e.ts for the clock not jumping).
 */
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  chooseOptionInDropdown,
  flipSwitch,
  pressButton,
  typeIntoField,
} from '@/features/schemaForm/schemaFormOnTestPage.testSupport';

import {
  buildRaceClockInstanceHoldingThisData,
  holdThePageClockAt,
  idOfTheRaceClockInstanceOnAir,
  lapsLabel,
  pressButtonAndWaitForCommand,
  pressButtonAndWaitUntilThePressIsOver,
  referenceMomentKindSelectorName,
  referenceMomentLabel,
  referenceTimeLabel,
  renderQuickEditPanelWithTheseInstancesOnAir,
} from './operatingTheQuickEditPanel.testSupport';

// The clock went on air at 9:45 in Brasília on the Saturday of the endurance race, and
// the page is reloaded at 10:00, fifteen minutes later.
const momentTheClockWentOnAir = '2026-10-10T12:45:00.000Z';
const momentThePageIsReloaded = '2026-10-10T13:00:00.000Z';

/**
 * Draws the panel the way a reload in the middle of the race finds it: the first heat
 * has been on air since 9:45 under the green flag, running from 754 000 ms (12:34), with
 * 7 laps for the leader.
 */
function renderPanelAfterAReloadWithTheFirstHeatOnAir() {
  const raceClockInstanceOnAir = buildRaceClockInstanceHoldingThisData(
    {
      sessionName: 'Enduro de Resistência — Bateria 1',
      state: 'green',
      clockMode: 'elapsed',
      referenceTimeMs: 754_000,
      referenceWallClockMs: Date.parse(momentTheClockWentOnAir),
      running: true,
      lapsCompletedByLeader: 7,
    },
    momentTheClockWentOnAir,
  );
  return renderQuickEditPanelWithTheseInstancesOnAir([raceClockInstanceOnAir]);
}

describe('"Edição rápida" with the race clock and nothing on air', () => {
  it('opens on the race clock with the manifest defaults and only the "Colocar no ar" button', () => {
    // Arrange: nothing on air; the race clock is the first graphic the server lists.

    // Act: draw the panel.
    renderQuickEditPanelWithTheseInstancesOnAir([]);

    // Assert: the panel is titled, shows the race clock, each field shows the default
    // its manifest declares, and there is nothing to update yet.
    expect(
      screen.getByRole('heading', { name: 'Edição rápida' }),
      'the panel must be titled "Edição rápida"',
    ).toBeInTheDocument();
    expect(
      screen.getByRole('combobox', { name: 'Gráfico a editar' }),
      'the graphic dropdown must show the race clock by the name in its manifest',
    ).toHaveTextContent('Relógio de prova');
    expect(
      screen.getByLabelText('Nome da sessão'),
      'the session name must start as the manifest default',
    ).toHaveValue('Enduro de Resistência');
    expect(
      screen.getByRole('combobox', { name: 'Bandeira' }),
      'the flag must start as "Pré-largada"',
    ).toHaveTextContent('Pré-largada');
    expect(
      screen.getByRole('combobox', { name: 'Modo do relógio' }),
      'the clock mode must start as "Tempo decorrido"',
    ).toHaveTextContent('Tempo decorrido');
    expect(
      screen.getByRole('switch', { name: 'Relógio correndo' }),
      'the clock must start stopped',
    ).not.toBeChecked();
    expect(
      screen.getByLabelText(referenceTimeLabel),
      'the reference time must start at zero, typed as mm:ss',
    ).toHaveValue('0:00');
    expect(
      screen.getByRole('combobox', { name: referenceMomentKindSelectorName }),
      'the reference moment must start as "filled by the server at the take"',
    ).toHaveTextContent('Momento da entrada no ar');
    expect(screen.getByLabelText(lapsLabel), 'the laps must start blank').toHaveValue(null);
    expect(
      screen.getByRole('button', { name: 'Colocar no ar' }),
      'the take button must be there',
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Atualizar' }),
      'there is nothing to update while the clock is off air',
    ).toBeNull();
  });

  it('sends takeGraphic with what was typed and chosen, and asks the server for the reference moment', async () => {
    // Arrange: the panel filled for the endurance race, 12 min 34 s in, under green.
    const { fakeServer } = renderQuickEditPanelWithTheseInstancesOnAir([]);
    typeIntoField('Nome da sessão', 'Enduro de Resistência — Bateria 1');
    chooseOptionInDropdown('Bandeira', 'Verde');
    chooseOptionInDropdown('Modo do relógio', 'Tempo restante');
    flipSwitch('Relógio correndo');
    typeIntoField(referenceTimeLabel, '12:34');
    typeIntoField(lapsLabel, '7');

    // Act: press "Colocar no ar".
    await pressButtonAndWaitForCommand('Colocar no ar', 1, fakeServer);

    // Assert: one takeGraphic for the clock layer (the race clock's default layer). The
    // data holds what the form holds, and the reference moment is not in it: the server
    // is asked to write the moment of the take there, so this page reads no clock.
    expect(
      fakeServer.listCommandsReceived(),
      'the press must send exactly one takeGraphic with the form data',
    ).toEqual([
      {
        type: 'takeGraphic',
        graphicId: 'race-clock',
        layerId: 'clock',
        data: {
          sessionName: 'Enduro de Resistência — Bateria 1',
          state: 'green',
          clockMode: 'remaining',
          referenceTimeMs: 754_000,
          running: true,
          lapsCompletedByLeader: 7,
        },
        takeTimeFieldKeys: ['referenceWallClockMs'],
      },
    ]);
    // (Then the server answers, so no command is left waiting for its 5-second timeout
    // once the test is over.)
    fakeServer.acceptLastCommand();
  });

  it('leaves a blank optional field out of the take', async () => {
    // Arrange: the panel as it opens; the laps, the one optional field, are blank.
    const { fakeServer } = renderQuickEditPanelWithTheseInstancesOnAir([]);

    // Act: press "Colocar no ar".
    await pressButtonAndWaitForCommand('Colocar no ar', 1, fakeServer);

    // Assert: the defaults go out and the laps are not in the data at all, neither as
    // null nor as zero, so the graphic shows no lap count.
    expect(
      fakeServer.listCommandsReceived()[0],
      'a field with no value must be left out of the take',
    ).toEqual({
      type: 'takeGraphic',
      graphicId: 'race-clock',
      layerId: 'clock',
      data: {
        sessionName: 'Enduro de Resistência',
        state: 'pre',
        clockMode: 'elapsed',
        referenceTimeMs: 0,
        running: false,
      },
      takeTimeFieldKeys: ['referenceWallClockMs'],
    });
    fakeServer.acceptLastCommand();
  });

  it('sends nothing when Enter is pressed in a field', () => {
    // Arrange: the panel as it opens.
    const { fakeServer } = renderQuickEditPanelWithTheseInstancesOnAir([]);
    const formAroundTheFields = screen.getByLabelText('Nome da sessão').closest('form');
    if (formAroundTheFields === null) {
      throw new Error('the session name field is not inside a form');
    }

    // Act: the browser submits the form, which is what Enter in a text field makes it
    // do. `fireEvent` answers false when the page told the browser "do not do that".
    const wasLeftToTheBrowser = fireEvent.submit(formAroundTheFields);

    // Assert: the submit was cancelled and no command left the page.
    expect(wasLeftToTheBrowser, 'the page must cancel the form submit').toBe(false);
    expect(
      fakeServer.listCommandsReceived(),
      'Enter in a field must never put a graphic on air',
    ).toEqual([]);
  });
});

describe('"Edição rápida" after a reload with the race clock on air', () => {
  it('shows what is on air as the server holds it, and in the time field the time on screen', () => {
    // Arrange: the first heat on air since 9:45, running from 12:34 (see the factory).
    // The page's clock reads 10:00.
    holdThePageClockAt(momentThePageIsReloaded);

    // Act: the page is loaded, as after a reload.
    renderPanelAfterAReloadWithTheFirstHeatOnAir();

    // Assert: the form is not at its defaults; it repeats what is on air. The time is
    // the 27:34 the screen shows at 10:00, not the 12:34 the server holds as the
    // reference, and the reference moment is a typed value: the number that is on air.
    expect(
      screen.getByLabelText('Nome da sessão'),
      'the session name must be the one on air',
    ).toHaveValue('Enduro de Resistência — Bateria 1');
    expect(
      screen.getByRole('combobox', { name: 'Bandeira' }),
      'the flag must be the one on air',
    ).toHaveTextContent('Verde');
    expect(
      screen.getByRole('combobox', { name: 'Modo do relógio' }),
      'the clock mode must be the one on air',
    ).toHaveTextContent('Tempo decorrido');
    expect(
      screen.getByRole('switch', { name: 'Relógio correndo' }),
      'the switch must be on, because the clock on air is running',
    ).toBeChecked();
    expect(
      screen.getByLabelText(referenceTimeLabel),
      'the time must be the one on screen: 12:34 plus the fifteen minutes since 9:45',
    ).toHaveValue('27:34');
    expect(
      screen.getByRole('combobox', { name: referenceMomentKindSelectorName }),
      'the reference moment on air is a number, so it must show as a typed value',
    ).toHaveTextContent('Valor digitado');
    expect(
      screen.getByLabelText(referenceMomentLabel),
      'the reference moment must be the number on air',
    ).toHaveValue(Date.parse(momentTheClockWentOnAir));
    expect(screen.getByLabelText(lapsLabel), 'the laps must be the ones on air').toHaveValue(7);
    expect(
      screen.getByRole('button', { name: 'Atualizar' }),
      'with the clock on air the panel must offer "Atualizar"',
    ).toBeInTheDocument();
  });

  const scenariosWhereAtualizarIsPressedAfterAReload: Array<{
    name: string;
    whatTheOperatorDoes: () => void;
    expectedData: Record<string, unknown>;
    expectedTakeTimeFieldKeys: string[];
  }> = [
    // The trap this rule closes: a reload, then a yellow flag. Only the flag is sent, so
    // the session name, the laps and the running clock are not touched.
    {
      name: 'the operator changes only the flag: only the flag is sent',
      whatTheOperatorDoes: () => chooseOptionInDropdown('Bandeira', 'Amarela'),
      expectedData: { state: 'yellow' },
      expectedTakeTimeFieldKeys: [],
    },
    // A generated form knows no clock rule, so the typed 20:00 (1 200 000 ms) goes out
    // alone. The clock does not jump for it: the server writes the moment of the update
    // as the new reference, so the clock counts on from 20:00.
    {
      name: 'the operator types a new time: that time goes out alone',
      whatTheOperatorDoes: () => typeIntoField(referenceTimeLabel, '20:00'),
      expectedData: { referenceTimeMs: 1_200_000 },
      expectedTakeTimeFieldKeys: [],
    },
    // The operator may still ask for the moment of the update in so many words. The
    // server obeys the stamp as it comes, which for a typed time gives the same clock
    // as the row above.
    {
      name: 'the operator types a new time and asks for a new reference moment: the server is asked to fill it',
      whatTheOperatorDoes: () => {
        typeIntoField(referenceTimeLabel, '20:00');
        chooseOptionInDropdown(referenceMomentKindSelectorName, 'Momento da entrada no ar');
      },
      expectedData: { referenceTimeMs: 1_200_000 },
      expectedTakeTimeFieldKeys: ['referenceWallClockMs'],
    },
    // Stopping the clock sends the switch alone. The server stops it at the time the
    // screen was showing, not at the 12:34 that is on air as the reference.
    {
      name: 'the operator stops the clock: only the switch is sent',
      whatTheOperatorDoes: () => flipSwitch('Relógio correndo'),
      expectedData: { running: false },
      expectedTakeTimeFieldKeys: [],
    },
    // The per-field clear João asked for at gate 2 of BAJAOVRLAY-12: "limpar" on the
    // laps sends null, which the server reads as "take this field off air".
    {
      name: 'the operator clears the laps with "limpar": the laps go as null',
      whatTheOperatorDoes: () => pressButton(`Limpar ${lapsLabel}`),
      expectedData: { lapsCompletedByLeader: null },
      expectedTakeTimeFieldKeys: [],
    },
  ];

  it.each(scenariosWhereAtualizarIsPressedAfterAReload)(
    '"Atualizar" with the first heat on air: $name',
    async ({ whatTheOperatorDoes, expectedData, expectedTakeTimeFieldKeys }) => {
      // Arrange: the page reloaded with the first heat on air since 9:45, and the
      // operator does only what the scenario says.
      const { fakeServer } = renderPanelAfterAReloadWithTheFirstHeatOnAir();
      whatTheOperatorDoes();

      // Act: press "Atualizar".
      fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }));

      // Assert: one updateInstanceData naming the instance that is on air, so the server
      // changes it in place instead of replacing it. It holds what the operator touched
      // and nothing else.
      await waitFor(() => {
        expect(
          fakeServer.listCommandsReceived(),
          '"Atualizar" must send only what the operator touched, for the instance on air',
        ).toEqual([
          {
            type: 'updateInstanceData',
            instanceId: idOfTheRaceClockInstanceOnAir,
            data: expectedData,
            takeTimeFieldKeys: expectedTakeTimeFieldKeys,
          },
        ]);
      });
      // (Then the server answers, so no command is left waiting for its 5-second timeout
      // once the test is over.)
      fakeServer.acceptLastCommand();
    },
  );

  it('sends nothing when "Atualizar" is pressed with nothing changed', async () => {
    // Arrange: the page reloaded with the first heat on air, and the operator touches nothing.
    const { fakeServer } = renderPanelAfterAReloadWithTheFirstHeatOnAir();

    // Act: press "Atualizar" and wait until the panel is done with the press.
    await pressButtonAndWaitUntilThePressIsOver('Atualizar');

    // Assert: no command at all. There is nothing to change, and the clock on air keeps
    // counting by itself; sending its own data back could only disturb it.
    expect(
      fakeServer.listCommandsReceived(),
      'a press with nothing changed must not send any command',
    ).toEqual([]);
  });
});
