/**
 * updateInstanceData with a cleared field or a stamped field (apps/server)
 *
 * What this module is for:
 *   The control page's generated form has a "limpar" control on every optional field
 *   and lets a wall-clock field be left "to the moment of the command". On an update
 *   the page says the first by sending the field as `null`, and the second by naming
 *   the field in `takeTimeFieldKeys`. The reducer takes a null field off the data that
 *   is on air, writes the command's own moment (in wall-clock milliseconds) into each
 *   named field, and only then checks the result against the graphic's manifest schema.
 *
 * What these tests prove:
 *   - A field sent as null leaves the instance's data; the other fields stay.
 *   - Taking off a REQUIRED field is refused with INVALID_GRAPHIC_DATA naming it, and
 *     nothing changes.
 *   - An update holding only nulls for fields that are not on air changes nothing and
 *     hands back the very same slices, so nothing is saved, logged or broadcast.
 *   - A field named in `takeTimeFieldKeys` gets the moment of the command, with or
 *     without other data, and replaces a value sent for the same field. A stamp is a
 *     change even when every other value sent is the one already on air.
 *   - A field both sent as null and named for stamping ends up stamped.
 *   - A stamp is refused, naming the field, unless the graphic's schema declares that
 *     field as a whole number marked `v_baja.role: "wallClock"`: a text field, a field
 *     the graphic does not have and a whole number without the mark are all refused,
 *     and a graphic with no data schema accepts no stamp at all.
 *
 * What these tests deliberately do not cover:
 *   - The plain rules of an update (laying fields over, refusals, purity);
 *     updateInstanceData.test.ts covers them.
 *   - The store saving and logging the result; storeClearedAndStampedFields.test.ts.
 *   - The race clock's update rule, which adds nothing when the reference moment is
 *     stamped (every stamp here) and is covered by
 *     updateInstanceDataCarriesTheClock.test.ts.
 */
import type { Command, Instance } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import {
  buildGreenFlagEnduroData,
  buildRaceClockInstanceWithStatus,
  buildRaceDaySlicesWithInstances,
  buildTeam42LowerThirdOnAir,
  contextOfTheCommand,
  raceClockInstanceId,
} from './raceDaySlices.testSupport.js';
import { reduceCommand } from './reduceCommand.js';

// The moment contextOfTheCommand names, 14:32:05 UTC on 9 October 2026, in milliseconds.
const momentOfTheCommandInMilliseconds = 1_791_556_325_000;

/** Builds the race clock on air under green flag with the leader on lap 12. */
function buildRaceClockOnAirShowingLap12(): Instance {
  return {
    ...buildRaceClockInstanceWithStatus('on-air'),
    resolvedData: { ...buildGreenFlagEnduroData(), lapsCompletedByLeader: 12 },
  };
}

/** Builds an update of the race clock on air with the given data and fields to stamp. */
function buildUpdateOfTheRaceClock(
  data: Record<string, unknown>,
  takeTimeFieldKeys: string[],
): Command {
  return { type: 'updateInstanceData', instanceId: raceClockInstanceId, data, takeTimeFieldKeys };
}

const appliedUpdateScenarios: Array<{
  name: string;
  command: Command;
  expectedDataAfter: Record<string, unknown>;
}> = [
  // The reason null exists: "limpar" on the laps takes the lap count off the screen.
  {
    name: 'takes the leader laps off the data when they are sent as null',
    command: buildUpdateOfTheRaceClock({ lapsCompletedByLeader: null }, []),
    expectedDataAfter: buildGreenFlagEnduroData(),
  },
  // One press can clear one field and change another.
  {
    name: 'takes the laps off and changes the flag in the same update',
    command: buildUpdateOfTheRaceClock({ lapsCompletedByLeader: null, state: 'red' }, []),
    expectedDataAfter: { ...buildGreenFlagEnduroData(), state: 'red' },
  },
  // The clock is restarted from zero: the page sends the time and leaves the moment to
  // the server, which writes 14:32:05 in milliseconds.
  {
    name: 'stamps the reference moment with the moment of the command',
    command: buildUpdateOfTheRaceClock({ referenceTimeMs: 0 }, ['referenceWallClockMs']),
    expectedDataAfter: {
      ...buildGreenFlagEnduroData(),
      lapsCompletedByLeader: 12,
      referenceTimeMs: 0,
      referenceWallClockMs: momentOfTheCommandInMilliseconds,
    },
  },
  // Stamping alone is a whole update: empty data must not be mistaken for "nothing to do".
  {
    name: 'stamps a field even when the update carries no other data',
    command: buildUpdateOfTheRaceClock({}, ['referenceWallClockMs']),
    expectedDataAfter: {
      ...buildGreenFlagEnduroData(),
      lapsCompletedByLeader: 12,
      referenceWallClockMs: momentOfTheCommandInMilliseconds,
    },
  },
  // The flag sent is the one on air, which alone would change nothing; the stamp still
  // writes a new moment, so the update as a whole is a change and must be applied.
  {
    name: 'stamps a field when every other value sent is the one already on air',
    command: buildUpdateOfTheRaceClock({ state: 'green' }, ['referenceWallClockMs']),
    expectedDataAfter: {
      ...buildGreenFlagEnduroData(),
      lapsCompletedByLeader: 12,
      referenceWallClockMs: momentOfTheCommandInMilliseconds,
    },
  },
  // A client that sends its own moment and also asks for the stamp gets the server's.
  {
    name: 'lets the stamp replace a value sent for the same field',
    command: buildUpdateOfTheRaceClock({ referenceWallClockMs: 1_791_550_800_000 }, [
      'referenceWallClockMs',
    ]),
    expectedDataAfter: {
      ...buildGreenFlagEnduroData(),
      lapsCompletedByLeader: 12,
      referenceWallClockMs: momentOfTheCommandInMilliseconds,
    },
  },
  // Null and stamp for one field contradict each other; the stamp wins, so the required
  // reference moment is never taken off by accident.
  {
    name: 'stamps a field that is both sent as null and named for stamping',
    command: buildUpdateOfTheRaceClock({ referenceWallClockMs: null }, ['referenceWallClockMs']),
    expectedDataAfter: {
      ...buildGreenFlagEnduroData(),
      lapsCompletedByLeader: 12,
      referenceWallClockMs: momentOfTheCommandInMilliseconds,
    },
  },
];

describe('updateInstanceData with a cleared or a stamped field, when it can be applied', () => {
  it.each(appliedUpdateScenarios)('$name', ({ command, expectedDataAfter }) => {
    // Arrange: the race clock on air with the leader on lap 12.
    const slicesBefore = buildRaceDaySlicesWithInstances([buildRaceClockOnAirShowingLap12()]);

    // Act: reduce the update at 14:32:05.
    const outcome = reduceCommand(slicesBefore, command, contextOfTheCommand);

    // Assert: applied, and the same instance (same id) now holds the expected data.
    expect(outcome.status, 'the update must be applied').toBe('applied');
    const instancesAfter = outcome.status === 'applied' ? outcome.slices.instances : undefined;
    expect(
      instancesAfter,
      'the instance must keep its id and hold the data after clearing and stamping',
    ).toEqual([{ ...buildRaceClockOnAirShowingLap12(), resolvedData: expectedDataAfter }]);
    expect(
      instancesAfter === slicesBefore.instances,
      'a changed instances slice must be a new array, so the store saves and broadcasts it',
    ).toBe(false);
  });
});

describe('updateInstanceData that only clears fields which are not on air', () => {
  it('changes nothing and hands back the very same slices', () => {
    // Arrange: the race clock on air with no lap count showing.
    const slicesBefore = buildRaceDaySlicesWithInstances([
      buildRaceClockInstanceWithStatus('on-air'),
    ]);

    // Act: "limpar" on the laps field, which was already empty.
    const outcome = reduceCommand(
      slicesBefore,
      buildUpdateOfTheRaceClock({ lapsCompletedByLeader: null }, []),
      contextOfTheCommand,
    );

    // Assert: accepted, and the same objects come back, so the store saves, logs and
    // broadcasts nothing (João's 2026-10-10 ruling on commands that change nothing).
    expect(outcome.status, 'clearing a field that is not on air must be accepted').toBe('applied');
    expect(
      outcome.status === 'applied' ? outcome.slices : undefined,
      'the slices must be the very same object, not a copy',
    ).toBe(slicesBefore);
  });
});

const refusedUpdateScenarios: Array<{
  name: string;
  command: Command;
  expectedMessage: string;
}> = [
  // The session name is required: a race clock without it is one the graphic refuses,
  // so "limpar" cannot be used to remove it from the air.
  {
    name: 'refuses taking a required field off, naming it as missing',
    command: buildUpdateOfTheRaceClock({ sessionName: null }, []),
    expectedMessage:
      'Dados inválidos para o gráfico "race-clock": o campo "Título" é obrigatório e não foi enviado.',
  },
  // From here on: the server stamps only a field the graphic's schema declares as a
  // whole number marked `v_baja.role: "wallClock"`. The flag is one of six texts.
  {
    name: 'refuses a stamp on a field that is not a whole number, naming the field',
    command: buildUpdateOfTheRaceClock({}, ['state']),
    expectedMessage:
      'O gráfico "race-clock" não aceita que o servidor preencha o campo "state" com o momento do comando: o manifesto do gráfico não marca esse campo como um horário (número inteiro com v_baja.role "wallClock").',
  },
  // A stamp on a field the graphic does not have must not be stored next to the real ones.
  {
    name: 'refuses a stamp on a field the race clock does not have, naming it',
    command: buildUpdateOfTheRaceClock({}, ['horarioDaLargada']),
    expectedMessage:
      'O gráfico "race-clock" não aceita que o servidor preencha o campo "horarioDaLargada" com o momento do comando: o manifesto do gráfico não marca esse campo como um horário (número inteiro com v_baja.role "wallClock").',
  },
  // The reference time is a whole number, and the schema would accept the stamp as a
  // value: the clock would show fifty-six years. Only the wall-clock mark allows a stamp.
  {
    name: 'refuses a stamp on a whole number that is not marked as a wall-clock moment',
    command: buildUpdateOfTheRaceClock({}, ['referenceTimeMs']),
    expectedMessage:
      'O gráfico "race-clock" não aceita que o servidor preencha o campo "referenceTimeMs" com o momento do comando: o manifesto do gráfico não marca esse campo como um horário (número inteiro com v_baja.role "wallClock").',
  },
  // The team lower third's manifest has no data schema, so nothing marks any of its
  // fields as a moment: it accepts no stamp at all, though it accepts any data.
  {
    name: 'refuses any stamp for a graphic whose manifest has no data schema',
    command: {
      type: 'updateInstanceData',
      instanceId: buildTeam42LowerThirdOnAir().id,
      data: { teamName: 'Baja UFPR Trovão' },
      takeTimeFieldKeys: ['shownSinceMs'],
    },
    expectedMessage:
      'O gráfico "team-lower-third" não aceita que o servidor preencha o campo "shownSinceMs" com o momento do comando: o manifesto do gráfico não marca esse campo como um horário (número inteiro com v_baja.role "wallClock").',
  },
];

describe('updateInstanceData with a cleared or a stamped field, when it must be refused', () => {
  it.each(refusedUpdateScenarios)('$name', ({ command, expectedMessage }) => {
    // Arrange: the race clock on air with the leader on lap 12 and team 42's lower third
    // beside it, and a copy for comparison.
    const slicesBefore = buildRaceDaySlicesWithInstances([
      buildRaceClockOnAirShowingLap12(),
      buildTeam42LowerThirdOnAir(),
    ]);
    const copyOfSlicesBefore = structuredClone(slicesBefore);

    // Act: reduce the update.
    const outcome = reduceCommand(slicesBefore, command, contextOfTheCommand);

    // Assert: refused in pt-BR with the field named, and nothing on air is touched.
    expect(outcome, 'the update must be refused with the field named in pt-BR').toEqual({
      status: 'refused',
      error: { code: 'INVALID_GRAPHIC_DATA', message: expectedMessage },
    });
    expect(slicesBefore, 'a refused update must leave the slices exactly as they were').toEqual(
      copyOfSlicesBefore,
    );
  });
});
