// @vitest-environment jsdom
/**
 * Telling the server what really happened to an instance (apps/renderer)
 *
 * What this module is for:
 *   When the operator takes a graphic, the server lists its instance as `loading`: it
 *   cannot see the screen. The renderer can, so instancePlayer reports back. It says
 *   `on-air` once the graphic's playAction has resolved, and `failed`, with a few words
 *   about why, when the graphic could not be put on the layer or could not be played. The
 *   control page shows that to the operator as "No ar" or as a red badge with the reason.
 *
 * What these tests prove:
 *   - `on-air` is reported only after playAction has resolved, not when it is called.
 *   - Each way a graphic can fail to go on air is reported as `failed` with a detail that
 *     says why: its layer is unknown, its graphic is unknown, its module cannot be
 *     imported, its load throws, its playAction throws, or the renderer itself throws.
 *   - Every report has the shape the shared protocol gives the `instanceStatus` message.
 *   - Clearing a graphic reports nothing: the server took it off air itself.
 *   - The new graphic of a cut is reported `on-air` like any other take.
 *
 * What these tests deliberately do not cover:
 *   - Sending the report over the WebSocket; serverConnection.instanceStatus.test.ts.
 *   - The same reports arriving at a server from a real browser;
 *     e2e/instanceStatus.e2e.ts.
 *   - What the server does with a report (the `reportInstanceStatus` command); that is
 *     the server's own test.
 */
import { type Instance, InstanceStatusMessageSchema } from '@bajaovrlay/shared';
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
  createEnduroClockWhosePlay,
  createFinalScoreboardInstance,
  createStageWhoseFinalScoreboardCannotBeCreated,
  createStageWhoseGraphicModulesCannotBeImported,
  createStageWithPlayer,
  createTakeOf,
  createUfprLowerThirdWhoseLoad,
  finalScoreboardInstanceId,
  graphicsOfTheStream,
  graphicsWithTheFinalScoreboard,
  readInstanceIdsOnLayer,
  reasonTheModuleCannotBeImported,
  tagNoPageAccepts,
  waitForQueuedOperations,
} from './stageWithPlayer.testSupport.js';

describe('a graphic that goes on air', () => {
  it('is reported on-air only after its playAction has resolved', async () => {
    // Arrange: an enduro clock whose playAction will not finish until the test says so,
    // like a graphic in the middle of a long in-animation.
    const { instancePlayer, recording, statusReports } = createStageWithPlayer();
    const clockWithALongInAnimation = createEnduroClockWhosePlay('waits-to-be-released');

    // Act: the clock is taken; the test looks at the reports while the in-animation is
    // still running, then lets it finish.
    instancePlayer.runLayerOperations(createTakeOf(clockWithALongInAnimation), graphicsOfTheStream);
    await waitForQueuedOperations();
    const callsWhileThePlayIsRunning = [...recording.lifecycleCalls];
    const reportsWhileThePlayIsRunning = [...statusReports];
    recording.releasePlaysThatWait();
    await waitForQueuedOperations();

    // Assert: nothing was reported while playAction was still running, and exactly one
    // on-air report for the clock once it resolved.
    expect(
      callsWhileThePlayIsRunning,
      'the playAction must already have been called when the test first looked',
    ).toEqual(['Enduro: load', 'Enduro: playAction']);
    expect(
      reportsWhileThePlayIsRunning,
      'nothing may be reported while the playAction has not resolved yet',
    ).toEqual([]);
    expect(
      statusReports,
      'once the playAction resolves, the instance must be reported on-air, once',
    ).toEqual([{ type: 'instanceStatus', instanceId: enduroClockInstanceId, status: 'on-air' }]);
  });

  it('reports the new graphic of a cut on-air, and nothing about the old one', async () => {
    // Arrange: the enduro clock on air, already reported.
    const { instancePlayer, statusReports } = createStageWithPlayer();
    instancePlayer.runLayerOperations(
      createTakeOf(createEnduroClockInstance()),
      graphicsOfTheStream,
    );
    await waitForQueuedOperations();
    const numberOfReportsBeforeTheCut = statusReports.length;
    const cutToTheFinalClock = {
      kind: 'replace' as const,
      outgoingInstanceId: enduroClockInstanceId,
      incomingInstance: createFinalClockInstance(),
      replacePolicy: 'cut' as const,
    };

    // Act: the clock of the final heat is cut in on the same layer.
    instancePlayer.runLayerOperations(
      [{ layerId: 'clock', operations: [cutToTheFinalClock] }],
      graphicsOfTheStream,
    );
    await waitForQueuedOperations();

    // Assert: one new report, for the new clock.
    expect(
      statusReports.slice(numberOfReportsBeforeTheCut),
      'the cut must report the new clock on-air and say nothing about the old one',
    ).toEqual([{ type: 'instanceStatus', instanceId: finalClockInstanceId, status: 'on-air' }]);
  });

  it('reports nothing when the graphic is cleared', async () => {
    // Arrange: the enduro clock on air, already reported.
    const { stage, instancePlayer, statusReports } = createStageWithPlayer();
    instancePlayer.runLayerOperations(
      createTakeOf(createEnduroClockInstance()),
      graphicsOfTheStream,
    );
    await waitForQueuedOperations();
    const clearOfTheClock = { kind: 'stopAndDispose' as const, instanceId: enduroClockInstanceId };

    // Act: the operator clears the clock layer.
    instancePlayer.runLayerOperations(
      [{ layerId: 'clock', operations: [clearOfTheClock] }],
      graphicsOfTheStream,
    );
    await waitForQueuedOperations();

    // Assert: the layer is empty and the only report is still the on-air one of the take.
    expect(readInstanceIdsOnLayer(stage, 'clock'), 'the cleared layer must be empty').toEqual([]);
    expect(
      statusReports,
      'a clear comes from the server, so there is nothing to report back about it',
    ).toEqual([{ type: 'instanceStatus', instanceId: enduroClockInstanceId, status: 'on-air' }]);
  });
});

describe('a graphic that cannot go on air', () => {
  /** Builds team 42's lower third taken on a ticker layer the stage does not have. */
  function createLowerThirdOnTheMissingTickerLayer(): Instance {
    return {
      ...createTeamLowerThirdInstance(ufprLowerThirdInstanceId, 42, 'Baja UFPR'),
      layerId: 'ticker',
    };
  }

  /** Builds team 42's lower third drawn by a graphic the graphics slice does not list. */
  function createLowerThirdOfAnUnlistedGraphic(): Instance {
    return {
      ...createTeamLowerThirdInstance(ufprLowerThirdInstanceId, 42, 'Baja UFPR'),
      graphicId: 'starting-grid',
    };
  }

  const failureScenarios = [
    // The layers slice does not list the instance's layer: there is nowhere to put it.
    {
      name: 'reports failed when the layer of the instance is not in the layers slice',
      createStage: createStageWithPlayer,
      instance: createLowerThirdOnTheMissingTickerLayer(),
      graphics: graphicsOfTheStream,
      expectedDetail: 'its layer is not in the layers slice',
    },
    // The package was removed from the server while its instance stayed on air.
    {
      name: 'reports failed when the graphic of the instance is not in the graphics slice',
      createStage: createStageWithPlayer,
      instance: createLowerThirdOfAnUnlistedGraphic(),
      graphics: graphicsOfTheStream,
      expectedDetail: 'its graphic is not in the graphics slice',
    },
    // The package is listed but its main file is gone: the import answers 404.
    {
      name: 'reports failed with the import error when the module cannot be imported',
      createStage: createStageWhoseGraphicModulesCannotBeImported,
      instance: createEnduroClockInstance(),
      graphics: graphicsOfTheStream,
      expectedDetail: `its module could not be loaded: ${reasonTheModuleCannotBeImported}`,
    },
    // A bug in the graphic: its load throws. The brief names this case.
    {
      name: 'reports failed with the error of the graphic when its load throws',
      createStage: createStageWithPlayer,
      instance: createUfprLowerThirdWhoseLoad('rejects'),
      graphics: graphicsOfTheStream,
      expectedDetail:
        'its load failed or was refused: Error: O gráfico de teste foi instruído a falhar no load.',
    },
    // The graphic loaded but its playAction throws: it is on the layer, yet not shown.
    {
      name: 'reports failed with the error of the graphic when its playAction throws',
      createStage: createStageWithPlayer,
      instance: createEnduroClockWhosePlay('rejects'),
      graphics: graphicsOfTheStream,
      expectedDetail:
        'its playAction failed or was refused: Error: O gráfico de teste foi instruído a falhar no playAction.',
    },
  ];

  it.each(failureScenarios)('$name', async (scenario) => {
    // Arrange: the stage of the row, with nothing on air.
    const { instancePlayer, statusReports } = scenario.createStage();

    // Act: the instance of the row is taken.
    instancePlayer.runLayerOperations(createTakeOf(scenario.instance), scenario.graphics);
    await waitForQueuedOperations();

    // Assert: exactly one report, saying the instance failed and why, in the shape the
    // shared protocol gives the instanceStatus message.
    expect(
      statusReports,
      'the instance must be reported failed, once, with a detail that says why',
    ).toEqual([
      {
        type: 'instanceStatus',
        instanceId: scenario.instance.id,
        status: 'failed',
        detail: scenario.expectedDetail,
      },
    ]);
    expect(
      InstanceStatusMessageSchema.safeParse(statusReports[0]).success,
      'the report must pass the shared InstanceStatusMessageSchema',
    ).toBe(true);
  });

  it('reports failed when the renderer itself throws while putting the graphic on air', async () => {
    // Arrange: a stage on which the element of the final scoreboard cannot be created,
    // because its tag has a space in it. Creating it throws inside the player.
    const { instancePlayer, statusReports } = createStageWhoseFinalScoreboardCannotBeCreated();

    // Act: the final scoreboard is taken.
    instancePlayer.runLayerOperations(
      createTakeOf(createFinalScoreboardInstance()),
      graphicsWithTheFinalScoreboard,
    );
    await waitForQueuedOperations();

    // Assert: the instance is reported failed, so it does not stay "loading" for ever in
    // the layer panel, and the detail carries the error.
    expect(
      statusReports,
      'an instance the renderer could not even create must be reported failed',
    ).toEqual([
      {
        type: 'instanceStatus',
        instanceId: finalScoreboardInstanceId,
        status: 'failed',
        detail: expect.stringContaining(tagNoPageAccepts),
      },
    ]);
    expect(
      statusReports[0]?.detail,
      'the detail must say the failure was the renderer own, not the graphic refusing',
    ).toContain('the renderer failed unexpectedly: ');
  });
});
