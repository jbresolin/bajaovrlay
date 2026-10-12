/**
 * The commands that existed before the preview, meeting a preview instance (apps/server)
 *
 * What this module is for:
 *   clearLayer, clearAll, updateInstanceData and reportInstanceStatus were written when
 *   nothing created preview instances yet. Now previewItem and previewGraphic do, so this
 *   file writes down what each of the four older commands does when it meets one. None
 *   of the four was changed for the preview; these tests keep it that way.
 *
 * What these tests prove:
 *   - clearLayer removes what is on a layer on BOTH outputs, the preview included, and
 *     clearAll removes every instance on both outputs (the panic button empties the
 *     Prévia monitor too).
 *   - updateInstanceData may be sent for a preview instance: the data changes in place,
 *     and the instance stays on the preview output with its id and its list of stamped
 *     fields.
 *   - reportInstanceStatus about a preview instance is applied like any other report. A
 *     renderer page in preview mode never sends one, so this happens only if some other
 *     renderer does; the reducer does not tell the two outputs apart.
 *
 * What these tests deliberately do not cover:
 *   - The same commands on the program output; reduceCommand.test.ts,
 *     updateInstanceData.test.ts and reportInstanceStatus.test.ts cover them.
 *   - stopPreview, the command made for emptying a preview; stopPreview.test.ts.
 */
import { describe, expect, it } from 'vitest';

import {
  buildGreenFlagClockOnProgram,
  buildStartItemOnPreviewWithItsMomentStamped,
  buildTeam42LowerThirdOnPreview,
  buildYellowFlagItemOnPreview,
  readLayerAndOutputOfEachInstance,
} from './previewSlices.testSupport.js';
import { reduceCommand } from './reduceCommand.js';
import {
  buildEnduroStartItem,
  buildRaceDaySlicesWithTheRaceClockSchema,
  buildTeam42LowerThirdTakenByHand,
  buildYellowFlagItem,
  contextOfTheRundownCommand,
} from './rundownSlices.testSupport.js';

describe('the clear commands and the preview output', () => {
  const clearScenarios = [
    // clearLayer names a layer, not an output: the clock leaves program and preview alike.
    {
      name: 'clearLayer removes the program instance and the preview of that layer',
      command: { type: 'clearLayer' as const, layerId: 'clock' },
      expectedLayersAndOutputs: ['lower-third on program', 'lower-third on preview'],
    },
    // The panic button: nothing stays anywhere, the Prévia monitor included.
    {
      name: 'clearAll removes every instance on both outputs',
      command: { type: 'clearAll' as const },
      expectedLayersAndOutputs: [],
    },
  ];

  it.each(clearScenarios)('$name', ({ command, expectedLayersAndOutputs }) => {
    // Arrange: two layers, each with something on air and something previewed.
    const slicesBefore = buildRaceDaySlicesWithTheRaceClockSchema({
      items: [buildYellowFlagItem(0)],
      instances: [
        buildGreenFlagClockOnProgram(),
        buildYellowFlagItemOnPreview(),
        buildTeam42LowerThirdTakenByHand(),
        buildTeam42LowerThirdOnPreview(),
      ],
    });

    // Act: send the clear of this row.
    const outcome = reduceCommand(slicesBefore, command, contextOfTheRundownCommand);

    // Assert: exactly the instances of the row remain.
    const instancesAfter = outcome.status === 'applied' ? outcome.slices.instances : undefined;
    expect(
      readLayerAndOutputOfEachInstance(instancesAfter),
      'a clear must remove previews as well as what is on air',
    ).toEqual(expectedLayersAndOutputs);
  });
});

describe('updateInstanceData for a preview instance', () => {
  it('changes the data in place and keeps the output, the id and the list of stamped fields', () => {
    // Arrange: the start item previewed, with its reference moment stamped at the preview.
    const previewBefore = buildStartItemOnPreviewWithItsMomentStamped();
    const slicesBefore = buildRaceDaySlicesWithTheRaceClockSchema({
      items: [buildEnduroStartItem(0)],
      instances: [previewBefore],
    });

    // Act: change only the flag of the previewed clock to yellow.
    const outcome = reduceCommand(
      slicesBefore,
      {
        type: 'updateInstanceData',
        instanceId: previewBefore.id,
        data: { state: 'yellow' },
        takeTimeFieldKeys: [],
      },
      contextOfTheRundownCommand,
    );

    // Assert: the same instance with the new flag; still a preview, still remembering
    // which field the take must stamp.
    const instancesAfter = outcome.status === 'applied' ? outcome.slices.instances : undefined;
    expect(instancesAfter, 'only the flag of the preview may change').toEqual([
      { ...previewBefore, resolvedData: { ...previewBefore.resolvedData, state: 'yellow' } },
    ]);
  });
});

describe('reportInstanceStatus about a preview instance', () => {
  it('moves a loading preview instance to on-air, as it does for any instance', () => {
    // Arrange: the yellow flag item previewed and still `loading`.
    const previewBefore = buildYellowFlagItemOnPreview();
    const slicesBefore = buildRaceDaySlicesWithTheRaceClockSchema({
      items: [buildYellowFlagItem(0)],
      instances: [previewBefore],
    });

    // Act: some renderer reports that instance on air.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'reportInstanceStatus', instanceId: previewBefore.id, status: 'on-air' },
      contextOfTheRundownCommand,
    );

    // Assert: the report is applied; the instance is still on the preview output.
    const instancesAfter = outcome.status === 'applied' ? outcome.slices.instances : undefined;
    expect(instancesAfter, 'the report must be applied to the preview instance').toEqual([
      { ...previewBefore, status: 'on-air' },
    ]);
  });
});
