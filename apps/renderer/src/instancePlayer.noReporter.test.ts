// @vitest-environment jsdom
/**
 * A player that reports to nobody: the program monitor (apps/renderer)
 *
 * What this module is for:
 *   The control page shows the operator a copy of the stream picture by framing the
 *   renderer page with `?monitor=1`. That copy draws the same graphics, but it is not what
 *   goes to the stream, so it must never tell the server "this is on air" or "this failed":
 *   only the page OBS loads may (gate-2 ruling on BAJAOVRLAY-12). renderer.ts therefore
 *   builds the monitor's instancePlayer without a `reportInstanceStatus` function. There
 *   is nothing to send with and nothing is attempted. The preview page
 *   (`?target=preview`) gets the very same player, so what is proven here holds there.
 *
 * What these tests prove, for a player built without a reporter:
 *   - A taken graphic is loaded and played on its layer exactly as on the program page.
 *   - A graphic whose load fails is logged and leaves its layer empty, exactly as on the
 *     program page, and the layer's queue goes on to the next take.
 *   - When the renderer itself throws, the failure is logged once and the layer's queue
 *     still goes on. This is the place where a missing reporter could do harm: the report
 *     is made from inside the queue's own error handling.
 *   - In none of the three does the player trip over the reporter it was not given: no
 *     "failed unexpectedly" line is written about it.
 *
 * What these tests deliberately do not cover:
 *   - What a player WITH a reporter says, and when; instancePlayer.status.test.ts.
 *   - Which page is a monitor and which address it dials; rendererPageRole.test.ts.
 *   - That the real monitor page puts no instanceStatus on its WebSocket;
 *     e2e/programMonitor.e2e.ts listens on the socket itself.
 */
import { describe, expect, it } from 'vitest';

import {
  createEnduroClockInstance,
  createTeamLowerThirdInstance,
  enduroClockInstanceId,
  feiLowerThirdInstanceId,
  ufprLowerThirdInstanceId,
} from './instancesOnAir.testSupport.js';
import {
  type CapturedLogLine,
  createFinalScoreboardInstance,
  createStageWithPlayerThatHasNoStatusReporter,
  createTakeOf,
  createUfprLowerThirdWhoseLoad,
  graphicsOfTheStream,
  graphicsWithTheFinalScoreboard,
  readInstanceIdsOnLayer,
  waitForQueuedOperations,
} from './stageWithPlayer.testSupport.js';

/** Picks the log lines that say the renderer itself failed, as opposed to a graphic. */
function findLinesAboutTheRendererFailing(logLines: CapturedLogLine[]): CapturedLogLine[] {
  return logLines.filter((line) => line.message === 'renderer operation failed unexpectedly');
}

describe('a player that was given no status reporter', () => {
  it('loads and plays a taken graphic exactly as the program page does', async () => {
    // Arrange: the stage of a program monitor, with nothing on air.
    const { stage, instancePlayer, recording, logLines } =
      createStageWithPlayerThatHasNoStatusReporter();

    // Act: the operator takes the enduro clock.
    instancePlayer.runLayerOperations(
      createTakeOf(createEnduroClockInstance()),
      graphicsOfTheStream,
    );
    await waitForQueuedOperations();

    // Assert: the clock was loaded and played and sits on its layer, and the player did
    // not stumble where the program page would have reported on-air.
    expect(recording.lifecycleCalls, 'the clock must be loaded, then played').toEqual([
      'Enduro: load',
      'Enduro: playAction',
    ]);
    expect(
      readInstanceIdsOnLayer(stage, 'clock'),
      'the clock must be on the clock layer of the monitor',
    ).toEqual([enduroClockInstanceId]);
    expect(
      findLinesAboutTheRendererFailing(logLines),
      'having nobody to report on-air to must not count as a failure of the renderer',
    ).toEqual([]);
  });

  it('leaves the layer empty when a load fails, and plays the next take on that layer', async () => {
    // Arrange: the stage of a program monitor, with nothing on air.
    const { stage, instancePlayer, recording, logLines } =
      createStageWithPlayerThatHasNoStatusReporter();

    // Act: team 42's lower third is taken but its load throws; then FEI's is taken.
    instancePlayer.runLayerOperations(
      createTakeOf(createUfprLowerThirdWhoseLoad('rejects')),
      graphicsOfTheStream,
    );
    await waitForQueuedOperations();
    const lowerThirdLayerAfterTheFailedLoad = readInstanceIdsOnLayer(stage, 'lower-third');
    instancePlayer.runLayerOperations(
      createTakeOf(createTeamLowerThirdInstance(feiLowerThirdInstanceId, 7, 'FEI Baja')),
      graphicsOfTheStream,
    );
    await waitForQueuedOperations();

    // Assert: the failure was written to the log with its reason and left the layer
    // empty, as on the program page; the next take played; the renderer itself never failed.
    expect(
      lowerThirdLayerAfterTheFailedLoad,
      'a graphic whose load failed must leave its layer empty',
    ).toEqual([]);
    expect(
      logLines.find((line) => line.message === 'graphic could not go on air; its layer stays empty')
        ?.details,
      'the failed load must still be logged with the instance and the reason',
    ).toMatchObject({
      instanceId: ufprLowerThirdInstanceId,
      reason:
        'its load failed or was refused: Error: O gráfico de teste foi instruído a falhar no load.',
    });
    expect(
      recording.lifecycleCalls,
      'after the failed load the next take on the same layer must be loaded and played',
    ).toEqual(['UFPR: load', 'FEI: load', 'FEI: playAction']);
    expect(
      findLinesAboutTheRendererFailing(logLines),
      'having nobody to report the failure to must not count as a failure of the renderer',
    ).toEqual([]);
  });

  it('logs once when the renderer itself throws, and plays the next take on that layer', async () => {
    // Arrange: the stage of a program monitor, on which the element of the final
    // scoreboard cannot be created, so creating it throws inside the player.
    const { stage, instancePlayer, recording, logLines } =
      createStageWithPlayerThatHasNoStatusReporter();

    // Act: the final scoreboard is taken on the lower-third layer; then FEI's lower third.
    instancePlayer.runLayerOperations(
      createTakeOf(createFinalScoreboardInstance()),
      graphicsWithTheFinalScoreboard,
    );
    instancePlayer.runLayerOperations(
      createTakeOf(createTeamLowerThirdInstance(feiLowerThirdInstanceId, 7, 'FEI Baja')),
      graphicsWithTheFinalScoreboard,
    );
    await waitForQueuedOperations();

    // Assert: one log line about the scoreboard, and the queue of the layer went on. Had
    // the player tried to call a reporter it does not have, the queue would have stopped.
    expect(
      findLinesAboutTheRendererFailing(logLines),
      'the renderer own failure must be logged exactly once, for the scoreboard take',
    ).toHaveLength(1);
    expect(
      recording.lifecycleCalls,
      'the take queued behind the failure must still be loaded and played',
    ).toEqual(['FEI: load', 'FEI: playAction']);
    expect(
      readInstanceIdsOnLayer(stage, 'lower-third'),
      'only the lower third of FEI Baja must be on the layer afterwards',
    ).toEqual([feiLowerThirdInstanceId]);
  });
});
