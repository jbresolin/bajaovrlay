/**
 * The "will be cleared" markers and the other commands (apps/server)
 *
 * What this module is for:
 *   A layer marked "will be cleared" (`previewClearedLayerIds`, set by previewClearLayer)
 *   is drawn empty on the Prévia monitor until something else is decided for it. These
 *   tests pin down what every older command does to a marker, so Prévia keeps showing
 *   exactly what the take will do:
 *   - a preview on the layer (previewItem, previewGraphic, a takeGraphic aimed at the
 *     preview output) replaces the marker, because the layer will then show that preview;
 *   - stopPreview throws the marker away with the preview, for one layer or for all;
 *   - clearLayer and clearAll take the marker off the layers they empty, because those
 *     layers are now as the marker promised (this is also what an auto-out does, since
 *     it sends clearLayer);
 *   - takePreview of a marked layer clears that layer's program output, as clearLayer
 *     would on program, and takes the marker off;
 *   - a take on the program output leaves the marker alone: the take still clears it.
 *
 * What these tests prove:
 *   - Each command of the table leaves exactly the markers and instances its row says.
 *   - takePreview of a marked layer with nothing on program takes the marker off and
 *     leaves the instances as the very same array.
 *   - takePreview of a layer with neither a preview nor a marker is still refused with
 *     LAYER_PREVIEW_EMPTY, also while another layer is marked.
 *
 * What these tests deliberately do not cover:
 *   - previewClearLayer itself; previewClearLayer.test.ts covers it.
 *   - takeAllPreviews and previewMacro; their own test files cover them.
 */
import type { CommandInput } from '@bajaovrlay/shared';
import { CommandSchema } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import {
  buildGreenFlagClockOnProgram,
  contextOfTheLaterTake,
  readLayerAndOutputOfEachInstance,
} from './previewSlices.testSupport.js';
import { reduceCommand } from './reduceCommand.js';
import {
  buildRaceDaySlicesWithRundown,
  buildTeam42LowerThirdTakenByHand,
  buildYellowFlagItem,
} from './rundownSlices.testSupport.js';

/**
 * Builds the stage of these tests: the green clock and the lower third of team 42 on
 * air, nothing previewed, and both layers marked "will be cleared".
 */
function buildStageWithBothLayersOnAirAndMarked() {
  return buildRaceDaySlicesWithRundown({
    items: [buildYellowFlagItem(0)],
    instances: [buildGreenFlagClockOnProgram(), buildTeam42LowerThirdTakenByHand()],
    previewClearedLayerIds: ['clock', 'lower-third'],
  });
}

const markerScenarios: Array<{
  name: string;
  command: CommandInput;
  expectedMarkers: string[];
  expectedLayersAndOutputs: string[];
}> = [
  // A row's "Prévia" on the clock layer: the layer will show the yellow flag, not nothing.
  {
    name: 'previewItem takes the marker off its own layer only',
    command: { type: 'previewItem', itemId: 'item-bandeira-amarela' },
    expectedMarkers: ['lower-third'],
    expectedLayersAndOutputs: ['clock on program', 'lower-third on program', 'clock on preview'],
  },
  // "Prévia" in "Edição rápida" on the lower third layer.
  {
    name: 'previewGraphic takes the marker off its own layer only',
    command: {
      type: 'previewGraphic',
      graphicId: 'team-lower-third',
      layerId: 'lower-third',
      data: { teamNumber: 7, teamName: 'Mangue Baja' },
    },
    expectedMarkers: ['clock'],
    expectedLayersAndOutputs: [
      'clock on program',
      'lower-third on program',
      'lower-third on preview',
    ],
  },
  // The older way of previewing by hand ends in the same place, so it does the same.
  {
    name: 'a takeGraphic aimed at the preview output takes the marker off its layer',
    command: {
      type: 'takeGraphic',
      graphicId: 'team-lower-third',
      layerId: 'lower-third',
      data: { teamNumber: 7, teamName: 'Mangue Baja' },
      target: 'preview',
    },
    expectedMarkers: ['clock'],
    expectedLayersAndOutputs: [
      'clock on program',
      'lower-third on program',
      'lower-third on preview',
    ],
  },
  // A take on program does not change what the next take will do to the layer.
  {
    name: 'a takeGraphic on the program output leaves the marker of its layer',
    command: {
      type: 'takeGraphic',
      graphicId: 'team-lower-third',
      layerId: 'lower-third',
      data: { teamNumber: 7, teamName: 'Mangue Baja' },
    },
    expectedMarkers: ['clock', 'lower-third'],
    expectedLayersAndOutputs: ['clock on program', 'lower-third on program'],
  },
  // "Descartar" on the clock line under Prévia: the marker is what is discarded.
  {
    name: 'stopPreview of one layer takes that layer’s marker off',
    command: { type: 'stopPreview', layerId: 'clock' },
    expectedMarkers: ['lower-third'],
    expectedLayersAndOutputs: ['clock on program', 'lower-third on program'],
  },
  // "Descartar tudo": every marker goes, and program stays.
  {
    name: 'stopPreview of every layer takes every marker off',
    command: { type: 'stopPreview', layerId: null },
    expectedMarkers: [],
    expectedLayersAndOutputs: ['clock on program', 'lower-third on program'],
  },
  // "Limpar" on the clock row: the clock layer is now empty, as the marker promised.
  {
    name: 'clearLayer takes the marker off the layer it empties',
    command: { type: 'clearLayer', layerId: 'clock' },
    expectedMarkers: ['lower-third'],
    expectedLayersAndOutputs: ['lower-third on program'],
  },
  // The panic button empties both outputs of every layer, so no marker is left to keep.
  {
    name: 'clearAll takes every marker off',
    command: { type: 'clearAll' },
    expectedMarkers: [],
    expectedLayersAndOutputs: [],
  },
  // "Tomar" on a "vai limpar" line: the clock goes off air and the marker with it.
  {
    name: 'takePreview of a marked layer clears that layer’s program and its marker',
    command: { type: 'takePreview', layerId: 'clock' },
    expectedMarkers: ['lower-third'],
    expectedLayersAndOutputs: ['lower-third on program'],
  },
];

describe('the markers after each older command', () => {
  it.each(markerScenarios)('$name', ({ command, expectedMarkers, expectedLayersAndOutputs }) => {
    // Arrange: the clock and the lower third on air, both marked "will be cleared".
    const slicesBefore = buildStageWithBothLayersOnAirAndMarked();
    const validCommand = CommandSchema.parse(command);

    // Act: run the command of the row at 14:47:30.250.
    const outcome = reduceCommand(slicesBefore, validCommand, contextOfTheLaterTake);

    // Assert: the markers and instances of the row.
    const slicesAfter = outcome.status === 'applied' ? outcome.slices : undefined;
    expect(outcome.status, 'the command must be accepted').toBe('applied');
    expect(slicesAfter?.previewClearedLayerIds, 'the markers must be as the row says').toEqual(
      expectedMarkers,
    );
    expect(
      readLayerAndOutputOfEachInstance(slicesAfter?.instances),
      'the instances must be as the row says',
    ).toEqual(expectedLayersAndOutputs);
  });
});

describe('takePreview of a marked layer with nothing on program', () => {
  it('takes the marker off and leaves the instances as the very same array', () => {
    // Arrange: the ticker layer marked, with nothing on air there; the clock on air.
    const slicesBefore = buildRaceDaySlicesWithRundown({
      items: [],
      instances: [buildGreenFlagClockOnProgram()],
      previewClearedLayerIds: ['ticker'],
    });

    // Act: press "Tomar" on the ticker's "vai limpar" line.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'takePreview', layerId: 'ticker' },
      contextOfTheLaterTake,
    );

    // Assert: the marker is gone, and the instances were not rebuilt (nothing to clear).
    const slicesAfter = outcome.status === 'applied' ? outcome.slices : undefined;
    expect(slicesAfter?.previewClearedLayerIds, 'the marker must be taken off').toEqual([]);
    expect(slicesAfter?.instances, 'with nothing to clear the instances must not change').toBe(
      slicesBefore.instances,
    );
  });
});

describe('takePreview of a layer with neither a preview nor a marker', () => {
  it('is still refused with LAYER_PREVIEW_EMPTY while another layer is marked', () => {
    // Arrange: the clock on air and not marked; only the lower third layer is marked.
    const slicesBefore = buildRaceDaySlicesWithRundown({
      items: [],
      instances: [buildGreenFlagClockOnProgram()],
      previewClearedLayerIds: ['lower-third'],
    });

    // Act: press "Tomar" for the clock layer.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'takePreview', layerId: 'clock' },
      contextOfTheLaterTake,
    );

    // Assert: refused, naming the layer; a marker elsewhere never counts for this layer.
    expect(outcome, 'a layer with nothing in Prévia must be refused').toEqual({
      status: 'refused',
      error: {
        code: 'LAYER_PREVIEW_EMPTY',
        message: 'Não há nada em prévia na camada "Relógio" para colocar no ar.',
      },
    });
  });
});
