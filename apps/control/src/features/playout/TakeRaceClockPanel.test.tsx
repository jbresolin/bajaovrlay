/**
 * Take race clock panel (apps/control)
 *
 * What this module is for:
 *   The panel where the operator fills the race clock's data and puts it on air with
 *   "Colocar no ar". While the clock is on air a second button, "Atualizar", changes
 *   what the operator touched and leaves everything else as it is on air, so a flag
 *   change in the middle of a race never resets the clock or stops it.
 *
 * What these tests prove:
 *   - With nothing on air the form opens with the manifest's defaults and there is no
 *     "Atualizar".
 *   - "Colocar no ar" sends one `takeGraphic` command built from what was typed and
 *     chosen, with the moment of the press as the clock's reference.
 *   - When the page loads with the clock already on air (a reload in the middle of a
 *     race), the form shows what is on air, with the time the clock shows at that moment.
 *   - "Atualizar" after such a reload: a field the operator changed goes out as changed,
 *     a typed time becomes the clock's new time, and every field left alone goes out as
 *     it is on air, the time carried forward to the press.
 *
 * What these tests deliberately do not cover:
 *   - The form after a take or an "Atualizar" the server accepted, a change another
 *     operator made, and on-air data that cannot be read:
 *     TakeRaceClockPanelUpdate.test.tsx.
 *   - Field messages, server refusals and the buttons while disconnected:
 *     TakeRaceClockPanelProblems.test.tsx.
 *   - Every combination of changed fields: raceClockUpdateCommand.test.ts, without
 *     drawing anything. Every rule and mm:ss case: raceClockTakeForm.test.ts and
 *     minutesAndSeconds.test.ts.
 *   - The real server and the real graphic; e2e/takeAndClear.e2e.ts uses the real server.
 *   - The graphic animating out and in again on every "Atualizar": the server replaces
 *     the instance, and that blink stays until an update command exists (M1).
 */
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import { buildSlicesWithNothingOnAir } from '@/state/slicesLikeTheServerSends.testSupport';

import {
  buildRaceClockInstanceHoldingThisData,
  chooseOptionInDropdown,
  typeIntoField,
} from './operatingTheRaceClockForm.testSupport';
import { TakeRaceClockPanel } from './TakeRaceClockPanel';

// The clock went on air at 9:45 in Brasília on the Saturday of the endurance race. The
// panel is told that "now" is 10:00, 15 minutes (900 000 ms) later, so the tests know
// exactly which time the clock shows and which reference moment a command must carry.
const momentTheClockWentOnAir = '2026-10-10T12:45:00.000Z';
const momentOfThePressInMilliseconds = Date.parse('2026-10-10T13:00:00.000Z');

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
 * 7 laps for the leader. At 10:00 that clock shows 27:34 (1 654 000 ms).
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
  return renderOnControlPageConnectedToFakeServer(
    <TakeRaceClockPanel readCurrentTimeInMilliseconds={() => momentOfThePressInMilliseconds} />,
    { ...buildSlicesWithNothingOnAir(), instances: [raceClockInstanceOnAir] },
  );
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
    // The trap this rule closes: a reload, then a yellow flag. The session name, the
    // running clock and its time must survive; only the flag changes.
    {
      name: 'the operator changes only the flag: session name, running and the time on air are kept',
      flagTheOperatorChooses: 'Amarela',
      timeTheOperatorTypes: undefined,
      expectedData: {
        sessionName: 'Enduro de Resistência — Bateria 1',
        state: 'yellow',
        clockMode: 'elapsed',
        referenceTimeMs: 1_654_000,
        referenceWallClockMs: momentOfThePressInMilliseconds,
        running: true,
        lapsCompletedByLeader: 7,
      },
    },
    // Correcting the clock: the typed 20:00 (1 200 000 ms) goes out instead of the 27:34
    // the clock shows, counted from the press. Nothing else was touched, so nothing else
    // changes.
    {
      name: 'the operator types a new time: that time goes out, counted from the press',
      flagTheOperatorChooses: undefined,
      timeTheOperatorTypes: '20:00',
      expectedData: {
        sessionName: 'Enduro de Resistência — Bateria 1',
        state: 'green',
        clockMode: 'elapsed',
        referenceTimeMs: 1_200_000,
        referenceWallClockMs: momentOfThePressInMilliseconds,
        running: true,
        lapsCompletedByLeader: 7,
      },
    },
    // A press with nothing changed must be harmless: what is on air goes out again, and
    // only the time has moved, from 12:34 at 9:45 to 27:34 at the press.
    {
      name: 'the operator changes nothing: what is on air goes out again, only the time carried forward',
      flagTheOperatorChooses: undefined,
      timeTheOperatorTypes: undefined,
      expectedData: {
        sessionName: 'Enduro de Resistência — Bateria 1',
        state: 'green',
        clockMode: 'elapsed',
        referenceTimeMs: 1_654_000,
        referenceWallClockMs: momentOfThePressInMilliseconds,
        running: true,
        lapsCompletedByLeader: 7,
      },
    },
  ];

  it.each(scenariosWhereAtualizarIsPressedAfterAReload)(
    '"Atualizar" after a reload with the clock on air at 754 000 ms and running: $name',
    async ({ flagTheOperatorChooses, timeTheOperatorTypes, expectedData }) => {
      // Arrange: the page reloaded at 10:00 with the first heat on air since 9:45, and
      // the operator doing only what the scenario says (possibly nothing at all).
      const { fakeServer } = renderPanelAfterAReloadWithTheFirstHeatOnAir();
      if (flagTheOperatorChooses !== undefined) {
        chooseOptionInDropdown('Bandeira', flagTheOperatorChooses);
      }
      if (timeTheOperatorTypes !== undefined) {
        typeIntoField('Tempo de referência (mm:ss)', timeTheOperatorTypes);
      }

      // Act: press "Atualizar".
      fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }));

      // Assert: one takeGraphic for the same layer (the server replaces the instance on
      // it; there is no separate "update" command yet). What the operator touched is in
      // it as touched; everything else is what was on air.
      await waitFor(() => {
        expect(
          fakeServer.listCommandsReceived(),
          '"Atualizar" must change what the operator touched and keep the rest as it is on air',
        ).toEqual([
          { type: 'takeGraphic', graphicId: 'race-clock', layerId: 'clock', data: expectedData },
        ]);
      });
      // (Then the server answers, so no command is left waiting for its 5-second timeout
      // once the test is over.)
      fakeServer.acceptLastCommand();
    },
  );
});
