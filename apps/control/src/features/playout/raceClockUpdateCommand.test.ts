/**
 * Race clock update: the command "Atualizar" sends (apps/control)
 *
 * What this module is for:
 *   While the race clock is on air the operator changes the flag, the session name or
 *   the laps and presses "Atualizar". There is no update command yet, so the page sends
 *   a second `takeGraphic`. raceClockUpdateCommand builds that command so that the
 *   clock on air keeps its time: under race conditions a flag change must never reset
 *   the clock.
 *
 * What these tests prove:
 *   - The time the clock shows at the moment of the press is carried into the command:
 *     a running clock continues from where it is (forwards for elapsed time, backwards
 *     for remaining time, never below zero) and a stopped clock stays where it stopped.
 *   - The time typed in the form is not used while the on-air data can be read.
 *   - Session name, flag, clock mode, running and laps come from the form.
 *   - The moment of the press always becomes the clock's new reference moment.
 *   - When the on-air data cannot be read as race clock data, the command falls back to
 *     the time typed in the form, exactly as "Colocar no ar" would send it.
 *
 * What these tests deliberately do not cover:
 *   - Finding the race clock among the instances and pressing the button;
 *     TakeRaceClockPanel.test.tsx does.
 *   - The rules for each form field; raceClockTakeForm.test.ts lists them.
 *   - The graphic's own arithmetic (packages/graphics/race-clock); this file repeats
 *     the same sum on purpose and nothing checks that the two stay in step.
 */
import { describe, expect, it } from 'vitest';

import type { RaceClockTakeFormValues } from './raceClockTakeForm';
import { buildUpdateRaceClockCommand } from './raceClockUpdateCommand';

// The clock went on air at 9:45 in Brasília on the Saturday of the endurance race, and
// the operator presses "Atualizar" at 10:00: 15 minutes (900 000 ms) later.
const momentTheClockWentOnAirInMilliseconds = Date.parse('2026-10-10T12:45:00.000Z');
const momentOfThePressInMilliseconds = Date.parse('2026-10-10T13:00:00.000Z');

/** The three things about the clock on air that decide which time it shows now. */
type ClockOnAir = {
  clockMode: 'elapsed' | 'remaining';
  referenceTimeMs: number;
  running: boolean;
};

/** The race clock data the server holds for the instance on air, under the green flag. */
function buildRaceClockDataOnAir(clockOnAir: ClockOnAir): Record<string, unknown> {
  return {
    sessionName: 'Enduro de Resistência',
    state: 'green',
    clockMode: clockOnAir.clockMode,
    referenceTimeMs: clockOnAir.referenceTimeMs,
    referenceWallClockMs: momentTheClockWentOnAirInMilliseconds,
    running: clockOnAir.running,
  };
}

/**
 * The form of an operator who changes only the flag, to yellow: everything else agrees
 * with what is on air, and the time field still holds the "0:00" the form opens with.
 */
function buildFormChangingOnlyTheFlagToYellow(clockOnAir: ClockOnAir): RaceClockTakeFormValues {
  return {
    sessionName: 'Enduro de Resistência',
    state: 'yellow',
    clockMode: clockOnAir.clockMode,
    running: clockOnAir.running,
    referenceTime: '0:00',
    lapsCompletedByLeader: '',
  };
}

describe('buildUpdateRaceClockCommand', () => {
  const scenariosWhereTheClockKeepsItsTime = [
    // The trap this module exists for: a yellow flag 15 minutes after the take must
    // show 12:34 + 15:00 = 27:34, not go back to the 0:00 left in the form.
    {
      name: 'continues a running elapsed clock from the time it shows now',
      clockOnAir: { clockMode: 'elapsed', referenceTimeMs: 754_000, running: true },
      expectedReferenceTimeMs: 1_654_000,
    },
    // A clock stopped under a red flag has shown 12:34 all along and must still show it.
    {
      name: 'keeps a stopped clock at the time it stopped',
      clockOnAir: { clockMode: 'elapsed', referenceTimeMs: 754_000, running: false },
      expectedReferenceTimeMs: 754_000,
    },
    // A countdown runs the other way: four hours less the 15 minutes is 3 h 45 min.
    {
      name: 'continues a running countdown downwards',
      clockOnAir: { clockMode: 'remaining', referenceTimeMs: 14_400_000, running: true },
      expectedReferenceTimeMs: 13_500_000,
    },
    // A countdown that ran out 5 minutes ago shows 0:00; the data must not go negative
    // (the graphic refuses a reference time below zero).
    {
      name: 'holds a countdown that already ran out at zero',
      clockOnAir: { clockMode: 'remaining', referenceTimeMs: 600_000, running: true },
      expectedReferenceTimeMs: 0,
    },
    // A stopped countdown is not moved either.
    {
      name: 'keeps a stopped countdown at the time it stopped',
      clockOnAir: { clockMode: 'remaining', referenceTimeMs: 600_000, running: false },
      expectedReferenceTimeMs: 600_000,
    },
  ] as const;

  it.each(scenariosWhereTheClockKeepsItsTime)(
    '$name',
    ({ clockOnAir, expectedReferenceTimeMs }) => {
      // Arrange: the clock on air as the scenario says, and a form changing only the flag.
      const raceClockDataOnAir = buildRaceClockDataOnAir(clockOnAir);
      const formValues = buildFormChangingOnlyTheFlagToYellow(clockOnAir);

      // Act: build the command for a press of "Atualizar" 15 minutes after the take.
      const command = buildUpdateRaceClockCommand(
        formValues,
        raceClockDataOnAir,
        momentOfThePressInMilliseconds,
      );

      // Assert: the whole command. The flag is the new one, the time is the one the clock
      // shows at the press (not the form's 0:00), and the press is the new reference moment.
      expect(command, 'the update must carry the new flag and the time the clock shows').toEqual({
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
      });
    },
  );

  it('starts a stopped clock from where it stopped when the form switches it on', () => {
    // Arrange: the clock stopped on air at 12:34, and a form with "running" switched on
    // (the restart after a red flag).
    const clockOnAir: ClockOnAir = {
      clockMode: 'elapsed',
      referenceTimeMs: 754_000,
      running: false,
    };
    const raceClockDataOnAir = buildRaceClockDataOnAir(clockOnAir);
    const formValues = { ...buildFormChangingOnlyTheFlagToYellow(clockOnAir), running: true };

    // Act: build the command.
    const command = buildUpdateRaceClockCommand(
      formValues,
      raceClockDataOnAir,
      momentOfThePressInMilliseconds,
    );

    // Assert: the clock runs again from 12:34, counted from the moment of the press. The
    // 15 minutes it stood still are not added.
    expect(command.data.running, 'the form decides whether the clock runs').toBe(true);
    expect(
      command.data.referenceTimeMs,
      'a restarted clock must go on from the time it stopped at',
    ).toBe(754_000);
    expect(
      command.data.referenceWallClockMs,
      'the restarted clock must count from the moment of the press',
    ).toBe(momentOfThePressInMilliseconds);
  });

  it('takes the session name, the clock mode and the laps from the form', () => {
    // Arrange: a running elapsed clock on air with no laps, and a form with a new session
    // name, the leader's laps filled in and the other clock mode.
    const clockOnAir: ClockOnAir = {
      clockMode: 'elapsed',
      referenceTimeMs: 754_000,
      running: true,
    };
    const raceClockDataOnAir = buildRaceClockDataOnAir(clockOnAir);
    const formValues: RaceClockTakeFormValues = {
      ...buildFormChangingOnlyTheFlagToYellow(clockOnAir),
      sessionName: 'Enduro de Resistência — Bateria 2',
      clockMode: 'remaining',
      lapsCompletedByLeader: '7',
    };

    // Act: build the command.
    const command = buildUpdateRaceClockCommand(
      formValues,
      raceClockDataOnAir,
      momentOfThePressInMilliseconds,
    );

    // Assert: those three fields are the form's. The time is still the 27:34 the clock
    // shows: changing the mode keeps the number on screen and only turns its direction.
    expect(command.data.sessionName, 'the session name must be the one in the form').toBe(
      'Enduro de Resistência — Bateria 2',
    );
    expect(command.data.clockMode, 'the clock mode must be the one in the form').toBe('remaining');
    expect(command.data.lapsCompletedByLeader, 'the laps must be the ones in the form').toBe(7);
    expect(
      command.data.referenceTimeMs,
      'the number on screen must not jump when the mode changes',
    ).toBe(1_654_000);
  });

  const scenariosWhereTheOnAirDataCannotBeRead = [
    // Data of a graphic that is not a race clock, or of an older version of it: the
    // fields that say which time the clock shows are missing.
    {
      name: 'falls back to the typed time when the on-air data has no clock fields',
      dataOnAir: { sessionName: 'Enduro de Resistência', state: 'green' },
    },
    // A field of the wrong kind (text where a number belongs) is not trusted either.
    {
      name: 'falls back to the typed time when the on-air reference time is not a number',
      dataOnAir: {
        clockMode: 'elapsed',
        referenceTimeMs: '12:34',
        referenceWallClockMs: momentTheClockWentOnAirInMilliseconds,
        running: true,
      },
    },
  ];

  it.each(scenariosWhereTheOnAirDataCannotBeRead)('$name', ({ dataOnAir }) => {
    // Arrange: on-air data that is not readable as race clock data (see the scenario),
    // and a form with 20:00 typed as the reference time.
    const formValues: RaceClockTakeFormValues = {
      sessionName: 'Enduro de Resistência',
      state: 'yellow',
      clockMode: 'elapsed',
      running: true,
      referenceTime: '20:00',
      lapsCompletedByLeader: '',
    };

    // Act: build the command.
    const command = buildUpdateRaceClockCommand(
      formValues,
      dataOnAir,
      momentOfThePressInMilliseconds,
    );

    // Assert: with nothing to carry forward, the typed 20:00 is sent, as a take would.
    expect(
      command.data.referenceTimeMs,
      'with unreadable on-air data the typed time is the only one there is',
    ).toBe(1_200_000);
    expect(
      command.data.referenceWallClockMs,
      'the press is the reference moment in the fallback too',
    ).toBe(momentOfThePressInMilliseconds);
  });
});
