/**
 * takeGraphic and the graphic's data schema (apps/server)
 *
 * What this module is for:
 *   A graphic's manifest carries a JSON Schema of the data it shows. Until now a take
 *   with data the graphic cannot show reached the renderer and was refused there,
 *   after the layer had already been emptied for it. The takeGraphic reducer now checks
 *   the data against the manifest's schema, so a bad take is refused at the server
 *   before anything changes.
 *
 * What these tests prove:
 *   - A take with complete, valid data is applied, with the data stored as sent.
 *   - A take whose data breaks the schema (a missing required field, a wrong value, a
 *     field the graphic does not have) is refused with a pt-BR message naming the
 *     field, and what was on air before is still there.
 *   - A take of a graphic whose manifest schema the server cannot read is refused with
 *     a pt-BR message asking to fix the manifest and restart, and nothing changes.
 *
 * What these tests deliberately do not cover:
 *   - The other rules of a take (replacing, layers, outputs); reduceCommand.test.ts
 *     covers them with graphics that have no data schema.
 *   - Every kind of schema violation; graphicDataValidation.test.ts covers them.
 */
import type { Command, Graphic } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import {
  buildGreenFlagEnduroData,
  buildRaceClockInstanceWithStatus,
  buildRaceDaySlicesWithInstances,
  contextOfTheCommand,
} from './raceDaySlices.testSupport.js';
import { reduceCommand } from './reduceCommand.js';

/** Builds a take of the race clock on the clock layer of program, with the given data. */
function buildTakeOfTheRaceClockWithData(data: Record<string, unknown>): Command {
  return {
    type: 'takeGraphic',
    graphicId: 'race-clock',
    layerId: 'clock',
    data,
    target: 'program',
    takeTimeFieldKeys: [],
  };
}

describe('takeGraphic with data the manifest schema accepts', () => {
  it('puts the race clock on the layer with the data exactly as sent', () => {
    // Arrange: nothing on air, and a take carrying all six required fields.
    const slicesBefore = buildRaceDaySlicesWithInstances([]);
    const takeWithCompleteData = buildTakeOfTheRaceClockWithData(buildGreenFlagEnduroData());

    // Act: reduce the take.
    const outcome = reduceCommand(slicesBefore, takeWithCompleteData, contextOfTheCommand);

    // Assert: applied, with one new loading instance holding the data as sent.
    expect(outcome.status, 'a take with valid data must be applied').toBe('applied');
    expect(
      outcome.status === 'applied' ? outcome.slices.instances : undefined,
      'the new instance must hold the data as sent and wait for the renderer as loading',
    ).toEqual([
      {
        id: contextOfTheCommand.newInstanceId,
        layerId: 'clock',
        graphicId: 'race-clock',
        target: 'program',
        resolvedData: buildGreenFlagEnduroData(),
        currentStep: 0,
        status: 'loading',
        takenAt: contextOfTheCommand.now,
      },
    ]);
  });
});

const takesWithInvalidDataScenarios: Array<{
  name: string;
  data: Record<string, unknown>;
  expectedMessage: string;
}> = [
  // What every M0 test sent: two fields out of six. The graphic refuses it, so the
  // server now does, naming the first required field that is missing.
  {
    name: 'refuses a take that leaves out a required field, naming it',
    data: { sessionName: 'Enduro de Resistência', state: 'green' },
    expectedMessage:
      'Dados inválidos para o gráfico "race-clock": o campo "clockMode" é obrigatório e não foi enviado.',
  },
  // A negative time makes no sense on a clock.
  {
    name: 'refuses a take with a negative reference time, naming the field',
    data: { ...buildGreenFlagEnduroData(), referenceTimeMs: -5000 },
    expectedMessage:
      'Dados inválidos para o gráfico "race-clock": o campo "referenceTimeMs" tem um valor que o gráfico não aceita.',
  },
  // A field from another graphic slipped into the payload.
  {
    name: 'refuses a take with a field the race clock does not have, naming it',
    data: { ...buildGreenFlagEnduroData(), teamNumber: 42 },
    expectedMessage:
      'Dados inválidos para o gráfico "race-clock": o campo "teamNumber" não existe neste gráfico.',
  },
];

describe('takeGraphic with data the manifest schema refuses', () => {
  it.each(takesWithInvalidDataScenarios)('$name', ({ data, expectedMessage }) => {
    // Arrange: the race clock already on air, which a take on its layer would replace.
    const slicesBefore = buildRaceDaySlicesWithInstances([
      buildRaceClockInstanceWithStatus('on-air'),
    ]);
    const copyOfSlicesBefore = structuredClone(slicesBefore);

    // Act: reduce the take with the bad data.
    const outcome = reduceCommand(
      slicesBefore,
      buildTakeOfTheRaceClockWithData(data),
      contextOfTheCommand,
    );

    // Assert: refused in pt-BR with the field named, and the clock on air is untouched.
    expect(outcome, 'the take must be refused with the field named in pt-BR').toEqual({
      status: 'refused',
      error: { code: 'INVALID_GRAPHIC_DATA', message: expectedMessage },
    });
    expect(
      slicesBefore,
      'a refused take must change nothing: the clock on air stays as it was',
    ).toEqual(copyOfSlicesBefore);
  });
});

describe('takeGraphic of a graphic whose manifest schema cannot be read', () => {
  it('refuses the take in pt-BR, asking for the manifest to be fixed', () => {
    // Arrange: the race clock on air, and a scoreboard registered with a schema that says
    // `type: "texto"`, which is not a JSON Schema type, so the server cannot check its data.
    const raceDaySlices = buildRaceDaySlicesWithInstances([
      buildRaceClockInstanceWithStatus('on-air'),
    ]);
    const scoreboardWithBrokenSchema: Graphic = {
      id: 'scoreboard-quebrado',
      manifest: {
        id: 'baja-scoreboard-quebrado',
        name: 'Placar',
        main: 'scoreboard-quebrado.js',
        schema: { type: 'object', properties: { leaderName: { type: 'texto' } } },
      },
      defaultLayerId: 'fullscreen',
      category: 'other',
      thumbnailUrl: null,
      defaultFields: {},
    };
    const slicesBefore = {
      ...raceDaySlices,
      graphics: [...raceDaySlices.graphics, scoreboardWithBrokenSchema],
    };
    const copyOfSlicesBefore = structuredClone(slicesBefore);

    // Act: take the scoreboard on the fullscreen layer with the leader's name.
    const outcome = reduceCommand(
      slicesBefore,
      {
        type: 'takeGraphic',
        graphicId: 'scoreboard-quebrado',
        layerId: 'fullscreen',
        data: { leaderName: 'Baja UFPR' },
        target: 'program',
        takeTimeFieldKeys: [],
      },
      contextOfTheCommand,
    );

    // Assert: refused with the sentence that points at the manifest, and nothing changed.
    expect(outcome, 'a take of a graphic with an unreadable schema must be refused').toEqual({
      status: 'refused',
      error: {
        code: 'INVALID_GRAPHIC_DATA',
        message:
          'O gráfico "scoreboard-quebrado" tem um esquema de dados que o servidor não consegue ler. Corrija o manifesto do gráfico e reinicie o servidor.',
      },
    });
    expect(slicesBefore, 'a refused take must change nothing').toEqual(copyOfSlicesBefore);
  });
});
