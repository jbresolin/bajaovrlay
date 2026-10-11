// @vitest-environment jsdom
/**
 * Carrying out the operations on the stage (apps/renderer)
 *
 * What this module is for:
 *   instanceReconciler decides what must happen on each layer ("load and play the clock",
 *   "replace team 42's lower third by team 7's"). instancePlayer does it: it creates the
 *   graphic's element inside its layer and calls load, playAction, stopAction and dispose
 *   on it. Each layer has its own queue. On a live stream two promises matter most: one
 *   layer never waits for another, and nothing that goes wrong on a layer stops what
 *   comes next on it.
 *
 * What these tests prove:
 *   - A new instance is created inside its layer's container, loaded with its data for a
 *     real-time 1920x1080 stage, then played; a load that answers nothing counts as a
 *     successful load (OGraf v1), so that graphic is played too.
 *   - An operation that throws is logged and does not stop the next operation on the same
 *     layer. An operation of a kind the player does not know is one of those: it is
 *     logged by name and never carried out as if it were a replace.
 *   - Two layers run independently: the lower third plays while the clock is still
 *     loading. On one layer, the second operation waits for the first.
 *   - A graphic whose load throws leaves its layer empty, and the next take on that layer
 *     plays.
 *
 * What these tests deliberately do not cover:
 *   - Replacing one graphic by another (out-then-in, cut, crossfade);
 *     instancePlayer.replace.test.ts.
 *   - What the player reports to the server about each instance (on air, failed);
 *     instancePlayer.status.test.ts.
 *   - A real graphic module in a real browser; e2e/lifecycle.e2e.ts and
 *     e2e/brokenGraphic.e2e.ts run the same paths in Chromium. Here the graphic is a
 *     stand-in that only writes down its calls (recordingGraphic.testSupport.ts), on a
 *     stage built by stageWithPlayer.testSupport.ts.
 *   - What each call logs and what counts as "accepted"; lifecycleCall.test.ts.
 *   - Which operations a change of the slice produces; instanceReconciler.test.ts.
 *   - Two of the five operation kinds: `updateData` (updateAction on the graphic already
 *     on air) and `disposeAtOnce` (the clear before the stage is rebuilt after a
 *     reconnect). e2e/lifecycle.e2e.ts covers both in Chromium, in its "update" and
 *     "reconnect" tests.
 *   - A graphic whose promise never settles: nothing times out (docs/decisions.md), so
 *     its layer stays blocked until the page is reloaded. The warning written after ten
 *     seconds of waiting is in lifecycleCall.slow.test.ts.
 */
import { describe, expect, it } from 'vitest';

import type { InstanceOperation } from './instanceReconciler.js';
import {
  createEnduroClockInstance,
  createTeamLowerThirdInstance,
  enduroClockInstanceId,
  feiLowerThirdInstanceId,
  ufprLowerThirdInstanceId,
} from './instancesOnAir.testSupport.js';
import {
  createEnduroClockThatLoadsSlowly,
  createFinalScoreboardInstance,
  createStageWhoseFinalScoreboardCannotBeCreated,
  createStageWithPlayer,
  createTakeOf,
  createUfprLowerThirdWhoseLoad,
  graphicsOfTheStream,
  graphicsWithTheFinalScoreboard,
  readInstanceIdsOnLayer,
  tagNoPageAccepts,
  waitForQueuedOperations,
} from './stageWithPlayer.testSupport.js';

describe('a new instance on an empty layer', () => {
  it('is created inside its layer, loaded with its data, then played', async () => {
    // Arrange: an empty stage with a player.
    const { stage, instancePlayer, recording } = createStageWithPlayer();

    // Act: the enduro clock is taken on the clock layer.
    instancePlayer.runLayerOperations(
      createTakeOf(createEnduroClockInstance()),
      graphicsOfTheStream,
    );
    await waitForQueuedOperations();

    // Assert: load came before play, load got the data and the stage size, and the
    // element sits in the clock layer carrying its instance id.
    expect(recording.lifecycleCalls, 'the graphic must be loaded, then played').toEqual([
      'Enduro: load',
      'Enduro: playAction',
    ]);
    expect(
      recording.loadParams,
      'load must get the instance data for a real-time 1920x1080 stage',
    ).toEqual([
      {
        data: { sessionName: 'Enduro de Resistência', state: 'green', running: true },
        renderType: 'realtime',
        renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
      },
    ]);
    expect(
      readInstanceIdsOnLayer(stage, 'clock'),
      'the element must be inside the clock layer, marked with its instance id',
    ).toEqual([enduroClockInstanceId]);
  });

  it('stays on its layer and is played when its load answers nothing', async () => {
    // Arrange: team 42's lower third, drawn by a graphic whose load resolves with no
    // answer, which OGraf v1 says must be treated as `{ statusCode: 200 }`.
    const { stage, instancePlayer, recording } = createStageWithPlayer();
    const lowerThirdWhoseLoadAnswersNothing = createUfprLowerThirdWhoseLoad('answers-nothing');

    // Act: the lower third is taken.
    instancePlayer.runLayerOperations(
      createTakeOf(lowerThirdWhoseLoadAnswersNothing),
      graphicsOfTheStream,
    );
    await waitForQueuedOperations();

    // Assert: the graphic was played after its load and its element is still on the layer.
    expect(
      recording.lifecycleCalls,
      'a load that answers nothing is a successful load, so the graphic must be played',
    ).toEqual(['UFPR: load', 'UFPR: playAction']);
    expect(
      readInstanceIdsOnLayer(stage, 'lower-third'),
      'the element must stay on its layer',
    ).toEqual([ufprLowerThirdInstanceId]);
  });
});

describe("a layer's queue of operations", () => {
  it('carries on with the next operation of a layer after one that throws', async () => {
    // Arrange: a stage on which the element of the final scoreboard cannot be created,
    // because its tag has a space in it and no page accepts such a tag. Creating it
    // throws inside the player. Every other graphic is the usual recording stand-in.
    const { stage, instancePlayer, recording, logLines } =
      createStageWhoseFinalScoreboardCannotBeCreated();

    // Act: the final scoreboard is taken on the lower-third layer and, right behind it on
    // the same layer, team 42's lower third.
    instancePlayer.runLayerOperations(
      createTakeOf(createFinalScoreboardInstance()),
      graphicsWithTheFinalScoreboard,
    );
    instancePlayer.runLayerOperations(
      createTakeOf(createTeamLowerThirdInstance(ufprLowerThirdInstanceId, 42, 'Baja UFPR')),
      graphicsWithTheFinalScoreboard,
    );
    await waitForQueuedOperations();

    // Assert: the operation that threw is logged with its layer and kind, and the lower
    // third queued behind it was loaded and played and is alone on the layer.
    expect(
      logLines.find((line) => line.message === 'renderer operation failed unexpectedly'),
      'the operation that threw must be logged as an error with its layer and its kind',
    ).toMatchObject({
      level: 'error',
      details: {
        layerId: 'lower-third',
        operation: 'loadAndPlay',
        reason: expect.stringContaining(tagNoPageAccepts),
      },
    });
    expect(
      recording.lifecycleCalls,
      'the operation queued behind the one that threw must still run',
    ).toEqual(['UFPR: load', 'UFPR: playAction']);
    expect(
      readInstanceIdsOnLayer(stage, 'lower-third'),
      "team 42's lower third must be the only element on the layer",
    ).toEqual([ufprLowerThirdInstanceId]);
  });

  it('logs an operation of a kind it does not know, and carries on with the layer', async () => {
    // Arrange: an operation kind this player was never taught, as a reconciler from a
    // later version could send. TypeScript forbids it, so it is forced in here.
    const { instancePlayer, recording, logLines } = createStageWithPlayer();
    const fadeToBlack = { kind: 'fadeToBlack' } as unknown as InstanceOperation;

    // Act: the unknown operation is queued on the clock layer, then the enduro clock.
    instancePlayer.runLayerOperations(
      [{ layerId: 'clock', operations: [fadeToBlack] }],
      graphicsOfTheStream,
    );
    instancePlayer.runLayerOperations(
      createTakeOf(createEnduroClockInstance()),
      graphicsOfTheStream,
    );
    await waitForQueuedOperations();

    // Assert: the log names the unknown kind instead of guessing what to do with it, no
    // graphic was touched on its account, and the clock behind it was played.
    expect(
      logLines.find((line) => line.message === 'renderer operation failed unexpectedly')?.details,
      'an unknown operation kind must be logged by name, not carried out as a replace',
    ).toEqual({
      layerId: 'clock',
      operation: 'fadeToBlack',
      reason: 'Error: the renderer does not know the operation kind "fadeToBlack"',
    });
    expect(
      recording.lifecycleCalls,
      'only the take queued behind the unknown operation may reach a graphic',
    ).toEqual(['Enduro: load', 'Enduro: playAction']);
  });

  it('lets the lower third play while the clock is still loading', async () => {
    // Arrange: an empty stage, and an enduro clock whose load will not finish until the
    // test says so, like a graphic waiting for its fonts.
    const { instancePlayer, recording } = createStageWithPlayer();
    const takeOfTheSlowClock = createTakeOf(createEnduroClockThatLoadsSlowly());
    const takeOfTheLowerThird = createTakeOf(
      createTeamLowerThirdInstance(ufprLowerThirdInstanceId, 42, 'Baja UFPR'),
    );

    // Act: the slow clock and team 42's lower third are taken together, on two layers;
    // only later does the clock's load finish.
    instancePlayer.runLayerOperations(
      [...takeOfTheSlowClock, ...takeOfTheLowerThird],
      graphicsOfTheStream,
    );
    await waitForQueuedOperations();
    const callsWhileTheClockIsLoading = [...recording.lifecycleCalls];
    recording.releaseLoadsThatWait();
    await waitForQueuedOperations();

    // Assert: the lower third was played while the clock was still inside its load, and
    // the clock was played once its load finished.
    expect(
      callsWhileTheClockIsLoading,
      'the lower third must be loaded and played without waiting for the clock layer',
    ).toEqual(['Enduro: load', 'UFPR: load', 'UFPR: playAction']);
    expect(
      recording.lifecycleCalls,
      'the clock must be played as soon as its own load finishes',
    ).toEqual(['Enduro: load', 'UFPR: load', 'UFPR: playAction', 'Enduro: playAction']);
  });

  it('makes the second operation of a layer wait for the first', async () => {
    // Arrange: an empty stage, and an enduro clock whose load will not finish until the
    // test says so.
    const { stage, instancePlayer, recording } = createStageWithPlayer();
    const clearOfTheClock = { kind: 'stopAndDispose' as const, instanceId: enduroClockInstanceId };

    // Act: the clock is taken and, while it is still loading, cleared again; only later
    // does its load finish.
    instancePlayer.runLayerOperations(
      createTakeOf(createEnduroClockThatLoadsSlowly()),
      graphicsOfTheStream,
    );
    instancePlayer.runLayerOperations(
      [{ layerId: 'clock', operations: [clearOfTheClock] }],
      graphicsOfTheStream,
    );
    await waitForQueuedOperations();
    const callsWhileTheClockIsLoading = [...recording.lifecycleCalls];
    recording.releaseLoadsThatWait();
    await waitForQueuedOperations();

    // Assert: nothing but the load was called until it finished; then the clock was
    // played, stopped and disposed in that order, and the layer is empty.
    expect(
      callsWhileTheClockIsLoading,
      'the clear must wait for the take queued before it on the same layer',
    ).toEqual(['Enduro: load']);
    expect(
      recording.lifecycleCalls,
      'the operations of one layer must run in the order they were queued',
    ).toEqual(['Enduro: load', 'Enduro: playAction', 'Enduro: stopAction', 'Enduro: dispose']);
    expect(readInstanceIdsOnLayer(stage, 'clock'), 'the cleared layer must be empty').toEqual([]);
  });
});

describe('a graphic that fails', () => {
  it('leaves its layer empty when its load throws, and the next take on that layer plays', async () => {
    // Arrange: team 42's lower third, drawn by a graphic whose load throws.
    const { stage, instancePlayer, recording, logLines } = createStageWithPlayer();
    const lowerThirdWhoseLoadThrows = createUfprLowerThirdWhoseLoad('rejects');
    // The server still lists the broken instance, so the reconciler describes the next
    // take as a replace of it.
    const replaceByTeamSeven = {
      kind: 'replace' as const,
      outgoingInstanceId: ufprLowerThirdInstanceId,
      incomingInstance: createTeamLowerThirdInstance(feiLowerThirdInstanceId, 7, 'FEI Baja'),
      replacePolicy: 'cut' as const,
    };

    // Act: the broken lower third is taken; then team 7's is taken in its place.
    instancePlayer.runLayerOperations(createTakeOf(lowerThirdWhoseLoadThrows), graphicsOfTheStream);
    await waitForQueuedOperations();
    const instanceIdsAfterTheFailedLoad = readInstanceIdsOnLayer(stage, 'lower-third');
    instancePlayer.runLayerOperations(
      [{ layerId: 'lower-third', operations: [replaceByTeamSeven] }],
      graphicsOfTheStream,
    );
    await waitForQueuedOperations();

    // Assert: the failed graphic left nothing behind and was never played, stopped or
    // disposed; the failure is logged; team 7's lower third is on air alone.
    expect(
      instanceIdsAfterTheFailedLoad,
      'a graphic whose load throws must leave its layer empty',
    ).toEqual([]);
    expect(
      logLines.find(
        (line) => line.message === 'graphic could not go on air; its layer stays empty',
      ),
      'the failure must be logged as an error naming the instance, its layer and its graphic',
    ).toMatchObject({
      level: 'error',
      details: {
        instanceId: ufprLowerThirdInstanceId,
        layerId: 'lower-third',
        graphicId: 'team-lower-third',
        reason:
          'its load failed or was refused: Error: O gráfico de teste foi instruído a falhar no load.',
      },
    });
    expect(
      recording.lifecycleCalls,
      'the failed graphic gets no further call, and the next take is loaded and played',
    ).toEqual(['UFPR: load', 'FEI: load', 'FEI: playAction (skipAnimation)']);
    expect(
      readInstanceIdsOnLayer(stage, 'lower-third'),
      "team 7's lower third must be the only element on the layer",
    ).toEqual([feiLowerThirdInstanceId]);
  });
});
