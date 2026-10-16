/**
 * updateInstanceData carrying the race clock forward (apps/server)
 *
 * What this module is for:
 *   While the race clock is on air the operator changes a field or two and presses
 *   "Atualizar"; the control page sends only the fields that changed. The clock's time
 *   on screen depends on three fields together (a reference time, the moment it was
 *   true, and whether and which way the clock runs), so `running: false` laid over the
 *   data alone would make a clock showing 27:34 jump back to the 12:34 it went on air
 *   with. The race clock's manifest names the server rule `carryClockForward`, and the
 *   reducer runs it on every update: it writes the time on screen at the moment of the
 *   update, so the clock stops, starts or turns exactly where it is. The control page
 *   knows nothing about clocks; the server is the one place this is decided.
 *
 * What these tests prove (the scenarios the control page's own clock code used to
 * cover before BAJAOVRLAY-14 removed it, now at the server):
 *   - Stopping a running clock, starting a held one, typing a new time while it runs
 *     and turning its direction all leave the right time on air, true at the update.
 *   - Choosing "Momento da entrada no ar" for the reference moment with no typed time
 *     is obeyed as asked: the server's stamp stays and the rule adds nothing.
 *   - Re-sending the values already on air changes nothing and hands back the very
 *     same slices, as it did before the rule existed.
 *   - The item editor's "Atualizar no ar", which sends changed values and never asks
 *     for a stamp, gets the same treatment as the quick edit panel.
 *   - A flag change alone does not touch the clock's two time fields.
 *   - A clock turned around half a second after a whole second keeps the number it showed.
 *   - What the rule wrote is still checked by the graphic's schema, and an instance
 *     whose data on air cannot be read as a clock is refused by that schema.
 *
 * What these tests deliberately do not cover:
 *   - Every branch of the rule; updateRules/carryClockForward.test.ts covers them.
 *   - A manifest whose rule cannot be run; updateInstanceDataUnusableUpdateRule.test.ts.
 *   - Saving and logging; ../storeCarriesTheClockForward.test.ts covers the store.
 */
import type { Command, Instance } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import {
  buildRaceClockInstanceWithStatus,
  buildRaceDaySlicesWithInstances,
  raceClockInstanceId,
} from './raceDaySlices.testSupport.js';
import { reduceCommand } from './reduceCommand.js';
import type { ReducerContext } from './reducerTypes.js';

// The clock went on air at 9:45 in Brasília on the Saturday of the endurance race, and
// the operator presses "Atualizar" at 10:00: 15 minutes (900 000 ms) later.
const momentTheClockWentOnAir = '2026-10-10T12:45:00.000Z';
const momentTheClockWentOnAirMs = Date.parse(momentTheClockWentOnAir);
const momentOfThePress = '2026-10-10T13:00:00.000Z';
const momentOfThePressMs = Date.parse(momentOfThePress);

/** The ids and time the store would hand the reducer for a command sent at 10:00. */
const contextOfThePress: ReducerContext = {
  newInstanceId: '0b6c8f2e-3d1a-4c55-8e2f-9a7b6c5d4e3f',
  now: momentOfThePress,
  newItemId: '5e8a2c1d-9f3b-4a7e-b6d4-2c1f0e9a8b7c',
  newQuickFirePanelId: 'd4b2e8f1-6a3c-4d7e-9b05-1c8f2a6e3d90',
  newMacroId: '8f3a1c6e-2d4b-4e9a-b7c5-0a1d3e5f7b92',
};

/**
 * Builds what the server holds for the clock on air: the first heat under the green
 * flag, taken at 9:45 running from 12:34 (754 000 ms), with 7 laps for the leader. At
 * 10:00 that clock shows 27:34 (1 654 000 ms).
 */
function buildFirstHeatRunningData(): Record<string, unknown> {
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
function buildFirstHeatHeldData(): Record<string, unknown> {
  return { ...buildFirstHeatRunningData(), state: 'red', running: false };
}

/** Builds the race clock instance on air since 9:45 holding the given data. */
function buildRaceClockOnAirHolding(resolvedData: Record<string, unknown>): Instance {
  return {
    ...buildRaceClockInstanceWithStatus('on-air'),
    resolvedData,
    takenAt: momentTheClockWentOnAir,
  };
}

/** Builds an update of the race clock on air with the given data and fields to stamp. */
function buildUpdateOfTheRaceClock(
  data: Record<string, unknown>,
  takeTimeFieldKeys: string[],
): Command {
  return { type: 'updateInstanceData', instanceId: raceClockInstanceId, data, takeTimeFieldKeys };
}

const scenariosByWhatTheOperatorChanged: Array<{
  name: string;
  dataOnAirBefore: Record<string, unknown>;
  command: Command;
  expectedDataOnAirAfter: Record<string, unknown>;
}> = [
  // Stopping the clock (a red flag). Laid over alone, `running: false` would make the
  // graphic show the old reference, 12:34. The 27:34 it shows at the press stays.
  {
    name: 'stops a running clock at the time it shows at the press',
    dataOnAirBefore: buildFirstHeatRunningData(),
    command: buildUpdateOfTheRaceClock({ running: false }, []),
    expectedDataOnAirAfter: {
      ...buildFirstHeatRunningData(),
      running: false,
      referenceTimeMs: 1_654_000,
      referenceWallClockMs: momentOfThePressMs,
    },
  },
  // The restart after the red flag: the clock runs again from the 12:34 it was held
  // at, counted from the press. The 15 minutes it stood still are not added.
  {
    name: 'starts a held clock from the time it was held at, counting from the press',
    dataOnAirBefore: buildFirstHeatHeldData(),
    command: buildUpdateOfTheRaceClock({ running: true }, []),
    expectedDataOnAirAfter: {
      ...buildFirstHeatHeldData(),
      running: true,
      referenceTimeMs: 754_000,
      referenceWallClockMs: momentOfThePressMs,
    },
  },
  // The operator types 20:00 to correct a running clock: 20:00 is true at the press.
  // Left with the 9:45 reference moment, the screen would show 35:00.
  {
    name: 'puts a typed time on a running clock as true at the press',
    dataOnAirBefore: buildFirstHeatRunningData(),
    command: buildUpdateOfTheRaceClock({ referenceTimeMs: 1_200_000 }, []),
    expectedDataOnAirAfter: {
      ...buildFirstHeatRunningData(),
      referenceTimeMs: 1_200_000,
      referenceWallClockMs: momentOfThePressMs,
    },
  },
  // A changed mode keeps the number on screen and turns only its direction: 27:34
  // elapsed becomes 27:34 remaining, counting down from the press.
  {
    name: 'turns a running clock around at the time it shows at the press',
    dataOnAirBefore: buildFirstHeatRunningData(),
    command: buildUpdateOfTheRaceClock({ clockMode: 'remaining' }, []),
    expectedDataOnAirAfter: {
      ...buildFirstHeatRunningData(),
      clockMode: 'remaining',
      referenceTimeMs: 1_654_000,
      referenceWallClockMs: momentOfThePressMs,
    },
  },
  // The operator set the reference moment to "Momento da entrada no ar" and typed no
  // time: an explicit request to count the 12:34 on air from now. The server stamps the
  // moment and the rule adds nothing, so the screen goes back to 12:34 as asked.
  {
    name: 'obeys a reference moment left to the server when no time was typed',
    dataOnAirBefore: buildFirstHeatRunningData(),
    command: buildUpdateOfTheRaceClock({}, ['referenceWallClockMs']),
    expectedDataOnAirAfter: {
      ...buildFirstHeatRunningData(),
      referenceTimeMs: 754_000,
      referenceWallClockMs: momentOfThePressMs,
    },
  },
  // "Atualizar" pressed on a form whose values are the ones on air. With nothing
  // changed the rule must add nothing either, or every such press would move the
  // reference and be saved, logged and broadcast.
  {
    name: 'leaves the data on air as it is when the values on air are sent again',
    dataOnAirBefore: buildFirstHeatRunningData(),
    command: buildUpdateOfTheRaceClock(
      { state: 'green', clockMode: 'elapsed', running: true, referenceTimeMs: 754_000 },
      [],
    ),
    expectedDataOnAirAfter: buildFirstHeatRunningData(),
  },
  // The item editor's "Atualizar no ar": it sends the changed fields as values and
  // never asks for a stamp. A red flag there (new name, red, stopped) must hold the
  // clock at 27:34 just as the quick edit panel's does.
  {
    name: 'stops the clock where it is when the item editor updates the item on air',
    dataOnAirBefore: buildFirstHeatRunningData(),
    command: buildUpdateOfTheRaceClock(
      {
        sessionName: 'Enduro de Resistência — Bateria 1 (interrompida)',
        state: 'red',
        running: false,
      },
      [],
    ),
    expectedDataOnAirAfter: {
      ...buildFirstHeatRunningData(),
      sessionName: 'Enduro de Resistência — Bateria 1 (interrompida)',
      state: 'red',
      running: false,
      referenceTimeMs: 1_654_000,
      referenceWallClockMs: momentOfThePressMs,
    },
  },
  // The case that must stay as cheap as it always was: a yellow flag in the middle of
  // the race changes the flag and nothing else; the clock counts on from 9:45.
  {
    name: 'changes only the flag when only the flag is sent',
    dataOnAirBefore: buildFirstHeatRunningData(),
    command: buildUpdateOfTheRaceClock({ state: 'yellow' }, []),
    expectedDataOnAirAfter: { ...buildFirstHeatRunningData(), state: 'yellow' },
  },
];

describe('updateInstanceData of the race clock, by what the operator changed', () => {
  it.each(scenariosByWhatTheOperatorChanged)(
    '$name',
    ({ dataOnAirBefore, command, expectedDataOnAirAfter }) => {
      // Arrange: the race clock on air since 9:45 with the scenario's data, and a deep
      // copy of the slices for comparison.
      const slicesBefore = buildRaceDaySlicesWithInstances([
        buildRaceClockOnAirHolding(dataOnAirBefore),
      ]);
      const copyOfSlicesBefore = structuredClone(slicesBefore);

      // Act: reduce the update sent at 10:00.
      const outcome = reduceCommand(slicesBefore, command, contextOfThePress);

      // Assert: applied; the same instance (same id, still taken at 9:45) holds the
      // expected data; and the slices handed in were not edited.
      expect(outcome.status, 'the update must be applied').toBe('applied');
      expect(
        outcome.status === 'applied' ? outcome.slices.instances : undefined,
        'the clock on air must show the right time from the press on, without a jump',
      ).toEqual([buildRaceClockOnAirHolding(expectedDataOnAirAfter)]);
      expect(slicesBefore, 'a reducer must never edit the slices it was given').toEqual(
        copyOfSlicesBefore,
      );
    },
  );

  it('hands back the very same slices when the values on air are sent again', () => {
    // Arrange: the first heat running on air since 9:45.
    const slicesBefore = buildRaceDaySlicesWithInstances([
      buildRaceClockOnAirHolding(buildFirstHeatRunningData()),
    ]);

    // Act: at 10:00, send the clock fields exactly as they are on air.
    const outcome = reduceCommand(
      slicesBefore,
      buildUpdateOfTheRaceClock(
        { state: 'green', clockMode: 'elapsed', running: true, referenceTimeMs: 754_000 },
        [],
      ),
      contextOfThePress,
    );

    // Assert: the same object comes back, which is how the store knows there is
    // nothing to save, log or broadcast. The rule did not move the reference moment.
    expect(
      outcome.status === 'applied' ? outcome.slices : undefined,
      'the slices must be the very same object, not a copy',
    ).toBe(slicesBefore);
  });
});

const scenariosOfATurnBetweenTwoWholeSeconds: Array<{
  name: string;
  clockModeOnAir: string;
  clockModeSent: string;
  expectedReferenceTimeMs: number;
}> = [
  // Counting up from 30:00 since 9:45, the clock is at 45:00.5 and reads 45:00. A
  // countdown from 45:00.5 would read 45:01, so the whole 45:00 is written.
  {
    name: 'keeps 45:00 on screen when a clock counting up becomes a countdown',
    clockModeOnAir: 'elapsed',
    clockModeSent: 'remaining',
    expectedReferenceTimeMs: 2_700_000,
  },
  // Counting down from 30:00 since 9:45, 14:59.5 is left and reads 15:00. Counting up
  // from 14:59.5 would read 14:59, so the whole 15:00 is written.
  {
    name: 'keeps 15:00 on screen when a countdown becomes a clock counting up',
    clockModeOnAir: 'remaining',
    clockModeSent: 'elapsed',
    expectedReferenceTimeMs: 900_000,
  },
];

describe('updateInstanceData of the race clock, turned around between two whole seconds', () => {
  it.each(scenariosOfATurnBetweenTwoWholeSeconds)(
    '$name',
    ({ clockModeOnAir, clockModeSent, expectedReferenceTimeMs }) => {
      // Arrange: the first heat on air since 9:45, running from 30:00 in the direction
      // of the scenario; the press comes half a second after 10:00.
      const dataOnAirBefore = {
        ...buildFirstHeatRunningData(),
        clockMode: clockModeOnAir,
        referenceTimeMs: 1_800_000,
      };
      const slicesBefore = buildRaceDaySlicesWithInstances([
        buildRaceClockOnAirHolding(dataOnAirBefore),
      ]);
      const momentOfTheLatePress = '2026-10-10T13:00:00.500Z';

      // Act: reduce an update that only turns the clock around.
      const outcome = reduceCommand(
        slicesBefore,
        buildUpdateOfTheRaceClock({ clockMode: clockModeSent }, []),
        { ...contextOfThePress, now: momentOfTheLatePress },
      );

      // Assert: the whole second that was on screen is the new reference time, true at
      // the press, so the number on screen is the same in the new direction.
      const expectedDataOnAirAfter = {
        ...dataOnAirBefore,
        clockMode: clockModeSent,
        referenceTimeMs: expectedReferenceTimeMs,
        referenceWallClockMs: Date.parse(momentOfTheLatePress),
      };
      expect(
        outcome.status === 'applied' ? outcome.slices.instances : undefined,
        'a clock turned around must show the same number just after the press',
      ).toEqual([buildRaceClockOnAirHolding(expectedDataOnAirAfter)]);
    },
  );
});

const scenariosWhereTheSchemaStillRefuses: Array<{
  name: string;
  dataOnAirBefore: Record<string, unknown>;
  command: Command;
  expectedMessage: string;
}> = [
  // The rule writes a typed time as typed; a negative one is still the schema's to refuse.
  {
    name: 'refuses a negative typed time, which the rule passes on and the schema refuses',
    dataOnAirBefore: buildFirstHeatRunningData(),
    command: buildUpdateOfTheRaceClock({ referenceTimeMs: -5_000 }, []),
    expectedMessage:
      'Dados inválidos para o gráfico "race-clock": o campo "referenceTimeMs" tem um valor que o gráfico não aceita.',
  },
  // Data that went on air without a reference time (an older manifest): the time on
  // screen cannot be worked out, the rule adds nothing, and the schema names the gap.
  {
    name: 'refuses stopping a clock whose data on air has no reference time',
    dataOnAirBefore: {
      sessionName: 'Enduro de Resistência — Bateria 1',
      state: 'green',
      clockMode: 'elapsed',
      referenceWallClockMs: momentTheClockWentOnAirMs,
      running: true,
    },
    command: buildUpdateOfTheRaceClock({ running: false }, []),
    expectedMessage:
      'Dados inválidos para o gráfico "race-clock": o campo "referenceTimeMs" é obrigatório e não foi enviado.',
  },
  // Clearing a required clock field while stopping the clock: the rule does not write
  // a time over the cleared field, so the schema still finds it missing.
  {
    name: 'refuses clearing the reference time while stopping the clock',
    dataOnAirBefore: buildFirstHeatRunningData(),
    command: buildUpdateOfTheRaceClock({ running: false, referenceTimeMs: null }, []),
    expectedMessage:
      'Dados inválidos para o gráfico "race-clock": o campo "referenceTimeMs" é obrigatório e não foi enviado.',
  },
];

describe('updateInstanceData of the race clock, when the schema refuses the result', () => {
  it.each(scenariosWhereTheSchemaStillRefuses)(
    '$name',
    ({ dataOnAirBefore, command, expectedMessage }) => {
      // Arrange: the race clock on air with the scenario's data, and a copy for comparison.
      const slicesBefore = buildRaceDaySlicesWithInstances([
        buildRaceClockOnAirHolding(dataOnAirBefore),
      ]);
      const copyOfSlicesBefore = structuredClone(slicesBefore);

      // Act: reduce the update sent at 10:00.
      const outcome = reduceCommand(slicesBefore, command, contextOfThePress);

      // Assert: refused by the graphic's own schema, in pt-BR, and nothing changed.
      expect(outcome, 'the update must be refused with the field named in pt-BR').toEqual({
        status: 'refused',
        error: { code: 'INVALID_GRAPHIC_DATA', message: expectedMessage },
      });
      expect(slicesBefore, 'a refused update must leave the slices as they were').toEqual(
        copyOfSlicesBefore,
      );
    },
  );
});
