/**
 * The takePreview reducer: what goes on air (apps/server)
 *
 * What this module is for:
 *   takePreview sends what the operator is looking at in the Prévia monitor to the
 *   program output: "Tomar". The promise is that what was seen is what goes to air, so
 *   the data is NOT worked out again from the item; the preview instance's own data is
 *   used. There is one exception: a field the preview had stamped with its own moment
 *   (a race clock's reference moment) gets the moment of the take instead, because a
 *   clock must start counting when it goes on air, not when it was previewed.
 *
 * What these tests prove:
 *   - The program instance is new (new id, the take's moment, status loading) and has
 *     the preview's graphic, item id and data; the preview of that layer is gone, what
 *     was on program on that layer is replaced, and other layers and their previews stay.
 *   - The data is the previewed data even when the item was edited after the preview.
 *   - Data without a stamped field goes on air unchanged; data with one changes in that
 *     field alone, which holds the moment of the take; the program instance carries
 *     neither the list of stamped fields nor the preview's `previewOrigin`.
 *   - With nothing previewed on the layer the take is refused in pt-BR, naming the layer
 *     as the operator reads it. An unknown layer is refused too.
 *   - The take goes through the checks of every take: if the graphic is no longer
 *     registered, or its schema no longer accepts the data or the stamp, it is refused.
 *   - A preview with no item (which no command makes since BAJAOVRLAY-37, so only a
 *     damaged state holds one) is refused with INSTANCE_WITHOUT_ITEM, and nothing changes.
 *
 * What these tests deliberately do not cover:
 *   - What the take does to the rundown's cursor; takePreviewCursor.test.ts covers it.
 *   - The auto-out that may follow; autoOutAndPreview.test.ts covers it.
 *   - The whole path through the store and SQLite; storePreviewCommands.test.ts.
 */
import type { Graphic, Instance } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { raceClockManifestForTests } from '../builtGraphicsFolder.testSupport.js';
import {
  buildGreenFlagClockOnProgram,
  buildStartItemOnPreviewWithItsMomentStamped,
  buildTeam42LowerThirdOnPreview,
  buildYellowFlagItemOnPreview,
  contextOfTheLaterTake,
  momentOfTheLaterTakeInMilliseconds,
} from './previewSlices.testSupport.js';
import { reduceCommand } from './reduceCommand.js';
import type { SlicesChangedByCommands } from './reducerTypes.js';
import {
  buildEnduroClockData,
  buildEnduroStartItem,
  buildRaceDaySlicesWithTheRaceClockSchema,
  buildTeam42LowerThirdTakenByHand,
  buildYellowFlagItem,
} from './rundownSlices.testSupport.js';

/**
 * Builds a race day (race clock registered with its real data schema) holding the start
 * and yellow flag items, and the given instances.
 */
function buildRaceDayWithInstances(instances: Instance[]): SlicesChangedByCommands {
  return buildRaceDaySlicesWithTheRaceClockSchema({
    items: [buildEnduroStartItem(0), buildYellowFlagItem(1)],
    instances,
  });
}

/** Returns the same slices with the race clock registered under another manifest. */
function replaceRaceClockManifest(
  slices: SlicesChangedByCommands,
  manifest: Graphic['manifest'],
): SlicesChangedByCommands {
  const graphicsWithTheOtherManifest = slices.graphics.map((graphic) =>
    graphic.id === 'race-clock' ? { ...graphic, manifest } : graphic,
  );
  return { ...slices, graphics: graphicsWithTheOtherManifest };
}

describe('takePreview, the instance it puts on air', () => {
  it('moves the previewed item to program as a new instance and empties that preview', () => {
    // Arrange: the green clock and a lower third on air; the yellow flag item previewed
    // on the clock layer since 14:32:05 and another lower third previewed on its layer.
    const slicesBefore = buildRaceDayWithInstances([
      buildGreenFlagClockOnProgram(),
      buildTeam42LowerThirdTakenByHand(),
      buildYellowFlagItemOnPreview(),
      buildTeam42LowerThirdOnPreview(),
    ]);

    // Act: press "Tomar" for the clock layer at 14:47:30.250.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'takePreview', layerId: 'clock' },
      contextOfTheLaterTake,
    );

    // Assert: the lower third on air and the lower third preview are untouched; the green
    // clock and the yellow preview are gone; the yellow flag is on program as a new
    // instance carrying the previewed data, written out in full.
    expect(outcome.status, 'the preview must be taken').toBe('applied');
    const instancesAfter = outcome.status === 'applied' ? outcome.slices.instances : undefined;
    expect(instancesAfter, 'the previewed item must be the new program instance').toEqual([
      buildTeam42LowerThirdTakenByHand(),
      buildTeam42LowerThirdOnPreview(),
      {
        id: contextOfTheLaterTake.newInstanceId,
        layerId: 'clock',
        graphicId: 'race-clock',
        target: 'program',
        resolvedData: buildEnduroClockData('yellow'),
        currentStep: 0,
        status: 'loading',
        takenAt: '2026-10-09T14:47:30.250Z',
        itemId: 'item-bandeira-amarela',
      },
    ]);
  });

  it('puts on air what was previewed, not what the item says after a later edit', () => {
    // Arrange: the yellow flag item previewed, and then edited to the red flag while the
    // operator was still looking at the yellow one in the Prévia monitor.
    const slicesAtThePreview = buildRaceDayWithInstances([buildYellowFlagItemOnPreview()]);
    const yellowFlagItemEditedToRed = {
      ...buildYellowFlagItem(1),
      fields: {
        ...buildYellowFlagItem(1).fields,
        state: { kind: 'literal' as const, value: 'red' },
      },
    };
    const slicesBefore = {
      ...slicesAtThePreview,
      items: [buildEnduroStartItem(0), yellowFlagItemEditedToRed],
    };

    // Act: press "Tomar".
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'takePreview', layerId: 'clock' },
      contextOfTheLaterTake,
    );

    // Assert: yellow goes on air, as seen; the item is not resolved a second time.
    const instanceOnAir = outcome.status === 'applied' ? outcome.slices.instances[0] : undefined;
    expect(instanceOnAir?.resolvedData.state, 'what was seen must be what goes to air').toBe(
      'yellow',
    );
  });
});

describe('takePreview and the data it carries', () => {
  const dataScenarios = [
    // The plain case: every field was a typed value, so nothing at all may change.
    {
      name: 'carries data with no stamped field to program unchanged',
      previewInstance: buildYellowFlagItemOnPreview(),
      expectedDataOnAir: buildEnduroClockData('yellow'),
    },
    // The exception: the reference moment was a stamp, so it becomes the moment of the
    // take (14:47:30.250) and the clock starts at zero on air; no other field moves.
    {
      name: 'writes the moment of the take over the stamped field and changes nothing else',
      previewInstance: buildStartItemOnPreviewWithItsMomentStamped(),
      expectedDataOnAir: {
        ...buildEnduroClockData('green'),
        referenceTimeMs: 0,
        referenceWallClockMs: momentOfTheLaterTakeInMilliseconds,
      },
    },
  ];

  it.each(dataScenarios)('$name', ({ previewInstance, expectedDataOnAir }) => {
    // Arrange: a race day with only the preview of this row.
    const slicesBefore = buildRaceDayWithInstances([previewInstance]);

    // Act: press "Tomar" at 14:47:30.250.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'takePreview', layerId: 'clock' },
      contextOfTheLaterTake,
    );

    // Assert: the data of the row is on air, and the program instance carries neither the
    // list of stamped fields nor who asked for the preview: both only belong to a preview.
    const instanceOnAir = outcome.status === 'applied' ? outcome.slices.instances[0] : undefined;
    expect(instanceOnAir?.resolvedData, 'the data on air must be the one of the row').toEqual(
      expectedDataOnAir,
    );
    expect(
      instanceOnAir === undefined ? undefined : Object.hasOwn(instanceOnAir, 'takeTimeFieldKeys'),
      'a program instance must not carry the list of stamped fields',
    ).toBe(false);
    expect(
      instanceOnAir === undefined ? undefined : Object.hasOwn(instanceOnAir, 'previewOrigin'),
      'a program instance must not carry who asked for the preview',
    ).toBe(false);
  });
});

describe('takePreview that must be refused', () => {
  // The race clock's manifest as it would be if its flag list lost the yellow flag.
  const manifestWithoutTheYellowFlag = {
    ...raceClockManifestForTests,
    schema: {
      ...raceClockManifestForTests.schema,
      properties: {
        ...raceClockManifestForTests.schema.properties,
        state: { type: 'string', enum: ['pre', 'green', 'red', 'checkered', 'finished'] },
      },
    },
  };
  // The same manifest with the reference moment no longer marked as a wall-clock moment.
  const manifestWithoutTheWallClockRole = {
    ...raceClockManifestForTests,
    schema: {
      ...raceClockManifestForTests.schema,
      properties: {
        ...raceClockManifestForTests.schema.properties,
        referenceWallClockMs: { type: 'integer', minimum: 0 },
      },
    },
  };

  const refusedTakeScenarios = [
    // "Tomar" pressed with an empty Prévia: there is a clock on air on that layer, but
    // nothing previewed, and the server never guesses.
    {
      name: 'refuses a layer with nothing previewed, naming the layer as the operator reads it',
      layerId: 'clock',
      slicesBefore: buildRaceDayWithInstances([
        buildGreenFlagClockOnProgram(),
        buildTeam42LowerThirdOnPreview(),
      ]),
      expectedError: {
        code: 'LAYER_PREVIEW_EMPTY',
        message: 'Não há nada em prévia na camada "Relógio" para colocar no ar.',
      },
    },
    // A layer nobody defined gets the refusal every other command gives for it.
    {
      name: 'refuses a layer that does not exist',
      layerId: 'placar',
      slicesBefore: buildRaceDayWithInstances([buildYellowFlagItemOnPreview()]),
      expectedError: { code: 'LAYER_NOT_FOUND', message: 'A camada "placar" não existe.' },
    },
    // The graphic left the register between the preview and the take: nothing may go on
    // air that the renderer could not load.
    {
      name: 'refuses a preview whose graphic is no longer registered',
      layerId: 'clock',
      slicesBefore: {
        ...buildRaceDayWithInstances([buildYellowFlagItemOnPreview()]),
        graphics: [],
      },
      expectedError: {
        code: 'GRAPHIC_NOT_FOUND',
        message: 'O gráfico "race-clock" não está registrado.',
      },
    },
    // The graphic's schema changed and now refuses the previewed data: the take is
    // checked like every take, so the old data does not go on air.
    {
      name: 'refuses a preview whose data the schema registered now does not accept',
      layerId: 'clock',
      slicesBefore: replaceRaceClockManifest(
        buildRaceDayWithInstances([buildYellowFlagItemOnPreview()]),
        manifestWithoutTheYellowFlag,
      ),
      expectedError: {
        code: 'INVALID_GRAPHIC_DATA',
        message:
          'Dados inválidos para o gráfico "race-clock": o campo "state" tem um valor que o gráfico não aceita.',
      },
    },
    // The stamp of the take goes through the same wall-clock check as every other stamp.
    {
      name: 'refuses a preview whose stamped field is no longer a wall-clock moment',
      layerId: 'clock',
      slicesBefore: replaceRaceClockManifest(
        buildRaceDayWithInstances([buildStartItemOnPreviewWithItsMomentStamped()]),
        manifestWithoutTheWallClockRole,
      ),
      expectedError: {
        code: 'INVALID_GRAPHIC_DATA',
        message:
          'O gráfico "race-clock" não aceita que o servidor preencha o campo "referenceWallClockMs" com o momento do comando: o manifesto do gráfico não marca esse campo como um horário (número inteiro com v_baja.role "wallClock").',
      },
    },
  ];

  it.each(refusedTakeScenarios)('$name', ({ layerId, slicesBefore, expectedError }) => {
    // Arrange: the slices of this row (see the table above).

    // Act: press "Tomar" for the layer of the row.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'takePreview', layerId },
      contextOfTheLaterTake,
    );

    // Assert: refused with the reason of the row. A refusal carries no new slices, so
    // the preview stays where it was and program is untouched.
    expect(outcome, 'the take must be refused with the reason of the row').toEqual({
      status: 'refused',
      error: expectedError,
    });
  });
});

describe('takePreview of a preview that came from no item', () => {
  it('is refused with INSTANCE_WITHOUT_ITEM, naming the layer, and changes nothing', () => {
    // Arrange: the green clock on air, and on the clock preview a red flag clock that
    // names no item, as only a damaged state could hold now.
    const previewWithoutItem: Instance = {
      ...buildYellowFlagItemOnPreview(),
      resolvedData: buildEnduroClockData('red'),
    };
    delete previewWithoutItem.itemId;
    const slicesBefore = buildRaceDayWithInstances([
      buildGreenFlagClockOnProgram(),
      previewWithoutItem,
    ]);
    const copyOfSlicesBefore = structuredClone(slicesBefore);

    // Act: press "Tomar" for the clock layer.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'takePreview', layerId: 'clock' },
      contextOfTheLaterTake,
    );

    // Assert: refused in pt-BR, naming the layer as the operator reads it, and the clock
    // on air and the preview are exactly as they were.
    expect(outcome, 'a preview with no item must never go on air').toEqual({
      status: 'refused',
      error: {
        code: 'INSTANCE_WITHOUT_ITEM',
        message:
          'A prévia da camada Relógio não veio de um item e não pode ir ao ar. Descarte-a e use um item.',
      },
    });
    expect(slicesBefore, 'a refused take must change nothing').toEqual(copyOfSlicesBefore);
  });
});
