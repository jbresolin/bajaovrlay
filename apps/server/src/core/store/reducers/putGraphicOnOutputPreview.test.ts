/**
 * putGraphicOnOutput aimed at the preview output (apps/server)
 *
 * What this module is for:
 *   putGraphicOnOutput is the internal take step every take and every preview of an item
 *   ends in (previewItem, previewMacro, takeItem, takePreview...). Aimed at the PREVIEW
 *   output, it shows a graphic on the Prévia monitor before anything goes on air, with
 *   the same data and the same checks as a take on program, run by the same code. Until
 *   BAJAOVRLAY-37 the public command previewGraphic ("Edição rápida") was a thin wrapper
 *   around it; that command is gone, and these are the rules it used to prove.
 *
 * What these tests prove:
 *   - The preview instance carries the request's item and is marked as asked for by
 *     hand (`previewOrigin: 'manual'`); the clock on program stays.
 *   - It replaces the preview of that layer only: the program output and the previews of
 *     other layers stay.
 *   - A field named in `takeTimeFieldKeys` is stamped with the moment of the preview and
 *     its key is remembered on the instance. A field sent as null is left out of the data.
 *   - A new preview takes its layer's "will be cleared" marker off, and leaves the
 *     markers of other layers alone.
 *   - It is refused, as a take is, for an unknown layer or graphic, for data the graphic
 *     does not accept and for a stamp on a field that is not a moment.
 *
 * What these tests deliberately do not cover:
 *   - Every way data can break a graphic's schema; putGraphicOnOutputData.test.ts and
 *     graphicDataValidation.test.ts cover them, and this step runs the same check.
 *   - How previewItem turns an item into this request, and the `auto` origin of
 *     "Prévia automática"; previewItem.test.ts and previewItemOrigin.test.ts cover them.
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
import { type GraphicOnOutputRequest, putGraphicOnOutput } from './putGraphicOnOutput.js';
import {
  buildEnduroClockData,
  buildRaceDaySlicesWithTheRaceClockSchema,
  contextOfTheRundownCommand,
} from './rundownSlices.testSupport.js';

/**
 * Builds the request to preview the red flag clock of the shortcut "Relógio — bandeira
 * vermelha" on the clock layer, with nothing to stamp.
 */
function buildRequestToPreviewTheRedFlagClock(): GraphicOnOutputRequest {
  return {
    graphicId: 'race-clock',
    layerId: 'clock',
    data: buildEnduroClockData('red'),
    target: 'preview',
    takeTimeFieldKeys: [],
    itemId: 'item-atalho-bandeira-vermelha',
  };
}

describe('putGraphicOnOutput on the preview output, the instance it makes', () => {
  it('puts the item beside the clock on air, marked as asked for by hand', () => {
    // Arrange: the green clock on air, and nothing on preview.
    const slicesBefore = buildRaceDaySlicesWithTheRaceClockSchema({
      items: [],
      instances: [buildGreenFlagClockOnProgram()],
    });

    // Act: preview the red flag clock of the shortcut item.
    const outcome = putGraphicOnOutput(
      slicesBefore,
      buildRequestToPreviewTheRedFlagClock(),
      contextOfTheRundownCommand,
    );

    // Assert: the red flag is beside the clock on air, names its item, and is marked as
    // asked for by hand: only previewItem may change the mark to `auto`.
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
        previewOrigin: 'manual',
        itemId: 'item-atalho-bandeira-vermelha',
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

    // Act: preview the red flag clock on the clock layer.
    const outcome = putGraphicOnOutput(slicesBefore, buildRequestToPreviewTheRedFlagClock(), {
      ...contextOfTheRundownCommand,
      newInstanceId: 'd4b8a2f6-0c1e-4a3d-9f57-8e6c4b2a1d09',
    });

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

  it('stamps the field left to the server, remembers it, and leaves a cleared field out', () => {
    // Arrange: a race day with nothing on any output, and the request "Largada do enduro"
    // makes: a clock at zero, the laps cleared (null), the reference moment to be stamped.
    const slicesBefore = buildRaceDaySlicesWithTheRaceClockSchema({ items: [] });
    const requestWithAStampAndAClearedField: GraphicOnOutputRequest = {
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
      target: 'preview',
      takeTimeFieldKeys: ['referenceWallClockMs'],
      itemId: 'item-largada-do-enduro',
    };

    // Act: preview it at 14:32:05.
    const outcome = putGraphicOnOutput(
      slicesBefore,
      requestWithAStampAndAClearedField,
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

  it('takes the marker off its own layer and leaves the marker of another layer', () => {
    // Arrange: "Prévia: limpar" pressed on the clock and the lower third layers.
    const slicesBefore = buildRaceDaySlicesWithTheRaceClockSchema({
      items: [],
      previewClearedLayerIds: ['clock', 'lower-third'],
    });

    // Act: preview the red flag clock on the clock layer.
    const outcome = putGraphicOnOutput(
      slicesBefore,
      buildRequestToPreviewTheRedFlagClock(),
      contextOfTheRundownCommand,
    );

    // Assert: Prévia now shows a clock there, so only the lower third still says "will be cleared".
    expect(
      outcome.status === 'applied' ? outcome.slices.previewClearedLayerIds : undefined,
      'a new preview must take the marker off its own layer only',
    ).toEqual(['lower-third']);
  });
});

describe('putGraphicOnOutput on the preview output, when it must be refused', () => {
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
          'Dados inválidos para o gráfico "race-clock": o campo "Bandeira" tem um valor que o gráfico não aceita.',
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

      // Act: ask the take step for the preview of this row.
      const outcome = putGraphicOnOutput(
        slicesBefore,
        {
          graphicId,
          layerId,
          data,
          target: 'preview',
          takeTimeFieldKeys,
          itemId: 'item-atalho-bandeira-vermelha',
        },
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
