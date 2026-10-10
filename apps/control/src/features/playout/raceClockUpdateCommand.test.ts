/**
 * Race clock update: the command "Atualizar" sends (apps/control)
 *
 * What this module is for:
 *   While the race clock is on air the operator changes a field or two and presses
 *   "Atualizar". There is no update command yet, so the page sends a second
 *   `takeGraphic`. raceClockUpdateCommand builds that command from two sources: a field
 *   the operator changed comes from the form, and a field the operator left alone comes
 *   from what is on air. Under race conditions nothing the operator did not touch may
 *   change, least of all the clock's time.
 *
 * What these tests prove:
 *   - Field by field: a changed field goes out as the form has it, and every other field
 *     goes out as it is on air, whatever the form happens to show for it.
 *   - An untouched time is the time the clock on air shows at the press; a typed time
 *     replaces it. Either way the press becomes the clock's new reference moment.
 *   - The laps follow the same rule, including "erased in the form" (laps removed) and
 *     "not on air and not touched" (still no laps).
 *   - A stopped clock switched on in the form goes on from where it stopped.
 *   - When the on-air data cannot be read, or there is none, the whole command is the one
 *     "Colocar no ar" would send: every field from the form.
 *
 * What these tests deliberately do not cover:
 *   - How the page knows which fields the operator changed (react-hook-form's
 *     `dirtyFields`) and pressing the button; TakeRaceClockPanel.test.tsx does.
 *   - Which time each kind of clock shows on air; raceClockDataOnAir.test.ts lists them.
 *   - The rules for each form field; raceClockTakeForm.test.ts lists them.
 */
import { describe, expect, it } from 'vitest';

import type { RaceClockData, RaceClockTakeFormValues } from './raceClockTakeForm';
import { buildUpdateRaceClockCommand } from './raceClockUpdateCommand';

// The clock went on air at 9:45 in Brasília on the Saturday of the endurance race, and
// the operator presses "Atualizar" at 10:00: 15 minutes (900 000 ms) later.
const momentTheClockWentOnAirInMilliseconds = Date.parse('2026-10-10T12:45:00.000Z');
const momentOfThePressInMilliseconds = Date.parse('2026-10-10T13:00:00.000Z');

/**
 * What the server holds for the clock on air: the first heat under the green flag, taken
 * at 9:45 running from 12:34, with 7 laps for the leader.
 */
function buildRaceClockDataOnAir(): RaceClockData {
  return {
    sessionName: 'Enduro de Resistência — Bateria 1',
    state: 'green',
    clockMode: 'elapsed',
    referenceTimeMs: 754_000,
    referenceWallClockMs: momentTheClockWentOnAirInMilliseconds,
    running: true,
    lapsCompletedByLeader: 7,
  };
}

/**
 * The same data as it must go out when the operator changed nothing: only the time has
 * moved, from 12:34 to the 27:34 the clock shows at the press, counted from the press.
 */
function buildDataOnAirCarriedForwardToThePress(): RaceClockData {
  return {
    sessionName: 'Enduro de Resistência — Bateria 1',
    state: 'green',
    clockMode: 'elapsed',
    referenceTimeMs: 1_654_000,
    referenceWallClockMs: momentOfThePressInMilliseconds,
    running: true,
    lapsCompletedByLeader: 7,
  };
}

/**
 * A form in which every field disagrees with what is on air, so each test can tell where
 * a value in the command came from: second heat, yellow flag, counting down, stopped,
 * 20:00, 9 laps.
 */
function buildFormDisagreeingWithEveryFieldOnAir(): RaceClockTakeFormValues {
  return {
    sessionName: 'Enduro de Resistência — Bateria 2',
    state: 'yellow',
    clockMode: 'remaining',
    running: false,
    referenceTime: '20:00',
    lapsCompletedByLeader: '9',
  };
}

describe('buildUpdateRaceClockCommand', () => {
  const scenariosByWhatTheOperatorChanged = [
    // Nothing touched: what is on air goes out again, and only the time has moved on.
    {
      name: 'sends what is on air, with the time it shows now, when nothing was changed',
      fieldsTheOperatorChanged: {},
      expectedData: buildDataOnAirCarriedForwardToThePress(),
    },
    // The case the rule exists for: a yellow flag in the middle of the race changes the
    // flag and nothing else. The session name, the running clock and its time survive.
    {
      name: 'changes only the flag when only the flag was changed',
      fieldsTheOperatorChanged: { state: true },
      expectedData: { ...buildDataOnAirCarriedForwardToThePress(), state: 'yellow' },
    },
    // A corrected session name must not disturb the clock.
    {
      name: 'changes only the session name when only it was changed',
      fieldsTheOperatorChanged: { sessionName: true },
      expectedData: {
        ...buildDataOnAirCarriedForwardToThePress(),
        sessionName: 'Enduro de Resistência — Bateria 2',
      },
    },
    // The operator types 20:00 to correct the clock: that time goes out, counted from the
    // press, instead of the 27:34 the clock shows.
    {
      name: 'sets the clock to the typed time when the time was changed',
      fieldsTheOperatorChanged: { referenceTime: true },
      expectedData: { ...buildDataOnAirCarriedForwardToThePress(), referenceTimeMs: 1_200_000 },
    },
    // Stopping the clock (a red flag) freezes it at the time it shows at the press.
    {
      name: 'stops the clock at the time it shows when only "running" was changed',
      fieldsTheOperatorChanged: { running: true },
      expectedData: { ...buildDataOnAirCarriedForwardToThePress(), running: false },
    },
    // A changed mode keeps the number on screen and turns only its direction: 27:34
    // elapsed becomes 27:34 remaining. Nothing better can be guessed without knowing how
    // long the session lasts.
    {
      name: 'keeps the number on screen when only the clock mode was changed',
      fieldsTheOperatorChanged: { clockMode: true },
      expectedData: { ...buildDataOnAirCarriedForwardToThePress(), clockMode: 'remaining' },
    },
    // The leader finished two more laps.
    {
      name: 'changes only the laps when only the laps were changed',
      fieldsTheOperatorChanged: { lapsCompletedByLeader: true },
      expectedData: { ...buildDataOnAirCarriedForwardToThePress(), lapsCompletedByLeader: 9 },
    },
    // react-hook-form may mark a field `false` after it was changed and changed back.
    // That is "not changed", the same as a field it does not mention.
    {
      name: 'treats a field marked false as not changed',
      fieldsTheOperatorChanged: { state: false, referenceTime: false },
      expectedData: buildDataOnAirCarriedForwardToThePress(),
    },
    // Every field touched: nothing is left to take from the air.
    {
      name: 'sends the whole form when every field was changed',
      fieldsTheOperatorChanged: {
        sessionName: true,
        state: true,
        clockMode: true,
        running: true,
        referenceTime: true,
        lapsCompletedByLeader: true,
      },
      expectedData: {
        sessionName: 'Enduro de Resistência — Bateria 2',
        state: 'yellow',
        clockMode: 'remaining',
        referenceTimeMs: 1_200_000,
        referenceWallClockMs: momentOfThePressInMilliseconds,
        running: false,
        lapsCompletedByLeader: 9,
      },
    },
  ];

  it.each(scenariosByWhatTheOperatorChanged)(
    '$name',
    ({ fieldsTheOperatorChanged, expectedData }) => {
      // Arrange: the first heat on air since 9:45, and a form that disagrees with it in
      // every field. Which of those fields the operator really changed is the scenario.
      const raceClockDataOnAir = buildRaceClockDataOnAir();
      const formValues = buildFormDisagreeingWithEveryFieldOnAir();

      // Act: build the command for a press of "Atualizar" at 10:00.
      const command = buildUpdateRaceClockCommand({
        formValues,
        fieldsTheOperatorChanged,
        raceClockDataOnAir,
        nowInMilliseconds: momentOfThePressInMilliseconds,
      });

      // Assert: the whole command. Changed fields are the form's, the rest is what is on
      // air, and the press is the clock's new reference moment.
      expect(
        command,
        'changed fields must come from the form and every other field from what is on air',
      ).toEqual({
        type: 'takeGraphic',
        graphicId: 'race-clock',
        layerId: 'clock',
        data: expectedData,
      });
    },
  );

  it('takes the laps off air when the operator erased them in the form', () => {
    // Arrange: 7 laps on air, and a form whose laps field the operator emptied.
    const raceClockDataOnAir = buildRaceClockDataOnAir();
    const formValues = { ...buildFormDisagreeingWithEveryFieldOnAir(), lapsCompletedByLeader: '' };

    // Act: build the command, the laps being the only field changed.
    const command = buildUpdateRaceClockCommand({
      formValues,
      fieldsTheOperatorChanged: { lapsCompletedByLeader: true },
      raceClockDataOnAir,
      nowInMilliseconds: momentOfThePressInMilliseconds,
    });

    // Assert: the command has no laps field at all (the graphic refuses a null), and the
    // rest is still what is on air.
    expect(command.data, 'erased laps must leave the command, and nothing else may change').toEqual(
      {
        sessionName: 'Enduro de Resistência — Bateria 1',
        state: 'green',
        clockMode: 'elapsed',
        referenceTimeMs: 1_654_000,
        referenceWallClockMs: momentOfThePressInMilliseconds,
        running: true,
      },
    );
  });

  it('sends no laps when none are on air and the operator did not touch them', () => {
    // Arrange: a clock on air without laps, and a form that shows 9 laps the operator
    // never typed (a form can be out of date; the air is the truth for untouched fields).
    const raceClockDataOnAir: Record<string, unknown> = { ...buildRaceClockDataOnAir() };
    delete raceClockDataOnAir.lapsCompletedByLeader;
    const formValues = buildFormDisagreeingWithEveryFieldOnAir();

    // Act: build the command with only the flag changed.
    const command = buildUpdateRaceClockCommand({
      formValues,
      fieldsTheOperatorChanged: { state: true },
      raceClockDataOnAir,
      nowInMilliseconds: momentOfThePressInMilliseconds,
    });

    // Assert: the laps are still absent.
    expect(
      command.data.lapsCompletedByLeader,
      'laps that are not on air must not appear because the form shows some',
    ).toBeUndefined();
    expect(command.data.state, 'the changed flag must still go out').toBe('yellow');
  });

  it('starts a stopped clock from where it stopped when the operator switches it on', () => {
    // Arrange: the clock stopped on air at 12:34 (a red flag), and a form in which the
    // operator switched "running" on for the restart and touched nothing else.
    const raceClockDataOnAir = { ...buildRaceClockDataOnAir(), running: false };
    const formValues = { ...buildFormDisagreeingWithEveryFieldOnAir(), running: true };

    // Act: build the command.
    const command = buildUpdateRaceClockCommand({
      formValues,
      fieldsTheOperatorChanged: { running: true },
      raceClockDataOnAir,
      nowInMilliseconds: momentOfThePressInMilliseconds,
    });

    // Assert: the clock runs again from 12:34, counted from the moment of the press. The
    // 15 minutes it stood still are not added.
    expect(command.data.running, 'the clock must run, as the operator asked').toBe(true);
    expect(
      command.data.referenceTimeMs,
      'a restarted clock must go on from the time it stopped at',
    ).toBe(754_000);
    expect(
      command.data.referenceWallClockMs,
      'the restarted clock must count from the moment of the press',
    ).toBe(momentOfThePressInMilliseconds);
  });

  const scenariosWhereTheOnAirDataCannotBeRead = [
    // The panel hands over undefined if it finds no race clock instance. It cannot happen
    // today (the button is only drawn while the clock is on air), but the type allows it.
    {
      name: 'sends the whole form when there is no on-air data at all',
      raceClockDataOnAir: undefined,
    },
    // Data of a graphic that is not a race clock, or of an older version of it: the
    // fields that say which time the clock shows are missing.
    {
      name: 'sends the whole form when the on-air data has no clock fields',
      raceClockDataOnAir: { sessionName: 'Enduro de Resistência — Bateria 1', state: 'green' },
    },
    // A field of the wrong kind (text where a number belongs) is not trusted either.
    {
      name: 'sends the whole form when the on-air reference time is not a number',
      raceClockDataOnAir: { ...buildRaceClockDataOnAir(), referenceTimeMs: '12:34' },
    },
  ];

  it.each(scenariosWhereTheOnAirDataCannotBeRead)('$name', ({ raceClockDataOnAir }) => {
    // Arrange: on-air data that is not readable as race clock data (see the scenario),
    // and a form in which the operator changed only the flag.
    const formValues = buildFormDisagreeingWithEveryFieldOnAir();

    // Act: build the command.
    const command = buildUpdateRaceClockCommand({
      formValues,
      fieldsTheOperatorChanged: { state: true },
      raceClockDataOnAir,
      nowInMilliseconds: momentOfThePressInMilliseconds,
    });

    // Assert: the whole command. With nothing readable on air there is nothing to keep, so
    // it is the command "Colocar no ar" sends: every field from the form, untouched ones
    // included, with the typed 20:00 (1 200 000 ms) counted from the press.
    expect(command, 'with no readable on-air data the update must send the whole form').toEqual({
      type: 'takeGraphic',
      graphicId: 'race-clock',
      layerId: 'clock',
      data: {
        sessionName: 'Enduro de Resistência — Bateria 2',
        state: 'yellow',
        clockMode: 'remaining',
        referenceTimeMs: 1_200_000,
        referenceWallClockMs: momentOfThePressInMilliseconds,
        running: false,
        lapsCompletedByLeader: 9,
      },
    });
  });
});
