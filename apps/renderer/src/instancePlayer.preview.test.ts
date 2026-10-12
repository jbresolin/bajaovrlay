// @vitest-environment jsdom
/**
 * The preview page from slice to graphic: reconciler and player together (apps/renderer)
 *
 * What this module is for:
 *   The page the control page frames as "Prévia" (`/render/?target=preview&monitor=1`) is
 *   the ordinary renderer with two settings changed in renderer.ts: its reconciler is told
 *   to draw the `preview` output, and its player is given no way to report to the server.
 *   There is no second player and no second set of rules. These tests put those two
 *   settings together exactly as renderer.ts does and watch what the graphics are asked
 *   to do.
 *
 * What these tests prove, for the reconciler drawing `preview` feeding a player with no
 * reporter:
 *   - A slice holding one clock on air and another being rehearsed, both on the clock
 *     layer, puts only the rehearsed one on the stage.
 *   - A second rehearsal on an occupied layer swaps in at once: the new graphic is loaded
 *     behind the old one, then the old one is stopped and the new one played, both with
 *     the animation skipped. This holds on the clock layer, whose own policy is
 *     out-then-in, and on the lower-third layer, whose policy is cut.
 *   - Nowhere does the player trip over the reporter it was not given.
 *
 * What these tests deliberately do not cover:
 *   - Each decision of the reconciler on its own; instanceReconciler.preview.test.ts.
 *   - A player without a reporter when graphics fail; instancePlayer.noReporter.test.ts.
 *   - That renderer.ts really wires the page this way and that nothing reaches the
 *     server; e2e/previewPage.e2e.ts opens the real page and listens on its WebSocket.
 */
import type { Instance } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { decideLayerOperations } from './instanceReconciler.js';
import {
  createEnduroClockInstance,
  createFinalClockInstance,
  createTeamLowerThirdInstance,
  feiLowerThirdInstanceId,
  finalClockInstanceId,
  layersOfTheStream,
  ufprLowerThirdInstanceId,
} from './instancesOnAir.testSupport.js';
import {
  createStageWithPlayerThatHasNoStatusReporter,
  graphicsOfTheStream,
  readInstanceIdsOnLayer,
  readVisibilityOfElementsOnLayer,
  waitForQueuedOperations,
} from './stageWithPlayer.testSupport.js';

/** Builds the same instance as a rehearsal: on the preview output instead of on air. */
function createRehearsalOf(instance: Instance): Instance {
  return { ...instance, target: 'preview' };
}

/**
 * Builds the stage of a preview page and a function that delivers an `instances` slice to
 * it the way renderer.ts does: the reconciler, drawing `preview`, decides, and the player
 * with no reporter carries out. The slice delivered last is kept only inside this object.
 */
function createPreviewPageStage() {
  const { stage, instancePlayer, recording, logLines } =
    createStageWithPlayerThatHasNoStatusReporter();
  let instancesOfLastDelivery: Instance[] = [];

  async function deliverInstancesSlice(instances: Instance[]): Promise<void> {
    const layerOperations = decideLayerOperations({
      previousInstances: instancesOfLastDelivery,
      nextInstances: instances,
      layers: layersOfTheStream,
      drawnOutput: 'preview',
    });
    instancePlayer.runLayerOperations(layerOperations, graphicsOfTheStream);
    instancesOfLastDelivery = instances;
    await waitForQueuedOperations();
  }

  return { stage, recording, logLines, deliverInstancesSlice };
}

describe('a preview page: the reconciler drawing preview with a player that reports nothing', () => {
  it('puts only the rehearsed clock on the stage when another clock is on air on the same layer', async () => {
    // Arrange: the stage of a preview page with nothing on it.
    const { stage, recording, logLines, deliverInstancesSlice } = createPreviewPageStage();

    // Act: the server lists the enduro clock on air and the final clock being rehearsed.
    await deliverInstancesSlice([
      createEnduroClockInstance(),
      createRehearsalOf(createFinalClockInstance()),
    ]);

    // Assert: only the rehearsed final clock was loaded and played, and the player did
    // not stumble where the program page would have reported on-air.
    expect(
      recording.lifecycleCalls,
      'only the rehearsed clock must be loaded and played; the one on air is not for this page',
    ).toEqual(['Final: load', 'Final: playAction']);
    expect(
      readInstanceIdsOnLayer(stage, 'clock'),
      'only the rehearsed clock must be on the clock layer of the preview page',
    ).toEqual([finalClockInstanceId]);
    expect(
      logLines.filter((line) => line.message === 'renderer operation failed unexpectedly'),
      'having nobody to report to must not count as a failure of the renderer',
    ).toEqual([]);
  });

  const replaceOnPreviewScenarios = [
    // The clock layer animates out-then-in on air; on the preview page it must not.
    {
      name: 'swaps at once on the clock layer, whose own policy is out-then-in',
      layerId: 'clock',
      firstRehearsal: createRehearsalOf(createEnduroClockInstance()),
      secondRehearsal: createRehearsalOf(createFinalClockInstance()),
      expectedCallsOfTheReplace: [
        'Final: load',
        'Enduro: stopAction (skipAnimation)',
        'Enduro: dispose',
        'Final: playAction (skipAnimation)',
      ],
      expectedLayerAfterwards: ['Final: visible'],
    },
    // The lower-third layer cuts on air too: the preview page behaves the same there.
    {
      name: 'swaps at once on the lower-third layer, whose own policy is cut',
      layerId: 'lower-third',
      firstRehearsal: createRehearsalOf(
        createTeamLowerThirdInstance(ufprLowerThirdInstanceId, 42, 'Baja UFPR'),
      ),
      secondRehearsal: createRehearsalOf(
        createTeamLowerThirdInstance(feiLowerThirdInstanceId, 7, 'FEI Baja'),
      ),
      expectedCallsOfTheReplace: [
        'FEI: load',
        'UFPR: stopAction (skipAnimation)',
        'UFPR: dispose',
        'FEI: playAction (skipAnimation)',
      ],
      expectedLayerAfterwards: ['FEI: visible'],
    },
  ];

  it.each(replaceOnPreviewScenarios)('$name', async (scenario) => {
    // Arrange: a preview page already showing the first rehearsal of the row.
    const { stage, recording, deliverInstancesSlice } = createPreviewPageStage();
    await deliverInstancesSlice([scenario.firstRehearsal]);
    const numberOfCallsBeforeTheReplace = recording.lifecycleCalls.length;

    // Act: the operator previews the next item on the same layer.
    await deliverInstancesSlice([scenario.secondRehearsal]);

    // Assert: the new graphic was loaded first, then the old one stopped and the new one
    // played, both without animation, and only the new one is left, visible.
    expect(
      recording.lifecycleCalls.slice(numberOfCallsBeforeTheReplace),
      'a replace on the preview page must skip both animations, whatever the layer policy',
    ).toEqual(scenario.expectedCallsOfTheReplace);
    expect(
      readVisibilityOfElementsOnLayer(stage, scenario.layerId),
      'only the new rehearsal may be left on the layer, and it must be visible',
    ).toEqual(scenario.expectedLayerAfterwards);
  });
});
