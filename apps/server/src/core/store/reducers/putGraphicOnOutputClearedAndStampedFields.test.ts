/**
 * takeGraphic with a cleared field or a stamped field (apps/server)
 *
 * What this module is for:
 *   The control page's generated form sends a take with two things a graphic's schema
 *   knows nothing about. A field the operator cleared with "limpar" arrives as `null`.
 *   And a wall-clock field left "to the moment of the take" is not sent at all: the
 *   command names it in `takeTimeFieldKeys`. The reducer leaves null fields out, writes
 *   the command's own moment (in wall-clock milliseconds) into each named field, and
 *   only then checks the data against the graphic's manifest schema.
 *
 * What these tests prove:
 *   - A top-level null is left out of the instance's data, so the race clock (whose
 *     schema refuses a null lap count) accepts the take.
 *   - A field named in `takeTimeFieldKeys` holds the moment of the command, the same
 *     moment as `takenAt`, whether or not the data carried a value for it.
 *   - A field both sent as null and named for stamping ends up stamped.
 *   - A REQUIRED field sent as null is refused as a missing field; what was on air stays.
 *   - A stamp is refused, naming the field, unless the graphic's schema declares that
 *     field as a whole number marked `v_baja.role: "wallClock"`: a text field, a field
 *     the graphic does not have and a whole number without the mark are all refused,
 *     and a graphic with no data schema accepts no stamp at all; what was on air stays.
 *   - The reducer does not change the command it was given.
 *
 * What these tests deliberately do not cover:
 *   - The plain data check of a take; takeGraphicData.test.ts covers it.
 *   - An item's fields (a literal null, a `takeTime` field) going through takeItem;
 *     takeItemClearedField.test.ts and takeItemTakeTime.test.ts cover them.
 */
import type { Command } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import {
  buildGreenFlagEnduroData,
  buildRaceClockInstanceWithStatus,
  buildRaceDaySlicesWithInstances,
  contextOfTheCommand,
} from './raceDaySlices.testSupport.js';
import { reduceCommand } from './reduceCommand.js';

// The moment contextOfTheCommand names, 14:32:05 UTC on 9 October 2026, in milliseconds.
const momentOfTheCommandInMilliseconds = 1_791_556_325_000;

/** Builds a take of the race clock on the clock layer of program. */
function buildTakeOfTheRaceClock(
  data: Record<string, unknown>,
  takeTimeFieldKeys: string[],
): Command {
  return {
    type: 'takeGraphic',
    graphicId: 'race-clock',
    layerId: 'clock',
    data,
    target: 'program',
    takeTimeFieldKeys,
  };
}

/** Builds the green flag enduro data without its reference moment, as the form sends it. */
function buildGreenFlagEnduroDataWithoutReferenceMoment(): Record<string, unknown> {
  return {
    sessionName: 'Enduro de Resistência',
    state: 'green',
    clockMode: 'elapsed',
    referenceTimeMs: 3_900_000,
    running: true,
  };
}

const appliedTakeScenarios: Array<{
  name: string;
  command: Command;
  expectedResolvedData: Record<string, unknown>;
}> = [
  // The laps field was cleared in the form: the graphic must not receive it at all.
  {
    name: 'leaves a field sent as null out of the data on air',
    command: buildTakeOfTheRaceClock(
      { ...buildGreenFlagEnduroData(), lapsCompletedByLeader: null },
      [],
    ),
    expectedResolvedData: buildGreenFlagEnduroData(),
  },
  // The usual take from the generated form: the reference moment is left to the server.
  {
    name: 'stamps the reference moment, which the data did not carry, with the take',
    command: buildTakeOfTheRaceClock(buildGreenFlagEnduroDataWithoutReferenceMoment(), [
      'referenceWallClockMs',
    ]),
    expectedResolvedData: {
      ...buildGreenFlagEnduroDataWithoutReferenceMoment(),
      referenceWallClockMs: momentOfTheCommandInMilliseconds,
    },
  },
  // A client that sends its own moment and also asks for the stamp gets the server's.
  {
    name: 'lets the stamp replace a value sent for the same field',
    command: buildTakeOfTheRaceClock(buildGreenFlagEnduroData(), ['referenceWallClockMs']),
    expectedResolvedData: {
      ...buildGreenFlagEnduroData(),
      referenceWallClockMs: momentOfTheCommandInMilliseconds,
    },
  },
  // Null and stamp for one field contradict each other; the stamp wins.
  {
    name: 'stamps a field that is both sent as null and named for stamping',
    command: buildTakeOfTheRaceClock(
      { ...buildGreenFlagEnduroDataWithoutReferenceMoment(), referenceWallClockMs: null },
      ['referenceWallClockMs'],
    ),
    expectedResolvedData: {
      ...buildGreenFlagEnduroDataWithoutReferenceMoment(),
      referenceWallClockMs: momentOfTheCommandInMilliseconds,
    },
  },
];

describe('takeGraphic with a cleared or a stamped field, when it can be applied', () => {
  it.each(appliedTakeScenarios)('$name', ({ command, expectedResolvedData }) => {
    // Arrange: nothing on air, and a copy of the command for comparison.
    const slicesBefore = buildRaceDaySlicesWithInstances([]);
    const copyOfTheCommand = structuredClone(command);

    // Act: reduce the take at 14:32:05.
    const outcome = reduceCommand(slicesBefore, command, contextOfTheCommand);

    // Assert: applied; the one instance holds the prepared data and was taken at the
    // very moment a stamped field says; the command itself was not edited.
    expect(outcome.status, 'the race clock must accept the prepared data').toBe('applied');
    const instanceOnAir = outcome.status === 'applied' ? outcome.slices.instances[0] : undefined;
    expect(
      instanceOnAir?.resolvedData,
      'the data on air must have no null field and the stamped moment',
    ).toEqual(expectedResolvedData);
    expect(
      new Date(momentOfTheCommandInMilliseconds).toISOString(),
      'the moment a stamp writes and takenAt must be one and the same moment',
    ).toBe(instanceOnAir?.takenAt);
    expect(command, 'a reducer must never edit the command it was given').toEqual(copyOfTheCommand);
  });
});

const refusedTakeScenarios: Array<{
  name: string;
  command: Command;
  expectedMessage: string;
}> = [
  // Clearing is for optional fields: a required one sent as null is simply missing.
  {
    name: 'refuses a take whose required session name is sent as null, naming it as missing',
    command: buildTakeOfTheRaceClock({ ...buildGreenFlagEnduroData(), sessionName: null }, []),
    expectedMessage:
      'Dados inválidos para o gráfico "race-clock": o campo "sessionName" é obrigatório e não foi enviado.',
  },
  // From here on: the server stamps only a field the graphic's schema declares as a
  // whole number marked `v_baja.role: "wallClock"`. The flag is one of six texts.
  {
    name: 'refuses a stamp on a field that is not a whole number, naming the field',
    command: buildTakeOfTheRaceClock(buildGreenFlagEnduroData(), ['state']),
    expectedMessage:
      'O gráfico "race-clock" não aceita que o servidor preencha o campo "state" com o momento do comando: o manifesto do gráfico não marca esse campo como um horário (número inteiro com v_baja.role "wallClock").',
  },
  // A stamp on a field the graphic does not have must not go on air next to the real ones.
  {
    name: 'refuses a stamp on a field the race clock does not have, naming it',
    command: buildTakeOfTheRaceClock(buildGreenFlagEnduroData(), ['horarioDaLargada']),
    expectedMessage:
      'O gráfico "race-clock" não aceita que o servidor preencha o campo "horarioDaLargada" com o momento do comando: o manifesto do gráfico não marca esse campo como um horário (número inteiro com v_baja.role "wallClock").',
  },
  // The reference time is a whole number, and the schema would accept the stamp as a
  // value: the clock would show fifty-six years. Only the wall-clock mark allows a stamp.
  {
    name: 'refuses a stamp on a whole number that is not marked as a wall-clock moment',
    command: buildTakeOfTheRaceClock(buildGreenFlagEnduroData(), ['referenceTimeMs']),
    expectedMessage:
      'O gráfico "race-clock" não aceita que o servidor preencha o campo "referenceTimeMs" com o momento do comando: o manifesto do gráfico não marca esse campo como um horário (número inteiro com v_baja.role "wallClock").',
  },
  // The team lower third's manifest has no data schema, so nothing marks any of its
  // fields as a moment: it accepts no stamp at all, though it accepts any data.
  {
    name: 'refuses any stamp for a graphic whose manifest has no data schema',
    command: {
      type: 'takeGraphic',
      graphicId: 'team-lower-third',
      layerId: 'lower-third',
      data: { teamNumber: 42, teamName: 'Baja UFPR' },
      target: 'program',
      takeTimeFieldKeys: ['shownSinceMs'],
    },
    expectedMessage:
      'O gráfico "team-lower-third" não aceita que o servidor preencha o campo "shownSinceMs" com o momento do comando: o manifesto do gráfico não marca esse campo como um horário (número inteiro com v_baja.role "wallClock").',
  },
];

describe('takeGraphic with a cleared or a stamped field, when it must be refused', () => {
  it.each(refusedTakeScenarios)('$name', ({ command, expectedMessage }) => {
    // Arrange: the race clock already on air, which a take on its layer would replace.
    const slicesBefore = buildRaceDaySlicesWithInstances([
      buildRaceClockInstanceWithStatus('on-air'),
    ]);
    const copyOfSlicesBefore = structuredClone(slicesBefore);

    // Act: reduce the take.
    const outcome = reduceCommand(slicesBefore, command, contextOfTheCommand);

    // Assert: refused in pt-BR with the field named, and the clock on air is untouched.
    expect(outcome, 'the take must be refused with the field named in pt-BR').toEqual({
      status: 'refused',
      error: { code: 'INVALID_GRAPHIC_DATA', message: expectedMessage },
    });
    expect(slicesBefore, 'a refused take must change nothing').toEqual(copyOfSlicesBefore);
  });
});
