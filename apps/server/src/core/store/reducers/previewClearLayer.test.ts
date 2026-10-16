/**
 * The previewClearLayer reducer: "Prévia: limpar" (apps/server)
 *
 * What this module is for:
 *   Prévia shows exactly what the screen will look like when the operator takes. To show
 *   a layer that the take will empty, the operator marks it "will be cleared" ("vai
 *   limpar") with previewClearLayer: the layer's id joins the `previewClearedLayerIds`
 *   slice, the preview page draws that layer empty, and any preview on the layer is
 *   thrown away (a preview and a marker on the same layer would say two things). Nothing
 *   on the program output changes until the take.
 *
 * What these tests prove:
 *   - The marker is added and the layer's preview removed; program, the other layers'
 *     previews and the rundowns are untouched.
 *   - A second marker joins the first, in the order they were made.
 *   - Marking a layer that is already marked and has no preview hands back the very same
 *     slices, so the store saves, logs and broadcasts nothing.
 *   - Marking a layer that has nothing on program is accepted (the marker then changes
 *     nothing at the take).
 *   - A layer that does not exist is refused with LAYER_NOT_FOUND.
 *
 * What these tests deliberately do not cover:
 *   - What the other commands do to a marker; previewClearedMarkersAndOtherCommands.test.ts.
 *   - The take of a marked layer; takeAllPreviews.test.ts and the file above.
 *   - That the marker is never saved; storeTakeAllPreviews.test.ts, on real SQLite.
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

describe('previewClearLayer that marks a layer', () => {
  const markScenarios = [
    // The common case: the lower third is on air and previewed; the operator wants to
    // see the screen without it, so its preview goes and the layer is marked.
    {
      name: 'adds the marker and removes the preview of that layer only',
      layerId: 'lower-third',
      markersBefore: [],
      expectedMarkers: ['lower-third'],
      expectedLayersAndOutputs: ['clock on program', 'clock on preview', 'lower-third on program'],
    },
    // A second layer marked after the first: both are kept, oldest first.
    {
      name: 'adds a second marker after the first one',
      layerId: 'clock',
      markersBefore: ['bug'],
      expectedMarkers: ['bug', 'clock'],
      expectedLayersAndOutputs: [
        'clock on program',
        'lower-third on program',
        'lower-third on preview',
      ],
    },
    // A layer with nothing on program may be marked too; the take then has nothing to
    // clear there. The server does not refuse it: the control page offers the button
    // only on rows with something on air, and a macro preview marks any clearLayer step.
    {
      name: 'marks a layer with nothing on program and changes no instance',
      layerId: 'ticker',
      markersBefore: [],
      expectedMarkers: ['ticker'],
      expectedLayersAndOutputs: [
        'clock on program',
        'clock on preview',
        'lower-third on program',
        'lower-third on preview',
      ],
    },
  ];

  it.each(markScenarios)(
    '$name',
    ({ layerId, markersBefore, expectedMarkers, expectedLayersAndOutputs }) => {
      // Arrange: two layers, each with something on air and something previewed, and the
      // markers of the row.
      const slicesBefore = buildRaceDaySlicesWithRundown({
        items: [buildYellowFlagItem(0)],
        instances: buildInstancesOnBothOutputsOfTwoLayers(),
        previewClearedLayerIds: markersBefore,
      });

      // Act: press "Prévia: limpar" on the layer of the row.
      const outcome = reduceCommand(
        slicesBefore,
        { type: 'previewClearLayer', layerId },
        contextOfTheRundownCommand,
      );

      // Assert: the markers and instances of the row, and the rundowns untouched.
      const slicesAfter = outcome.status === 'applied' ? outcome.slices : undefined;
      expect(slicesAfter?.previewClearedLayerIds, 'the layer must be marked').toEqual(
        expectedMarkers,
      );
      expect(
        readLayerAndOutputOfEachInstance(slicesAfter?.instances),
        'only the preview of the marked layer may go, and program must stay',
      ).toEqual(expectedLayersAndOutputs);
      expect(slicesAfter?.rundowns, 'marking a layer must not touch the rundowns').toBe(
        slicesBefore.rundowns,
      );
    },
  );
});

describe('previewClearLayer with nothing to change', () => {
  it('hands back the very same slices for a layer already marked and not previewed', () => {
    // Arrange: the lower third on air and already marked; nothing previewed there.
    const slicesBefore = buildRaceDaySlicesWithRundown({
      items: [],
      instances: [buildTeam42LowerThirdTakenByHand()],
      previewClearedLayerIds: ['lower-third'],
    });

    // Act: press "Prévia: limpar" on the lower third a second time.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'previewClearLayer', layerId: 'lower-third' },
      contextOfTheRundownCommand,
    );

    // Assert: accepted, with the very same slices, so nothing is saved, logged or sent.
    expect(outcome.status, 'marking twice is fine, not a mistake').toBe('applied');
    expect(
      outcome.status === 'applied' ? outcome.slices : undefined,
      'the very same slices must come back: no duplicate marker, no trace',
    ).toBe(slicesBefore);
  });
});

describe('previewClearLayer that must be refused', () => {
  it('refuses a layer that does not exist, changing nothing', () => {
    // Arrange: a stage with the lower third on air.
    const slicesBefore = buildRaceDaySlicesWithRundown({
      items: [],
      instances: [buildTeam42LowerThirdTakenByHand()],
    });

    // Act: mark a layer nobody defined.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'previewClearLayer', layerId: 'placar' },
      contextOfTheRundownCommand,
    );

    // Assert: refused in pt-BR with the code every layer command uses for this mistake.
    expect(outcome, 'a layer that does not exist must be refused').toEqual({
      status: 'refused',
      error: { code: 'LAYER_NOT_FOUND', message: 'A camada "placar" não existe.' },
    });
  });
});
