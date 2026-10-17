/**
 * "Edição rápida" with the race clock (apps/control)
 *
 * What this module is for:
 *   The centre panel where the operator changes what is on air. With an instance loaded
 *   into it (a "Camadas" row's "Editar"), "Atualizar" sends only what the operator
 *   touched, as an `updateInstanceData` for that instance. The graphic changes in place,
 *   so a flag change in the middle of a race never takes the clock off the screen. The
 *   form is generated from the graphic's manifest; these tests use the real race clock
 *   manifest. Since BAJAOVRLAY-37 the panel puts nothing new on air.
 *
 * What these tests prove:
 *   - Pressing Enter in a field sends nothing.
 *   - When the page loads with the clock already on air (a reload in the middle of a
 *     race) and the clock is loaded with "Editar", the form shows what is on air as the
 *     server holds it; the one exception is the time, which shows what the screen shows.
 *   - "Atualizar" after such a reload sends `updateInstanceData` naming the instance on
 *     air and holding only what the operator changed; a field cleared with "limpar" goes
 *     as null; a field switched to "filled by the server" is named in `takeTimeFieldKeys`.
 *   - "Atualizar" with nothing changed sends nothing.
 *
 * What these tests deliberately do not cover:
 *   - The panel with nothing loaded: QuickEditPanelEmptyState.test.tsx; a loaded
 *     preview ("Atualizar prévia"): QuickEditPanelPreview.test.tsx.
 *   - The form after a command the server accepted, and on-air data the form cannot show
 *     or refuses: QuickEditPanelUpdate.test.tsx.
 *   - Someone else changing the graphic on air: QuickEditPanelOtherOperator.test.tsx.
 *   - Field messages, refusals and a dropped connection: QuickEditPanelProblems.test.tsx.
 *   - Another graphic: QuickEditPanelLowerThird.test.tsx; what is loaded into the panel and
 *     when it lets go: QuickEditPanelTarget.test.tsx.
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
  pressButtonAndWaitUntilThePressIsOver,
  pressEditOnTheLayerRow,
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
 * 7 laps for the leader. The operator then presses "Editar" on the clock's row.
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
  const controlPage = renderQuickEditPanelWithTheseInstancesOnAir([raceClockInstanceOnAir]);
  pressEditOnTheLayerRow('Relógio');
  return controlPage;
}

describe('"Edição rápida" after a reload with the race clock on air', () => {
  it('sends nothing when Enter is pressed in a field', () => {
    // Arrange: the first heat on air, loaded into the panel.
    const { fakeServer } = renderPanelAfterAReloadWithTheFirstHeatOnAir();
    const formAroundTheFields = screen.getByLabelText('Título').closest('form');
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
      'Enter in a field must never change what is on air',
    ).toEqual([]);
  });

  it('shows what is on air as the server holds it, and in the time field the time on screen', () => {
    // Arrange: the first heat on air since 9:45, running from 12:34 (see the factory).
    // The page's clock reads 10:00.
    holdThePageClockAt(momentThePageIsReloaded);

    // Act: the page is loaded, as after a reload.
    renderPanelAfterAReloadWithTheFirstHeatOnAir();

    // Assert: the form is not at its defaults; it repeats what is on air. The time is
    // the 27:34 the screen shows at 10:00, not the 12:34 the server holds as the
    // reference, and the reference moment is a typed value: the number that is on air.
    expect(screen.getByLabelText('Título'), 'the session name must be the one on air').toHaveValue(
      'Enduro de Resistência — Bateria 1',
    );
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
