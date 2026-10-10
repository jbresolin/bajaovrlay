/**
 * Race clock update: what "Atualizar" sends (apps/control)
 *
 * What this module is for:
 *   While the race clock is on air the operator changes a field or two and presses
 *   "Atualizar". The page then sends `updateInstanceData` for the instance on air,
 *   carrying only the fields the operator changed. The server lays them over the data it
 *   holds and the graphic changes in place, without leaving the screen. Under race
 *   conditions nothing the operator did not touch may change, least of all the clock.
 *
 * What these tests prove:
 *   - Field by field: a changed field is in the command as the form has it, and a field
 *     left alone is not in the command at all, whatever the form happens to show for it.
 *   - The clock's two time fields travel together or not at all. They are sent when the
 *     operator changed the time, the clock mode or "running": a typed time as typed, an
 *     untouched time as the clock on air shows it at the press, and the press as the
 *     moment that time is true. Otherwise neither is sent and the clock on air is left
 *     counting from its own reference.
 *   - With nothing changed there is nothing to send.
 *   - Erased laps cannot be sent (a partial update cannot remove a field), and the answer
 *     says so instead of sending something else. That holds only while laps are on air:
 *     with none on air an emptied laps field asks for nothing and the rest is sent.
 *   - When the on-air data cannot be read, the whole form is sent.
 *
 * What these tests deliberately do not cover:
 *   - How the page knows which fields the operator changed (react-hook-form's
 *     `dirtyFields`) and pressing the button; the TakeRaceClockPanel tests do.
 *   - Which time each kind of clock shows on air; raceClockDataOnAir.test.ts lists them.
 *   - The server merging the fields and checking the result against the manifest;
 *     apps/server's reducer tests do.
 */
import { describe, expect, it } from 'vitest';

import { buildRaceClockInstanceUpdate } from './raceClockInstanceUpdate';
import type { RaceClockData, RaceClockTakeFormValues } from './raceClockTakeForm';

// The clock went on air at 9:45 in Brasília on the Saturday of the endurance race, and
// the operator presses "Atualizar" at 10:00: 15 minutes (900 000 ms) later.
const momentTheClockWentOnAirInMilliseconds = Date.parse('2026-10-10T12:45:00.000Z');
const momentOfThePressInMilliseconds = Date.parse('2026-10-10T13:00:00.000Z');

// The id the server gave the race clock instance that is on air.
const idOfTheInstanceOnAir = 'c41f7e9a-63d2-4b1c-8a0f-5e2d9b7a3c66';

/**
 * What the server holds for the clock on air: the first heat under the green flag, taken
 * at 9:45 running from 12:34 (754 000 ms), with 7 laps for the leader. At 10:00 that
 * clock shows 27:34 (1 654 000 ms).
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
 * A form in which every field disagrees with what is on air, so each test can tell that
 * a field left alone really stayed out of the command: second heat, yellow flag, counting
 * down, stopped, 20:00 (1 200 000 ms), 9 laps.
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

describe('buildRaceClockInstanceUpdate', () => {
  const scenariosByWhatTheOperatorChanged = [
    // The case the command exists for: a yellow flag in the middle of the race changes
    // the flag and nothing else. No time field is sent, so the clock is not touched.
    {
      name: 'sends only the flag when only the flag was changed',
      fieldsTheOperatorChanged: { state: true },
      expectedData: { state: 'yellow' },
    },
    // A corrected session name must not disturb the clock either.
    {
      name: 'sends only the session name when only it was changed',
      fieldsTheOperatorChanged: { sessionName: true },
      expectedData: { sessionName: 'Enduro de Resistência — Bateria 2' },
    },
    // The leader finished two more laps.
    {
      name: 'sends only the laps when only the laps were changed',
      fieldsTheOperatorChanged: { lapsCompletedByLeader: true },
      expectedData: { lapsCompletedByLeader: 9 },
    },
    // The operator types 20:00 to correct the clock: that time goes out, true at the press.
    {
      name: 'sends the typed time with the press as its moment when the time was changed',
      fieldsTheOperatorChanged: { referenceTime: true },
      expectedData: {
        referenceTimeMs: 1_200_000,
        referenceWallClockMs: momentOfThePressInMilliseconds,
      },
    },
    // Stopping the clock (a red flag). Sent alone, `running: false` would make the graphic
    // show the old reference, 12:34. So the 27:34 it shows at the press goes with it.
    {
      name: 'sends the time the clock shows at the press when only "running" was changed',
      fieldsTheOperatorChanged: { running: true },
      expectedData: {
        running: false,
        referenceTimeMs: 1_654_000,
        referenceWallClockMs: momentOfThePressInMilliseconds,
      },
    },
    // A changed mode keeps the number on screen and turns only its direction: 27:34
    // elapsed becomes 27:34 remaining. That needs the same two time fields.
    {
      name: 'sends the time the clock shows at the press when only the clock mode was changed',
      fieldsTheOperatorChanged: { clockMode: true },
      expectedData: {
        clockMode: 'remaining',
        referenceTimeMs: 1_654_000,
        referenceWallClockMs: momentOfThePressInMilliseconds,
      },
    },
    // A typed time wins over the time on air even when "running" changed as well.
    {
      name: 'sends the typed time, not the time on air, when the time and "running" were changed',
      fieldsTheOperatorChanged: { referenceTime: true, running: true },
      expectedData: {
        running: false,
        referenceTimeMs: 1_200_000,
        referenceWallClockMs: momentOfThePressInMilliseconds,
      },
    },
    // react-hook-form may mark a field `false` after it was changed and changed back.
    // That is "not changed", the same as a field it does not mention.
    {
      name: 'leaves out a field marked false, as it does a field not mentioned',
      fieldsTheOperatorChanged: { state: true, referenceTime: false, running: false },
      expectedData: { state: 'yellow' },
    },
    // Every field touched: the whole form goes out.
    {
      name: 'sends every field when every field was changed',
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

      // Act: work out what a press of "Atualizar" at 10:00 sends.
      const update = buildRaceClockInstanceUpdate({
        instanceId: idOfTheInstanceOnAir,
        formValues,
        fieldsTheOperatorChanged,
        raceClockDataOnAir,
        nowInMilliseconds: momentOfThePressInMilliseconds,
      });

      // Assert: one updateInstanceData for the instance on air, holding exactly the
      // fields of the scenario. A field that is not listed must not be there at all.
      expect(
        update,
        'the command must name the instance on air and carry the changed fields only',
      ).toEqual({
        outcome: 'sendCommand',
        command: {
          type: 'updateInstanceData',
          instanceId: idOfTheInstanceOnAir,
          data: expectedData,
        },
      });
    },
  );

  it('starts a stopped clock from where it stopped when the operator switches it on', () => {
    // Arrange: the clock stopped on air at 12:34 (a red flag), and a form in which the
    // operator switched "running" on for the restart and touched nothing else.
    const raceClockDataOnAir = { ...buildRaceClockDataOnAir(), running: false };
    const formValues = { ...buildFormDisagreeingWithEveryFieldOnAir(), running: true };

    // Act: work out what the press sends.
    const update = buildRaceClockInstanceUpdate({
      instanceId: idOfTheInstanceOnAir,
      formValues,
      fieldsTheOperatorChanged: { running: true },
      raceClockDataOnAir,
      nowInMilliseconds: momentOfThePressInMilliseconds,
    });

    // Assert: the clock runs again from 12:34, counted from the moment of the press. The
    // 15 minutes it stood still are not added.
    expect(update, 'a restarted clock must go on from the time it stopped at').toEqual({
      outcome: 'sendCommand',
      command: {
        type: 'updateInstanceData',
        instanceId: idOfTheInstanceOnAir,
        data: {
          running: true,
          referenceTimeMs: 754_000,
          referenceWallClockMs: momentOfThePressInMilliseconds,
        },
      },
    });
  });

  it('answers that nothing changed when the operator touched no field', () => {
    // Arrange: the first heat on air, and a form the operator did not touch.
    const raceClockDataOnAir = buildRaceClockDataOnAir();
    const formValues = buildFormDisagreeingWithEveryFieldOnAir();

    // Act: work out what the press sends.
    const update = buildRaceClockInstanceUpdate({
      instanceId: idOfTheInstanceOnAir,
      formValues,
      fieldsTheOperatorChanged: {},
      raceClockDataOnAir,
      nowInMilliseconds: momentOfThePressInMilliseconds,
    });

    // Assert: there is no command, so the clock on air is not touched in any way.
    expect(update, 'a press with nothing changed must not build a command').toEqual({
      outcome: 'nothingChanged',
    });
  });

  it('answers that the laps cannot be removed when the operator erased them in the form', () => {
    // Arrange: 7 laps on air, and a form whose laps field the operator emptied. The flag
    // was changed too, to prove that nothing is sent in part.
    const raceClockDataOnAir = buildRaceClockDataOnAir();
    const formValues = { ...buildFormDisagreeingWithEveryFieldOnAir(), lapsCompletedByLeader: '' };

    // Act: work out what the press sends.
    const update = buildRaceClockInstanceUpdate({
      instanceId: idOfTheInstanceOnAir,
      formValues,
      fieldsTheOperatorChanged: { lapsCompletedByLeader: true, state: true },
      raceClockDataOnAir,
      nowInMilliseconds: momentOfThePressInMilliseconds,
    });

    // Assert: no command. The server lays the sent fields over what it holds, so a field
    // that is left out stays on air; the page says so instead of sending half the change.
    expect(update, 'erased laps must be reported, not silently left on air').toEqual({
      outcome: 'lapsCannotBeRemoved',
    });
  });

  it('sends the other changes when the laps field was emptied but no laps are on air', () => {
    // Arrange: a clock on air that shows no laps (another operator took it that way), and
    // a form whose laps field is empty yet still counts as changed, because this operator
    // had erased laps that were on air before. The flag was changed too.
    const raceClockDataOnAirWithoutLaps: Partial<RaceClockData> = buildRaceClockDataOnAir();
    delete raceClockDataOnAirWithoutLaps.lapsCompletedByLeader;
    const formValues = { ...buildFormDisagreeingWithEveryFieldOnAir(), lapsCompletedByLeader: '' };

    // Act: work out what the press sends.
    const update = buildRaceClockInstanceUpdate({
      instanceId: idOfTheInstanceOnAir,
      formValues,
      fieldsTheOperatorChanged: { lapsCompletedByLeader: true, state: true },
      raceClockDataOnAir: raceClockDataOnAirWithoutLaps,
      nowInMilliseconds: momentOfThePressInMilliseconds,
    });

    // Assert: the flag goes out alone. There are no laps on air to remove, so the empty
    // laps field asks for nothing and must not hold the flag back.
    expect(update, 'with no laps on air an empty laps field must not block the update').toEqual({
      outcome: 'sendCommand',
      command: {
        type: 'updateInstanceData',
        instanceId: idOfTheInstanceOnAir,
        data: { state: 'yellow' },
      },
    });
  });

  const scenariosWhereTheOnAirDataCannotBeRead = [
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

    // Act: work out what the press sends.
    const update = buildRaceClockInstanceUpdate({
      instanceId: idOfTheInstanceOnAir,
      formValues,
      fieldsTheOperatorChanged: { state: true },
      raceClockDataOnAir,
      nowInMilliseconds: momentOfThePressInMilliseconds,
    });

    // Assert: the form was never filled from this data, so "changed" means nothing here
    // and the time on air cannot be worked out. Every field of the form goes out, with
    // the typed 20:00 (1 200 000 ms) true at the press.
    expect(update, 'with no readable on-air data the update must carry the whole form').toEqual({
      outcome: 'sendCommand',
      command: {
        type: 'updateInstanceData',
        instanceId: idOfTheInstanceOnAir,
        data: {
          sessionName: 'Enduro de Resistência — Bateria 2',
          state: 'yellow',
          clockMode: 'remaining',
          referenceTimeMs: 1_200_000,
          referenceWallClockMs: momentOfThePressInMilliseconds,
          running: false,
          lapsCompletedByLeader: 9,
        },
      },
    });
  });
});
