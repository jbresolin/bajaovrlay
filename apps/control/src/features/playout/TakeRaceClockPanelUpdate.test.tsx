/**
 * Take race clock panel: "Atualizar" while the clock is on air (apps/control)
 *
 * What this module is for:
 *   While the race clock is on air the panel offers "Atualizar", which sends the form
 *   again so the flag, the session name or the laps can change in the middle of a race.
 *   The rule it must never break: a flag change does not reset the clock.
 *
 * What these tests prove:
 *   - "Atualizar" sends one `takeGraphic` with the changed flag and the time the clock
 *     on air shows at the press, not the time typed in the form: a running clock
 *     continues, a stopped clock stays where it stopped, a countdown keeps counting down.
 *   - "Colocar no ar" still sends the typed time while the clock is on air: it is the
 *     way to set the clock to a typed time.
 *
 * What these tests deliberately do not cover:
 *   - The rarer "Atualizar" cases (a countdown past zero, restarting a stopped clock,
 *     a changed clock mode, on-air data that cannot be read);
 *     raceClockUpdateCommand.test.ts covers those without drawing anything.
 *   - The rest of the panel (defaults, field messages, server refusals, the buttons
 *     while disconnected); TakeRaceClockPanel.test.tsx does.
 *   - The graphic animating out and in again on every "Atualizar": the server replaces
 *     the instance, and that blink stays until an update command exists (M1).
 *   - Filling the form back in from what is on air: M0 does not do it, so each test sets
 *     the mode and the running switch by hand to agree with the clock on air.
 */
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import {
  buildRaceClockInstanceOnTheClockLayer,
  buildSlicesWithNothingOnAir,
} from '@/state/slicesLikeTheServerSends.testSupport';

import { TakeRaceClockPanel } from './TakeRaceClockPanel';

// 10:00 in Brasília on the Saturday of the endurance race. The panel is told this is
// "now", so the tests know exactly which reference moment the command must carry.
const momentOfThePressInMilliseconds = Date.parse('2026-10-10T13:00:00.000Z');

/** The three things about the clock on air that decide which time it shows now. */
type ClockOnAir = {
  clockMode: 'elapsed' | 'remaining';
  referenceTimeMs: number;
  running: boolean;
};

/**
 * Draws the panel on a connected page whose race clock went on air at 9:45 in Brasília,
 * 15 minutes before the moment the panel is told is "now", in the given mode and state.
 */
function renderPanelWithThisClockOnAir(clockOnAir: ClockOnAir) {
  const momentTheClockWentOnAir = '2026-10-10T12:45:00.000Z';
  const raceClockInstance = buildRaceClockInstanceOnTheClockLayer(momentTheClockWentOnAir);
  const raceClockInstanceAsTheScenarioSays = {
    ...raceClockInstance,
    resolvedData: { ...raceClockInstance.resolvedData, ...clockOnAir },
  };
  return renderOnControlPageConnectedToFakeServer(
    <TakeRaceClockPanel readCurrentTimeInMilliseconds={() => momentOfThePressInMilliseconds} />,
    { ...buildSlicesWithNothingOnAir(), instances: [raceClockInstanceAsTheScenarioSays] },
  );
}

/** Leaves the "Relógio correndo" switch on or off, pressing it only if it must change. */
function setRunningSwitch(shouldBeOn: boolean) {
  const runningSwitch = screen.getByRole('switch', { name: 'Relógio correndo' });
  const isOnNow = runningSwitch.getAttribute('aria-checked') === 'true';
  if (isOnNow !== shouldBeOn) {
    fireEvent.click(runningSwitch);
  }
}

/** Types into a text field found by its label, replacing what was there. */
function typeIntoField(fieldLabel: string, text: string) {
  fireEvent.change(screen.getByLabelText(fieldLabel), { target: { value: text } });
}

/** Opens a dropdown found by its label and picks one of its options. */
function chooseOptionInDropdown(dropdownLabel: string, optionLabel: string) {
  fireEvent.keyDown(screen.getByRole('combobox', { name: dropdownLabel }), { key: 'Enter' });
  fireEvent.click(screen.getByRole('option', { name: optionLabel }));
}

describe('the take race clock panel while the clock is on air', () => {
  const scenariosWhereAtualizarChangesTheFlagMidRace = [
    // The trap: 15 minutes after a take at 12:34 the clock shows 27:34. A yellow flag
    // must go on air with that time, not with the 0:00 still sitting in the form.
    {
      name: 'a running clock continues from the time it shows',
      clockOnAir: { clockMode: 'elapsed', referenceTimeMs: 754_000, running: true },
      clockModeLabelInTheForm: 'Tempo decorrido',
      expectedReferenceTimeMs: 1_654_000,
    },
    // A clock stopped at 12:34 (a red flag) has not moved, and must not move now.
    {
      name: 'a stopped clock stays at the time it stopped',
      clockOnAir: { clockMode: 'elapsed', referenceTimeMs: 754_000, running: false },
      clockModeLabelInTheForm: 'Tempo decorrido',
      expectedReferenceTimeMs: 754_000,
    },
    // A four-hour countdown runs backwards: 15 minutes later it shows 3 h 45 min.
    {
      name: 'a running countdown continues downwards',
      clockOnAir: { clockMode: 'remaining', referenceTimeMs: 14_400_000, running: true },
      clockModeLabelInTheForm: 'Tempo restante',
      expectedReferenceTimeMs: 13_500_000,
    },
  ] as const;

  it.each(scenariosWhereAtualizarChangesTheFlagMidRace)(
    '"Atualizar" changes the flag without resetting the clock: $name',
    async ({ clockOnAir, clockModeLabelInTheForm, expectedReferenceTimeMs }) => {
      // Arrange: the clock on air since 9:45 as the scenario says. The form agrees with
      // it on the mode and on running; the operator changes only the flag, to yellow,
      // and never touches the time field, which still reads 0:00.
      const { fakeServer } = renderPanelWithThisClockOnAir(clockOnAir);
      chooseOptionInDropdown('Modo do relógio', clockModeLabelInTheForm);
      setRunningSwitch(clockOnAir.running);
      chooseOptionInDropdown('Bandeira', 'Amarela');

      // Act: press "Atualizar" at 10:00, 15 minutes after the clock went on air.
      fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }));

      // Assert: one takeGraphic for the same layer (the server replaces the instance on
      // it; there is no separate "update" command yet) with the yellow flag, the time
      // the clock shows at the press, and the press as the new reference moment.
      await waitFor(() => {
        expect(
          fakeServer.listCommandsReceived(),
          '"Atualizar" must send the new flag and keep the time the clock shows on air',
        ).toEqual([
          {
            type: 'takeGraphic',
            graphicId: 'race-clock',
            layerId: 'clock',
            data: {
              sessionName: 'Enduro de Resistência',
              state: 'yellow',
              clockMode: clockOnAir.clockMode,
              referenceTimeMs: expectedReferenceTimeMs,
              referenceWallClockMs: momentOfThePressInMilliseconds,
              running: clockOnAir.running,
            },
          },
        ]);
      });
      // (Then the server answers, so no command is left waiting for its 5-second timeout
      // once the test is over.)
      fakeServer.acceptLastCommand();
    },
  );

  it('"Colocar no ar" still sends the typed time while the clock is on air', async () => {
    // Arrange: a running clock on air showing 27:34, and 20:00 typed in the form because
    // the operator wants to correct the clock.
    const { fakeServer } = renderPanelWithThisClockOnAir({
      clockMode: 'elapsed',
      referenceTimeMs: 754_000,
      running: true,
    });
    setRunningSwitch(true);
    typeIntoField('Tempo de referência (mm:ss)', '20:00');

    // Act: press "Colocar no ar", not "Atualizar".
    fireEvent.click(screen.getByRole('button', { name: 'Colocar no ar' }));

    // Assert: the take carries the typed 20:00; only "Atualizar" keeps the on-air time.
    await waitFor(() => {
      expect(
        fakeServer.listCommandsReceived(),
        '"Colocar no ar" must set the clock to the typed time',
      ).toEqual([
        {
          type: 'takeGraphic',
          graphicId: 'race-clock',
          layerId: 'clock',
          data: {
            sessionName: 'Enduro de Resistência',
            state: 'pre',
            clockMode: 'elapsed',
            referenceTimeMs: 1_200_000,
            referenceWallClockMs: momentOfThePressInMilliseconds,
            running: true,
          },
        },
      ]);
    });
    // (Then the server answers, so no command is left waiting for its 5-second timeout
    // once the test is over.)
    fakeServer.acceptLastCommand();
  });
});
