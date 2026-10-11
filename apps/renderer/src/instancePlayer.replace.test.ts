// @vitest-environment jsdom
/**
 * Replacing the graphic on a layer (apps/renderer)
 *
 * What this module is for:
 *   When the operator takes a graphic on a layer that already has one, the layer's replace
 *   policy says how the swap looks. `out-then-in` animates the old graphic out and only
 *   then brings the new one in, so the layer is empty in between, by design. `cut` is an
 *   instant swap: the new graphic is loaded behind the old one, hidden, and only when it is
 *   ready does the old one leave, so the viewer never sees an empty layer while a graphic
 *   loads. `crossfade` is carried out as a cut for now.
 *
 * What these tests prove:
 *   - `out-then-in` stops and disposes the old graphic before it loads and plays the new
 *     one, with both animations.
 *   - `cut` loads the new graphic first, then stops and disposes the old one, then plays
 *     the new one; the stop and the play both skip their animation. `crossfade` does
 *     exactly the same.
 *   - While the new graphic of a cut is still loading, the old one is still on the layer
 *     and visible, and the new one is on the layer but hidden; afterwards only the new one
 *     is left, and it is visible.
 *   - A cut whose new graphic fails to load still takes the old graphic off the layer,
 *     because the server says it is no longer on air. The same holds when it is the
 *     renderer itself that throws while loading the new graphic, and the new graphic is
 *     then reported failed.
 *
 * What these tests deliberately do not cover:
 *   - The same swap in a real browser, frame by frame; e2e/replaceWithCut.e2e.ts.
 *   - What the player reports to the server; instancePlayer.status.test.ts.
 *   - A real crossfade, with both graphics visible at once: no graphic is built for it
 *     yet and no seeded layer uses that policy.
 */
import { describe, expect, it } from 'vitest';

import {
  createEnduroClockInstance,
  createFinalClockInstance,
  createTeamLowerThirdInstance,
  enduroClockInstanceId,
  finalClockInstanceId,
  ufprLowerThirdInstanceId,
} from './instancesOnAir.testSupport.js';
import {
  createFinalClockWhoseLoad,
  createFinalScoreboardInstance,
  createStageWhoseFinalScoreboardCannotBeCreated,
  createStageWithPlayer,
  createTakeOf,
  finalScoreboardInstanceId,
  graphicsOfTheStream,
  graphicsWithTheFinalScoreboard,
  readInstanceIdsOnLayer,
  readVisibilityOfElementsOnLayer,
  waitForQueuedOperations,
} from './stageWithPlayer.testSupport.js';

describe('replacing the graphic on a layer', () => {
  const callsOfAnOutThenInReplace = [
    'Enduro: stopAction',
    'Enduro: dispose',
    'Final: load',
    'Final: playAction',
  ];
  const callsOfACut = [
    'Final: load',
    'Enduro: stopAction (skipAnimation)',
    'Enduro: dispose',
    'Final: playAction (skipAnimation)',
  ];
  const replacePolicyScenarios = [
    // The default of every seeded layer: the old clock animates out, the new one in.
    {
      name: 'out-then-in stops and disposes the old graphic, then loads and plays the new one',
      replacePolicy: 'out-then-in' as const,
      expectedCalls: callsOfAnOutThenInReplace,
    },
    // A cut is instant, and the layer must never be empty: the new graphic is loaded
    // before the old one is touched, and neither animation is shown.
    {
      name: 'cut loads the new graphic before it stops and disposes the old one',
      replacePolicy: 'cut' as const,
      expectedCalls: callsOfACut,
    },
    // No graphic can share its layer yet, so a crossfade is carried out as a cut for now.
    {
      name: 'crossfade is carried out exactly like cut',
      replacePolicy: 'crossfade' as const,
      expectedCalls: callsOfACut,
    },
  ];

  it.each(replacePolicyScenarios)('$name', async ({ replacePolicy, expectedCalls }) => {
    // Arrange: the enduro clock on air, and the number of calls it took to get there.
    const { stage, instancePlayer, recording } = createStageWithPlayer();
    instancePlayer.runLayerOperations(
      createTakeOf(createEnduroClockInstance()),
      graphicsOfTheStream,
    );
    await waitForQueuedOperations();
    const numberOfCallsBeforeTheReplace = recording.lifecycleCalls.length;

    // Act: the clock of the final heat is taken on the same layer, with the row's policy.
    const replaceOfTheClock = {
      kind: 'replace' as const,
      outgoingInstanceId: enduroClockInstanceId,
      incomingInstance: createFinalClockInstance(),
      replacePolicy,
    };
    instancePlayer.runLayerOperations(
      [{ layerId: 'clock', operations: [replaceOfTheClock] }],
      graphicsOfTheStream,
    );
    await waitForQueuedOperations();

    // Assert: the calls came in the order and with the animations the policy asks for,
    // and only the new clock is left on the layer, visible.
    expect(
      recording.lifecycleCalls.slice(numberOfCallsBeforeTheReplace),
      'the calls of the replace must come in the order this policy asks for',
    ).toEqual(expectedCalls);
    expect(
      readInstanceIdsOnLayer(stage, 'clock'),
      'only the new clock may be left on the layer',
    ).toEqual([finalClockInstanceId]);
    expect(
      readVisibilityOfElementsOnLayer(stage, 'clock'),
      'the new clock must be visible once the replace is over',
    ).toEqual(['Final: visible']);
  });
});

describe('a cut while the new graphic is still loading', () => {
  it('keeps the old graphic visible and the new one hidden until the new one is loaded', async () => {
    // Arrange: the enduro clock on air, and a clock of the final heat whose load will not
    // finish until the test says so, like a graphic waiting for its fonts.
    const { stage, instancePlayer, recording } = createStageWithPlayer();
    instancePlayer.runLayerOperations(
      createTakeOf(createEnduroClockInstance()),
      graphicsOfTheStream,
    );
    await waitForQueuedOperations();
    const cutToTheSlowFinalClock = {
      kind: 'replace' as const,
      outgoingInstanceId: enduroClockInstanceId,
      incomingInstance: createFinalClockWhoseLoad('waits-to-be-released'),
      replacePolicy: 'cut' as const,
    };

    // Act: the cut is asked for; the test looks at the layer while the new clock is still
    // loading, then lets the load finish and looks again.
    instancePlayer.runLayerOperations(
      [{ layerId: 'clock', operations: [cutToTheSlowFinalClock] }],
      graphicsOfTheStream,
    );
    await waitForQueuedOperations();
    const callsWhileTheNewClockLoads = [...recording.lifecycleCalls];
    const layerWhileTheNewClockLoads = readVisibilityOfElementsOnLayer(stage, 'clock');
    recording.releaseLoadsThatWait();
    await waitForQueuedOperations();

    // Assert: during the load the old clock had not been touched and was the one the
    // viewer saw; afterwards the new clock is alone on the layer and visible.
    expect(
      callsWhileTheNewClockLoads,
      'the old clock must not be stopped or disposed while the new one is still loading',
    ).toEqual(['Enduro: load', 'Enduro: playAction', 'Final: load']);
    expect(
      layerWhileTheNewClockLoads,
      'while the new clock loads, the old one must stay visible and the new one hidden',
    ).toEqual(['Enduro: visible', 'Final: hidden']);
    expect(
      readVisibilityOfElementsOnLayer(stage, 'clock'),
      'after the cut only the new clock may be on the layer, and it must be visible',
    ).toEqual(['Final: visible']);
  });

  it('still takes the old graphic off the layer when the new one fails to load', async () => {
    // Arrange: the enduro clock on air, and a clock of the final heat whose load throws.
    const { stage, instancePlayer, recording } = createStageWithPlayer();
    instancePlayer.runLayerOperations(
      createTakeOf(createEnduroClockInstance()),
      graphicsOfTheStream,
    );
    await waitForQueuedOperations();
    const numberOfCallsBeforeTheCut = recording.lifecycleCalls.length;
    const cutToTheBrokenFinalClock = {
      kind: 'replace' as const,
      outgoingInstanceId: enduroClockInstanceId,
      incomingInstance: createFinalClockWhoseLoad('rejects'),
      replacePolicy: 'cut' as const,
    };

    // Act: the cut is asked for.
    instancePlayer.runLayerOperations(
      [{ layerId: 'clock', operations: [cutToTheBrokenFinalClock] }],
      graphicsOfTheStream,
    );
    await waitForQueuedOperations();

    // Assert: the old clock was stopped and disposed even though nothing replaces it,
    // the broken clock was never played, and the layer is empty.
    expect(
      recording.lifecycleCalls.slice(numberOfCallsBeforeTheCut),
      'the old clock must leave the air, and the clock that failed to load must not be played',
    ).toEqual(['Final: load', 'Enduro: stopAction (skipAnimation)', 'Enduro: dispose']);
    expect(
      readInstanceIdsOnLayer(stage, 'clock'),
      'the layer must be empty: the server no longer lists the old clock and the new one failed',
    ).toEqual([]);
  });

  it('still takes the old graphic off the layer when the renderer itself throws while loading the new one', async () => {
    // Arrange: team 42's lower third on air, on a stage where the element of the final
    // scoreboard cannot be created (its tag has a space in it), so loading it throws
    // inside the renderer instead of failing inside the graphic.
    const { stage, instancePlayer, recording, statusReports } =
      createStageWhoseFinalScoreboardCannotBeCreated();
    instancePlayer.runLayerOperations(
      createTakeOf(createTeamLowerThirdInstance(ufprLowerThirdInstanceId, 42, 'Baja UFPR')),
      graphicsWithTheFinalScoreboard,
    );
    await waitForQueuedOperations();
    const numberOfCallsBeforeTheCut = recording.lifecycleCalls.length;
    const numberOfReportsBeforeTheCut = statusReports.length;
    const cutToTheScoreboardThatCannotBeCreated = {
      kind: 'replace' as const,
      outgoingInstanceId: ufprLowerThirdInstanceId,
      incomingInstance: createFinalScoreboardInstance(),
      replacePolicy: 'cut' as const,
    };

    // Act: the cut is asked for.
    instancePlayer.runLayerOperations(
      [{ layerId: 'lower-third', operations: [cutToTheScoreboardThatCannotBeCreated] }],
      graphicsWithTheFinalScoreboard,
    );
    await waitForQueuedOperations();

    // Assert: the lower third left the air all the same, the layer is empty, and the
    // server is told the scoreboard failed.
    expect(
      recording.lifecycleCalls.slice(numberOfCallsBeforeTheCut),
      'the old lower third must be stopped and disposed: the server no longer lists it',
    ).toEqual(['UFPR: stopAction (skipAnimation)', 'UFPR: dispose']);
    expect(
      readInstanceIdsOnLayer(stage, 'lower-third'),
      'the layer must be empty: the old graphic is off air and the new one never existed',
    ).toEqual([]);
    expect(
      statusReports.slice(numberOfReportsBeforeTheCut),
      'the scoreboard must be reported failed, once, with the reason',
    ).toEqual([
      {
        type: 'instanceStatus',
        instanceId: finalScoreboardInstanceId,
        status: 'failed',
        detail: expect.stringContaining('the renderer failed unexpectedly'),
      },
    ]);
  });
});
