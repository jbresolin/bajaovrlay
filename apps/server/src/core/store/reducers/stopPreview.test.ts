/**
 * The stopPreview reducer (apps/server)
 *
 * What this module is for:
 *   stopPreview throws away what is on the PREVIEW output: of one layer ("Descartar"
 *   under the Prévia monitor) or of every layer at once (`layerId: null`). It never
 *   touches the program output.
 *
 * What these tests prove:
 *   - Naming a layer removes the preview of that layer only.
 *   - `null` removes every preview, on every layer.
 *   - Whatever is on the program output stays, on the same layer too.
 *   - Stopping where nothing is previewed hands back the very same slices, so the store
 *     saves nothing, writes no event-log row and broadcasts nothing.
 *   - A layer that does not exist is refused, as clearLayer refuses it.
 *
 * What these tests deliberately do not cover:
 *   - clearLayer and clearAll, which remove previews too; previewAndOlderCommands.test.ts.
 *   - The "leaves no trace" rule through the real store; storePreviewCommands.test.ts.
 */
import type { Instance } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import {
  buildGreenFlagClockOnProgram,
  buildTeam42LowerThirdOnPreview,
  buildYellowFlagItemOnPreview,
  readLayerAndOutputOfEachInstance,
} from './previewSlices.testSupport.js';
import { reduceCommand } from './reduceCommand.js';
import {
  buildRaceDaySlicesWithRundown,
  buildTeam42LowerThirdTakenByHand,
  buildYellowFlagItem,
  contextOfTheRundownCommand,
} from './rundownSlices.testSupport.js';

/**
 * Builds a busy stage: the green clock and a lower third on air, and on the preview
 * output the yellow flag item (clock layer) and another lower third (its own layer).
 */
function buildInstancesOnBothOutputsOfTwoLayers(): Instance[] {
  return [
    buildGreenFlagClockOnProgram(),
    buildYellowFlagItemOnPreview(),
    buildTeam42LowerThirdTakenByHand(),
    buildTeam42LowerThirdOnPreview(),
  ];
}

describe('stopPreview that removes something', () => {
  const stopScenarios = [
    // "Descartar" under the Prévia monitor: only the clock layer's preview goes.
    {
      name: 'removes the preview of the named layer and nothing else',
      layerId: 'clock',
      expectedLayersAndOutputs: [
        'clock on program',
        'lower-third on program',
        'lower-third on preview',
      ],
    },
    // The same for the other layer, to show the layer id is what decides.
    {
      name: 'removes the preview of the lower third when that layer is named',
      layerId: 'lower-third',
      expectedLayersAndOutputs: ['clock on program', 'clock on preview', 'lower-third on program'],
    },
    // Every preview at once; both program instances stay on air.
    {
      name: 'removes every preview when the layer is null, and leaves program alone',
      layerId: null,
      expectedLayersAndOutputs: ['clock on program', 'lower-third on program'],
    },
  ];

  it.each(stopScenarios)('$name', ({ layerId, expectedLayersAndOutputs }) => {
    // Arrange: two layers, each with something on air and something previewed.
    const slicesBefore = buildRaceDaySlicesWithRundown({
      items: [buildYellowFlagItem(0)],
      instances: buildInstancesOnBothOutputsOfTwoLayers(),
    });

    // Act: stop the preview as the row says.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'stopPreview', layerId },
      contextOfTheRundownCommand,
    );

    // Assert: exactly the instances of the row remain, and the rundown was not touched.
    const slicesAfter = outcome.status === 'applied' ? outcome.slices : undefined;
    expect(
      readLayerAndOutputOfEachInstance(slicesAfter?.instances),
      'only the previews the command names may be removed',
    ).toEqual(expectedLayersAndOutputs);
    expect(slicesAfter?.rundowns, 'stopping a preview must not touch the rundowns').toBe(
      slicesBefore.rundowns,
    );
  });
});

describe('stopPreview where nothing is previewed', () => {
  const nothingToStopScenarios = [
    // "Descartar" pressed twice: the second press finds the layer's preview already gone.
    {
      name: 'changes nothing for a layer that has only a program instance',
      layerId: 'clock',
      instances: [buildGreenFlagClockOnProgram(), buildTeam42LowerThirdOnPreview()],
    },
    // An empty layer is as good a target as any; nothing happens.
    {
      name: 'changes nothing for a layer with nothing on either output',
      layerId: 'ticker',
      instances: [buildGreenFlagClockOnProgram()],
    },
    // "Stop every preview" with no preview anywhere.
    {
      name: 'changes nothing for every layer when no layer has a preview',
      layerId: null,
      instances: [buildGreenFlagClockOnProgram(), buildTeam42LowerThirdTakenByHand()],
    },
  ];

  it.each(nothingToStopScenarios)('$name', ({ layerId, instances }) => {
    // Arrange: the stage of this row.
    const slicesBefore = buildRaceDaySlicesWithRundown({ items: [], instances });

    // Act: stop the preview as the row says.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'stopPreview', layerId },
      contextOfTheRundownCommand,
    );

    // Assert: accepted, with the very same slices handed back; that is how the store
    // knows there is nothing to save, log or broadcast.
    expect(outcome.status, 'stopping nothing is fine, not a mistake').toBe('applied');
    expect(
      outcome.status === 'applied' ? outcome.slices : undefined,
      'the very same slices must come back when nothing was previewed',
    ).toBe(slicesBefore);
  });
});

describe('stopPreview that must be refused', () => {
  it('refuses a layer that does not exist', () => {
    // Arrange: a stage with the yellow flag previewed on the clock layer.
    const slicesBefore = buildRaceDaySlicesWithRundown({
      items: [buildYellowFlagItem(0)],
      instances: [buildYellowFlagItemOnPreview()],
    });

    // Act: stop the preview of a layer nobody defined.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'stopPreview', layerId: 'placar' },
      contextOfTheRundownCommand,
    );

    // Assert: refused in pt-BR with the code clearLayer uses for the same mistake.
    expect(outcome, 'a layer that does not exist must be refused').toEqual({
      status: 'refused',
      error: { code: 'LAYER_NOT_FOUND', message: 'A camada "placar" não existe.' },
    });
  });
});
