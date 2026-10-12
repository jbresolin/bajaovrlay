/**
 * The previewGraphic reducer (apps/server)
 *
 * What this module is for:
 *   "Edição rápida" lets the operator type a graphic's data by hand. previewGraphic shows
 *   that graphic on the PREVIEW output of a layer before anything goes on air. It is a
 *   takeGraphic that can only go to the preview output: the same data, the same checks,
 *   run by the same code.
 *
 * What these tests prove:
 *   - The outcome is exactly the outcome of a takeGraphic with `target: 'preview'`.
 *   - It replaces the preview of that layer only: the program output and the previews of
 *     other layers stay.
 *   - A field named in `takeTimeFieldKeys` is stamped with the moment of the preview and
 *     its key is remembered on the instance; with no such field the instance carries no
 *     list. A field sent as null is left out of the data.
 *   - It is refused, as a take is, for an unknown layer or graphic, for data the graphic
 *     does not accept and for a stamp on a field that is not a moment.
 *
 * What these tests deliberately do not cover:
 *   - Every way data can break a graphic's schema; takeGraphicData.test.ts and
 *     graphicDataValidation.test.ts cover them, and this reducer runs the same check.
 *   - Sending the preview to air; takePreview.test.ts covers it.
 */
import { describe, expect, it } from 'vitest';

import {
  buildGreenFlagClockOnProgram,
  buildTeam42LowerThirdOnPreview,
  buildYellowFlagItemOnPreview,
  momentOfThePreviewInMilliseconds,
  readLayerAndOutputOfEachInstance,
} from './previewSlices.testSupport.js';
import { reduceCommand } from './reduceCommand.js';
import {
  buildEnduroClockData,
  buildRaceDaySlicesWithTheRaceClockSchema,
  contextOfTheRundownCommand,
} from './rundownSlices.testSupport.js';

describe('previewGraphic, the instance it puts on the preview output', () => {
  it('gives exactly what a takeGraphic aimed at the preview output gives', () => {
    // Arrange: the green clock on air, and what a takeGraphic with target preview gives
    // for the red flag clock on those slices.
    const slicesBefore = buildRaceDaySlicesWithTheRaceClockSchema({
      items: [],
      instances: [buildGreenFlagClockOnProgram()],
    });
    const outcomeOfTakeOnPreview = reduceCommand(
      slicesBefore,
      {
        type: 'takeGraphic',
        graphicId: 'race-clock',
        layerId: 'clock',
        data: buildEnduroClockData('red'),
        target: 'preview',
        takeTimeFieldKeys: [],
      },
      contextOfTheRundownCommand,
    );

    // Act: preview the same clock with previewGraphic.
    const outcome = reduceCommand(
      slicesBefore,
      {
        type: 'previewGraphic',
        graphicId: 'race-clock',
        layerId: 'clock',
        data: buildEnduroClockData('red'),
        takeTimeFieldKeys: [],
      },
      contextOfTheRundownCommand,
    );

    // Assert: the two outcomes are equal, and the red flag is beside the clock on air.
    expect(outcome, 'previewGraphic must be a takeGraphic on the preview output').toEqual(
      outcomeOfTakeOnPreview,
    );
    const instancesAfter = outcome.status === 'applied' ? outcome.slices.instances : undefined;
    expect(instancesAfter, 'program must stay, with the red flag beside it on preview').toEqual([
      buildGreenFlagClockOnProgram(),
      {
        id: contextOfTheRundownCommand.newInstanceId,
        layerId: 'clock',
        graphicId: 'race-clock',
        target: 'preview',
        resolvedData: buildEnduroClockData('red'),
        currentStep: 0,
        status: 'loading',
        takenAt: '2026-10-09T14:32:05.000Z',
      },
    ]);
  });

  it('replaces the preview of the same layer only', () => {
    // Arrange: the yellow flag item and a lower third previewed, and the green clock on air.
    const slicesBefore = buildRaceDaySlicesWithTheRaceClockSchema({
      items: [],
      instances: [
        buildGreenFlagClockOnProgram(),
        buildYellowFlagItemOnPreview(),
        buildTeam42LowerThirdOnPreview(),
      ],
    });

    // Act: preview the red flag clock by hand on the clock layer.
    const outcome = reduceCommand(
      slicesBefore,
      {
        type: 'previewGraphic',
        graphicId: 'race-clock',
        layerId: 'clock',
        data: buildEnduroClockData('red'),
        takeTimeFieldKeys: [],
      },
      { ...contextOfTheRundownCommand, newInstanceId: 'd4b8a2f6-0c1e-4a3d-9f57-8e6c4b2a1d09' },
    );

    // Assert: the yellow flag preview gave way; the lower third preview and program stayed.
    const instancesAfter = outcome.status === 'applied' ? outcome.slices.instances : undefined;
    expect(
      readLayerAndOutputOfEachInstance(instancesAfter),
      'only the preview of the clock layer may be replaced',
    ).toEqual(['clock on program', 'lower-third on preview', 'clock on preview']);
    expect(
      instancesAfter?.at(-1)?.resolvedData.state,
      'the preview of the clock layer must now show the red flag',
    ).toBe('red');
  });

  it('stamps the field the page left to the server, remembers it, and leaves a cleared field out', () => {
    // Arrange: a race day with nothing on any output. The page sends a clock at zero, the
    // laps cleared (null), and names the reference moment for the server to stamp.
    const slicesBefore = buildRaceDaySlicesWithTheRaceClockSchema({ items: [] });

    // Act: preview it at 14:32:05.
    const outcome = reduceCommand(
      slicesBefore,
      {
        type: 'previewGraphic',
        graphicId: 'race-clock',
        layerId: 'clock',
        data: {
          sessionName: 'Enduro de Resistência',
          state: 'green',
          clockMode: 'elapsed',
          referenceTimeMs: 0,
          running: true,
          lapsCompletedByLeader: null,
        },
        takeTimeFieldKeys: ['referenceWallClockMs'],
      },
      contextOfTheRundownCommand,
    );

    // Assert: the data holds the moment of the preview and no laps, and the instance
    // remembers the stamped field so a takePreview can stamp it again.
    const previewInstance = outcome.status === 'applied' ? outcome.slices.instances[0] : undefined;
    expect(
      previewInstance?.resolvedData,
      'the stamp must be in the data, the null left out',
    ).toEqual({
      sessionName: 'Enduro de Resistência',
      state: 'green',
      clockMode: 'elapsed',
      referenceTimeMs: 0,
      referenceWallClockMs: momentOfThePreviewInMilliseconds,
      running: true,
    });
    expect(
      previewInstance?.takeTimeFieldKeys,
      'the preview must remember which field was stamped',
    ).toEqual(['referenceWallClockMs']);
  });
});

describe('previewGraphic that must be refused', () => {
  const refusedPreviewScenarios = [
    // A layer that is not on the stage cannot show a preview either.
    {
      name: 'refuses a layer that does not exist',
      layerId: 'placar',
      graphicId: 'race-clock',
      data: buildEnduroClockData('red'),
      takeTimeFieldKeys: [],
      expectedError: { code: 'LAYER_NOT_FOUND', message: 'A camada "placar" não existe.' },
    },
    // A graphic that is not built is not registered, and cannot be previewed.
    {
      name: 'refuses a graphic that is not registered',
      layerId: 'clock',
      graphicId: 'podium-card',
      data: { teamName: 'Baja UFPR' },
      takeTimeFieldKeys: [],
      expectedError: {
        code: 'GRAPHIC_NOT_FOUND',
        message: 'O gráfico "podium-card" não está registrado.',
      },
    },
    // The race clock has no "purple" flag; the Prévia monitor must not show a broken clock.
    {
      name: 'refuses data the graphic does not accept',
      layerId: 'clock',
      graphicId: 'race-clock',
      data: { ...buildEnduroClockData('red'), state: 'purple' },
      takeTimeFieldKeys: [],
      expectedError: {
        code: 'INVALID_GRAPHIC_DATA',
        message:
          'Dados inválidos para o gráfico "race-clock": o campo "state" tem um valor que o gráfico não aceita.',
      },
    },
    // The server stamps its moment only into a field the manifest marks as a moment.
    {
      name: 'refuses a stamp on a field that is not a wall-clock moment',
      layerId: 'clock',
      graphicId: 'race-clock',
      data: buildEnduroClockData('red'),
      takeTimeFieldKeys: ['referenceTimeMs'],
      expectedError: {
        code: 'INVALID_GRAPHIC_DATA',
        message:
          'O gráfico "race-clock" não aceita que o servidor preencha o campo "referenceTimeMs" com o momento do comando: o manifesto do gráfico não marca esse campo como um horário (número inteiro com v_baja.role "wallClock").',
      },
    },
  ];

  it.each(refusedPreviewScenarios)(
    '$name',
    ({ layerId, graphicId, data, takeTimeFieldKeys, expectedError }) => {
      // Arrange: a race day with the yellow flag item already previewed on the clock layer.
      const slicesBefore = buildRaceDaySlicesWithTheRaceClockSchema({
        items: [],
        instances: [buildYellowFlagItemOnPreview()],
      });

      // Act: send the previewGraphic of this row.
      const outcome = reduceCommand(
        slicesBefore,
        { type: 'previewGraphic', graphicId, layerId, data, takeTimeFieldKeys },
        contextOfTheRundownCommand,
      );

      // Assert: refused with the reason a take gives; a refusal carries no new slices, so
      // the preview that was there stays.
      expect(outcome, 'the preview must be refused with the reason of the row').toEqual({
        status: 'refused',
        error: expectedError,
      });
    },
  );
});
