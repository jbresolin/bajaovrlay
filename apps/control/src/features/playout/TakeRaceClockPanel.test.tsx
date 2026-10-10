/**
 * Take race clock panel (apps/control)
 *
 * What this module is for:
 *   The panel where the operator fills the race clock's data and puts it on air with
 *   "Colocar no ar". While the clock is on air a second button, "Atualizar", sends only
 *   what the operator touched, as an `updateInstanceData` for the instance on air. The
 *   graphic changes in place, so a flag change in the middle of a race never takes the
 *   clock off the screen, resets it or stops it.
 *
 * What these tests prove:
 *   - With nothing on air the form opens with the manifest's defaults and there is no
 *     "Atualizar".
 *   - "Colocar no ar" sends one `takeGraphic` command built from what was typed and
 *     chosen, with the moment of the press as the clock's reference.
 *   - When the page loads with the clock already on air (a reload in the middle of a
 *     race), the form shows what is on air, with the time the clock shows at that moment.
 *   - "Atualizar" five minutes after such a reload sends `updateInstanceData` naming the
 *     instance on air and holding only what the operator changed: the flag alone for a
 *     flag change; a typed time with the press as its moment; and, when the clock is
 *     stopped, the time it shows at the press (not the older one still written in the
 *     form) so that it stops where it is.
 *   - "Atualizar" with nothing changed sends nothing.
 *
 * What these tests deliberately do not cover:
 *   - The form after a take or an "Atualizar" the server accepted, and on-air data
 *     that cannot be read or that the form refuses: TakeRaceClockPanelUpdate.test.tsx.
 *   - Someone else changing the clock or taking it off air while this operator is
 *     editing or waiting: TakeRaceClockPanelOtherOperator.test.tsx.
 *   - Field messages, server refusals and the buttons while disconnected:
 *     TakeRaceClockPanelProblems.test.tsx.
 *   - Every combination of changed fields: raceClockInstanceUpdate.test.ts, without
 *     drawing anything. Every rule and mm:ss case: raceClockTakeForm.test.ts and
 *     minutesAndSeconds.test.ts.
 *   - The real server laying the fields over what is on air, and the graphic staying on
 *     screen while it changes; e2e/takeAndClear.e2e.ts walks that in a real browser.
 */
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import { buildSlicesWithNothingOnAir } from '@/state/slicesLikeTheServerSends.testSupport';

import {
  buildRaceClockInstanceHoldingThisData,
  chooseOptionInDropdown,
  idOfTheRaceClockInstanceOnAir,
  pressButtonAndWaitUntilThePressIsOver,
  typeIntoField,
} from './operatingTheRaceClockForm.testSupport';
import { TakeRaceClockPanel } from './TakeRaceClockPanel';

// The clock went on air at 9:45 in Brasília on the Saturday of the endurance race. The
// panel is told that "now" is 10:00, 15 minutes (900 000 ms) later, so the tests know
// exactly which time the clock shows and which reference moment a command must carry.
// In the "Atualizar" scenarios the press comes at 10:05, five minutes after the page
// loaded, so the time written in the form (27:34) and the time on air (32:34) differ.
const momentTheClockWentOnAir = '2026-10-10T12:45:00.000Z';
const momentOfThePressInMilliseconds = Date.parse('2026-10-10T13:00:00.000Z');
const momentOfTheLaterPressInMilliseconds = Date.parse('2026-10-10T13:05:00.000Z');

/** Draws the panel on a connected page with nothing on air, with "now" held still. */
function renderPanelWithNothingOnAir() {
  return renderOnControlPageConnectedToFakeServer(
    <TakeRaceClockPanel readCurrentTimeInMilliseconds={() => momentOfThePressInMilliseconds} />,
    buildSlicesWithNothingOnAir(),
  );
}

/**
 * Draws the panel the way a reload in the middle of the race finds it: the first heat
 * has been on air since 9:45 under the green flag, running from 754 000 ms (12:34), with
 * 7 laps for the leader. At 10:00, when the page loads, that clock shows 27:34
 * (1 654 000 ms). The test owns the page's clock: `letFiveMinutesPassOnThePage` moves
 * "now" to 10:05, when the clock on air shows 32:34 (1 954 000 ms).
 */
function renderPanelAfterAReloadWithTheFirstHeatOnAir() {
  const clockOfThisPage = { nowInMilliseconds: momentOfThePressInMilliseconds };
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
  const controlPage = renderOnControlPageConnectedToFakeServer(
    <TakeRaceClockPanel readCurrentTimeInMilliseconds={() => clockOfThisPage.nowInMilliseconds} />,
    { ...buildSlicesWithNothingOnAir(), instances: [raceClockInstanceOnAir] },
  );
  return {
    fakeServer: controlPage.fakeServer,
    letFiveMinutesPassOnThePage: () => {
      clockOfThisPage.nowInMilliseconds = momentOfTheLaterPressInMilliseconds;
    },
  };
}

describe('the take race clock panel', () => {
  it('opens with the default values and only the "Colocar no ar" button', () => {
    // Arrange: nothing on air.

    // Act: draw the panel.
    renderPanelWithNothingOnAir();

    // Assert: each field shows its default, and there is nothing to update yet.
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
      screen.getByLabelText('Tempo de referência (mm:ss)'),
      'the reference time must start at zero',
    ).toHaveValue('0:00');
    expect(
      screen.getByLabelText('Voltas do líder (opcional)'),
      'the laps must start blank',
    ).toHaveValue('');
    expect(
      screen.getByRole('button', { name: 'Colocar no ar' }),
      'the take button must be there',
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Atualizar' }),
      'there is nothing to update while the clock is off air',
    ).toBeNull();
  });

  it('sends takeGraphic with what was typed and chosen when "Colocar no ar" is pressed', async () => {
    // Arrange: the panel filled for the endurance race, 12 min 34 s in, under green.
    const { fakeServer } = renderPanelWithNothingOnAir();
    typeIntoField('Nome da sessão', 'Enduro de Resistência — Bateria 1');
    chooseOptionInDropdown('Bandeira', 'Verde');
    chooseOptionInDropdown('Modo do relógio', 'Tempo restante');
    fireEvent.click(screen.getByRole('switch', { name: 'Relógio correndo' }));
    typeIntoField('Tempo de referência (mm:ss)', '12:34');
    typeIntoField('Voltas do líder (opcional)', '7');

    // Act: press "Colocar no ar".
    fireEvent.click(screen.getByRole('button', { name: 'Colocar no ar' }));

    // Assert: one takeGraphic reached the server, carrying exactly the form's data.
    await waitFor(() => {
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
            referenceWallClockMs: momentOfThePressInMilliseconds,
            running: true,
            lapsCompletedByLeader: 7,
          },
        },
      ]);
    });
    // (Then the server answers, so no command is left waiting for its 5-second timeout
    // once the test is over.)
    fakeServer.acceptLastCommand();
  });

  it('shows what is on air, with the time the clock shows now, when the page loads with the clock on air', () => {
    // Arrange: the first heat on air since 9:45, running from 12:34 (see the factory).

    // Act: the page is loaded at 10:00, as after a reload.
    renderPanelAfterAReloadWithTheFirstHeatOnAir();

    // Assert: the form is not at its defaults. It repeats what is on air, and its time
    // is the 27:34 the clock shows at 10:00, not the 12:34 of the take.
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
      screen.getByLabelText('Tempo de referência (mm:ss)'),
      'the time must be the one the clock shows now',
    ).toHaveValue('27:34');
    expect(
      screen.getByLabelText('Voltas do líder (opcional)'),
      'the laps must be the ones on air',
    ).toHaveValue('7');
    expect(
      screen.getByRole('button', { name: 'Atualizar' }),
      'with the clock on air the panel must offer "Atualizar"',
    ).toBeInTheDocument();
  });

  const scenariosWhereAtualizarIsPressedAfterAReload = [
    // The trap this rule closes: a reload, then a yellow flag. Only the flag is sent, so
    // the session name, the laps and the running clock are not touched: the clock on air
    // goes on counting from its own reference.
    {
      name: 'the operator changes only the flag: only the flag is sent',
      flagTheOperatorChooses: 'Amarela',
      timeTheOperatorTypes: undefined,
      operatorStopsTheClock: false,
      expectedData: { state: 'yellow' },
    },
    // Correcting the clock: the typed 20:00 (1 200 000 ms) goes out, true at the press.
    // The two time fields always travel together.
    {
      name: 'the operator types a new time: that time goes out with the press as its moment',
      flagTheOperatorChooses: undefined,
      timeTheOperatorTypes: '20:00',
      operatorStopsTheClock: false,
      expectedData: {
        referenceTimeMs: 1_200_000,
        referenceWallClockMs: momentOfTheLaterPressInMilliseconds,
      },
    },
    // Stopping the clock: it must stop at the 32:34 (1 954 000 ms) it shows at the press.
    // Not at the 27:34 still written in the form, and not at the 12:34 of the take: that
    // difference is what shows the untouched time was worked out from what is on air.
    {
      name: 'the operator stops the clock: the time it shows at the press goes with it',
      flagTheOperatorChooses: undefined,
      timeTheOperatorTypes: undefined,
      operatorStopsTheClock: true,
      expectedData: {
        running: false,
        referenceTimeMs: 1_954_000,
        referenceWallClockMs: momentOfTheLaterPressInMilliseconds,
      },
    },
  ];

  it.each(scenariosWhereAtualizarIsPressedAfterAReload)(
    '"Atualizar" after a reload with the clock on air at 754 000 ms and running: $name',
    async ({
      flagTheOperatorChooses,
      timeTheOperatorTypes,
      operatorStopsTheClock,
      expectedData,
    }) => {
      // Arrange: the page reloaded at 10:00 with the first heat on air since 9:45. Five
      // minutes later the operator does only what the scenario says.
      const { fakeServer, letFiveMinutesPassOnThePage } =
        renderPanelAfterAReloadWithTheFirstHeatOnAir();
      letFiveMinutesPassOnThePage();
      if (flagTheOperatorChooses !== undefined) {
        chooseOptionInDropdown('Bandeira', flagTheOperatorChooses);
      }
      if (timeTheOperatorTypes !== undefined) {
        typeIntoField('Tempo de referência (mm:ss)', timeTheOperatorTypes);
      }
      if (operatorStopsTheClock) {
        fireEvent.click(screen.getByRole('switch', { name: 'Relógio correndo' }));
      }

      // Act: press "Atualizar" at 10:05.
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
          },
        ]);
      });
      // (Then the server answers, so no command is left waiting for its 5-second timeout
      // once the test is over.)
      fakeServer.acceptLastCommand();
    },
  );

  it('sends nothing when "Atualizar" is pressed after a reload with nothing changed', async () => {
    // Arrange: the page reloaded at 10:00 with the first heat on air since 9:45, and five
    // minutes pass without the operator touching the form.
    const { fakeServer, letFiveMinutesPassOnThePage } =
      renderPanelAfterAReloadWithTheFirstHeatOnAir();
    letFiveMinutesPassOnThePage();

    // Act: press "Atualizar" at 10:05 and wait until the panel is done with the press.
    await pressButtonAndWaitUntilThePressIsOver('Atualizar');

    // Assert: no command at all. There is nothing to change, and the clock on air keeps
    // counting by itself; sending its own data back could only disturb it.
    expect(
      fakeServer.listCommandsReceived(),
      'a press with nothing changed must not send any command',
    ).toEqual([]);
  });
});
