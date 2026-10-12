/**
 * The carryClockForward update rule (apps/server)
 *
 * What this module is for:
 *   The race clock graphic works out the time on screen from three fields together: a
 *   reference time, the moment that time was true, and whether (and in which direction)
 *   the clock runs. An operator who stops the clock sends only `running: false`. Laid
 *   over the data on air as it is, that would make the clock show the old reference
 *   time: a clock stopped at 27:34 would jump back to the 12:34 it went on air with.
 *   This rule runs on the server for every update of the race clock and, when the
 *   update touches the clock itself, also writes the time the screen shows at that
 *   moment and the moment itself, so the clock goes on from where it is.
 *
 * What these tests prove (calling the rule directly; it reads no clock of its own):
 *   - Stopping, starting or turning the clock writes the time on screen now and the
 *     moment of the update. A typed time is written as typed, with the same moment.
 *   - A countdown that ran out is written as zero, never as a negative time.
 *   - A reference moment that was sent with a new value, or stamped by the server, is
 *     the sender's own choice: the fields go through exactly as they came.
 *   - Fields that are the same as on air are not counted as sent, so re-sending what
 *     is on air changes nothing; a flag change alone does not touch the clock fields.
 *   - When a clock field was cleared, or the data on air cannot be read as a clock, the
 *     rule adds nothing and leaves the judgement to the graphic's schema.
 *   - The rule never changes the objects it is given.
 *
 * What these tests deliberately do not cover:
 *   - A press between two whole seconds (every moment here is a whole second), where a
 *     turned clock is rounded; carryClockForwardBetweenWholeSeconds.test.ts covers it.
 *   - The sum itself; packages/shared's clockExtrapolation.test.ts covers it.
 *   - The reducer running the rule in the right place, and the schema check that
 *     follows; reducers/updateInstanceDataCarriesTheClock.test.ts covers both.
 *   - Which graphics run this rule; updateRuleOfGraphic.test.ts covers that.
 */
import { describe, expect, it } from 'vitest';

import { carryClockForward } from './carryClockForward.js';

// The clock went on air at 9:45 in Brasília on the Saturday of the endurance race, and
// the operator presses "Atualizar" at 10:00: 15 minutes (900 000 ms) later.
const momentTheClockWentOnAirMs = Date.parse('2026-10-10T12:45:00.000Z');
const momentOfTheUpdateMs = Date.parse('2026-10-10T13:00:00.000Z');

/**
 * Builds what is on air: the first heat under the green flag, running from 12:34
 * (754 000 ms) since 9:45, with 7 laps for the leader. At 10:00 it shows 27:34
 * (1 654 000 ms).
 */
function buildFirstHeatRunningOnAir(): Record<string, unknown> {
  return {
    sessionName: 'Enduro de Resistência — Bateria 1',
    state: 'green',
    clockMode: 'elapsed',
    referenceTimeMs: 754_000,
    referenceWallClockMs: momentTheClockWentOnAirMs,
    running: true,
    lapsCompletedByLeader: 7,
  };
}

/** Builds the same heat held at 12:34 under a red flag since 9:45. */
function buildFirstHeatHeldOnAir(): Record<string, unknown> {
  return { ...buildFirstHeatRunningOnAir(), state: 'red', running: false };
}

/** Builds a 30:00 countdown started at 9:45: at 10:00 it has 15:00 (900 000 ms) left. */
function buildThirtyMinuteCountdownOnAir(): Record<string, unknown> {
  return { ...buildFirstHeatRunningOnAir(), clockMode: 'remaining', referenceTimeMs: 1_800_000 };
}

/** Builds a 10:00 countdown started at 9:45: at 10:00 it ran out five minutes ago. */
function buildTenMinuteCountdownOnAir(): Record<string, unknown> {
  return { ...buildFirstHeatRunningOnAir(), clockMode: 'remaining', referenceTimeMs: 600_000 };
}

const scenariosWhereTheClockIsCarriedForward: Array<{
  name: string;
  dataOnAir: Record<string, unknown>;
  fieldsSent: Record<string, unknown>;
  expectedFieldsToWrite: Record<string, unknown>;
}> = [
  // A red flag: the clock stops. Alone, `running: false` would show 12:34 again; the
  // 27:34 on screen at the press goes with it.
  {
    name: 'writes the time on screen and the moment of the update when the clock is stopped',
    dataOnAir: buildFirstHeatRunningOnAir(),
    fieldsSent: { running: false },
    expectedFieldsToWrite: {
      running: false,
      referenceTimeMs: 1_654_000,
      referenceWallClockMs: momentOfTheUpdateMs,
    },
  },
  // The restart: a held clock goes on from the 12:34 it stopped at, counted from the
  // press. The 15 minutes it stood still are not added.
  {
    name: 'starts a held clock from where it stopped, counting from the moment of the update',
    dataOnAir: buildFirstHeatHeldOnAir(),
    fieldsSent: { running: true },
    expectedFieldsToWrite: {
      running: true,
      referenceTimeMs: 754_000,
      referenceWallClockMs: momentOfTheUpdateMs,
    },
  },
  // The operator corrects the clock to 20:00 while it runs: 20:00 is true at the press,
  // not at 9:45 (which would show 35:00).
  {
    name: 'writes a typed time as typed, true at the moment of the update',
    dataOnAir: buildFirstHeatRunningOnAir(),
    fieldsSent: { referenceTimeMs: 1_200_000 },
    expectedFieldsToWrite: {
      referenceTimeMs: 1_200_000,
      referenceWallClockMs: momentOfTheUpdateMs,
    },
  },
  // A changed mode keeps the number on screen and turns only its direction: 27:34
  // elapsed becomes 27:34 remaining.
  {
    name: 'keeps the number on screen when only the direction of the clock is changed',
    dataOnAir: buildFirstHeatRunningOnAir(),
    fieldsSent: { clockMode: 'remaining' },
    expectedFieldsToWrite: {
      clockMode: 'remaining',
      referenceTimeMs: 1_654_000,
      referenceWallClockMs: momentOfTheUpdateMs,
    },
  },
  // A typed time wins over the time on screen even when the clock is stopped as well.
  {
    name: 'writes the typed time, not the time on screen, when the clock is also stopped',
    dataOnAir: buildFirstHeatRunningOnAir(),
    fieldsSent: { referenceTimeMs: 1_200_000, running: false, state: 'red' },
    expectedFieldsToWrite: {
      referenceTimeMs: 1_200_000,
      running: false,
      state: 'red',
      referenceWallClockMs: momentOfTheUpdateMs,
    },
  },
  // A countdown counts down: 30:00 at 9:45 is 15:00 at 10:00, and that is what stays.
  {
    name: 'writes the time left on a countdown when it is stopped',
    dataOnAir: buildThirtyMinuteCountdownOnAir(),
    fieldsSent: { running: false },
    expectedFieldsToWrite: {
      running: false,
      referenceTimeMs: 900_000,
      referenceWallClockMs: momentOfTheUpdateMs,
    },
  },
  // A countdown that ran out shows 0:00 on screen; the sum gives minus five minutes,
  // and the graphic's schema refuses a negative time. So zero is written.
  {
    name: 'writes zero, not a negative time, for a countdown that already ran out',
    dataOnAir: buildTenMinuteCountdownOnAir(),
    fieldsSent: { running: false },
    expectedFieldsToWrite: {
      running: false,
      referenceTimeMs: 0,
      referenceWallClockMs: momentOfTheUpdateMs,
    },
  },
  // The reference moment sent is the one already on air, so it does not count as sent:
  // the clock is still carried, and the moment becomes the moment of the update.
  {
    name: 'carries the clock when the reference moment sent is the one already on air',
    dataOnAir: buildFirstHeatRunningOnAir(),
    fieldsSent: { running: false, referenceWallClockMs: momentTheClockWentOnAirMs },
    expectedFieldsToWrite: {
      running: false,
      referenceTimeMs: 1_654_000,
      referenceWallClockMs: momentOfTheUpdateMs,
    },
  },
];

describe('carryClockForward, when the update changes the clock itself', () => {
  it.each(scenariosWhereTheClockIsCarriedForward)(
    '$name',
    ({ dataOnAir, fieldsSent, expectedFieldsToWrite }) => {
      // Arrange: what is on air and what the update sends (see the scenario), with
      // copies of both for comparison. No field is stamped and none is cleared.
      const copyOfDataOnAir = structuredClone(dataOnAir);
      const copyOfFieldsSent = structuredClone(fieldsSent);

      // Act: run the rule for an update that arrives at 10:00.
      const result = carryClockForward(dataOnAir, fieldsSent, [], [], momentOfTheUpdateMs);

      // Assert: the fields sent, plus the two time fields that keep the clock where it
      // is; and neither object handed in was edited.
      expect(
        result.fieldsToWrite,
        'the fields to write must keep the clock on air from jumping',
      ).toEqual(expectedFieldsToWrite);
      expect(dataOnAir, 'the rule must not change the data on air').toEqual(copyOfDataOnAir);
      expect(fieldsSent, 'the rule must not change the fields sent').toEqual(copyOfFieldsSent);
    },
  );
});

const scenariosWhereTheFieldsGoThroughUntouched: Array<{
  name: string;
  dataOnAir: Record<string, unknown>;
  fieldsSent: Record<string, unknown>;
  keysStamped: string[];
  keysCleared: string[];
}> = [
  // The case the rule must never disturb: a yellow flag changes the flag and nothing
  // else, and the clock on air goes on counting from its own reference.
  {
    name: 'adds nothing when only the flag is changed',
    dataOnAir: buildFirstHeatRunningOnAir(),
    fieldsSent: { state: 'yellow' },
    keysStamped: [],
    keysCleared: [],
  },
  // An "Atualizar" on an untouched form: every value is the one on air, so nothing was
  // really sent and the update must stay a no-op for the reducer to recognise.
  {
    name: 'adds nothing when every field sent is the one already on air',
    dataOnAir: buildFirstHeatRunningOnAir(),
    fieldsSent: { state: 'green', running: true, clockMode: 'elapsed', referenceTimeMs: 754_000 },
    keysStamped: [],
    keysCleared: [],
  },
  // The operator chose "Momento da entrada no ar" for the reference moment: the server
  // already stamped it. That is an explicit request to count from now, so it is obeyed.
  {
    name: 'adds nothing when the reference moment was stamped by the server',
    dataOnAir: buildFirstHeatRunningOnAir(),
    fieldsSent: { running: false, referenceWallClockMs: momentOfTheUpdateMs },
    keysStamped: ['referenceWallClockMs'],
    keysCleared: [],
  },
  // A sender that gives its own new reference moment (10 minutes before the press)
  // knows which reading it wants; the rule does not second-guess it.
  {
    name: 'adds nothing when a new reference moment was sent as a value',
    dataOnAir: buildFirstHeatRunningOnAir(),
    fieldsSent: { referenceTimeMs: 0, referenceWallClockMs: momentOfTheUpdateMs - 600_000 },
    keysStamped: [],
    keysCleared: [],
  },
  // Clearing a clock field is something the graphic's schema refuses (all four are
  // required). Writing a value over the cleared field would hide that mistake.
  {
    name: 'adds nothing when a clock field was cleared in the same update',
    dataOnAir: buildFirstHeatRunningOnAir(),
    fieldsSent: { running: false },
    keysStamped: [],
    keysCleared: ['referenceTimeMs'],
  },
  // Data put on air by an older version, with no reference time: the time on screen
  // cannot be worked out, and a guess on air is worse than a refusal by the schema.
  {
    name: 'adds nothing when the data on air has no reference time',
    dataOnAir: {
      sessionName: 'Enduro de Resistência — Bateria 1',
      state: 'green',
      clockMode: 'elapsed',
      referenceWallClockMs: momentTheClockWentOnAirMs,
      running: true,
    },
    fieldsSent: { running: false },
    keysStamped: [],
    keysCleared: [],
  },
  // A field of the wrong kind on air (text where a number belongs) is not trusted either.
  {
    name: 'adds nothing when the reference time on air is a text',
    dataOnAir: { ...buildFirstHeatRunningOnAir(), referenceTimeMs: '12:34' },
    fieldsSent: { clockMode: 'remaining' },
    keysStamped: [],
    keysCleared: [],
  },
];

describe('carryClockForward, when the fields must go through as they came', () => {
  it.each(scenariosWhereTheFieldsGoThroughUntouched)(
    '$name',
    ({ dataOnAir, fieldsSent, keysStamped, keysCleared }) => {
      // Arrange: what is on air, what the update sends, and which fields the server
      // stamped or the sender cleared (see the scenario).
      const copyOfFieldsSent = structuredClone(fieldsSent);

      // Act: run the rule for an update that arrives at 10:00.
      const result = carryClockForward(
        dataOnAir,
        fieldsSent,
        keysStamped,
        keysCleared,
        momentOfTheUpdateMs,
      );

      // Assert: exactly the fields that came in, with nothing added and nothing changed.
      expect(result.fieldsToWrite, 'the rule must add no field in this case').toEqual(
        copyOfFieldsSent,
      );
    },
  );
});
