/**
 * Restarting the whole server with a data source on (apps/server)
 *
 * What this module is for:
 *   A server can be restarted mid-race (a crash, an update). Rule 4 says nothing on air
 *   is ever blanked by a failure, so a restart must keep each source's last good data and
 *   show it as late until a new good poll arrives. This drives `startServer` twice on
 *   the same database file and data folder, as `pnpm start` does after a restart.
 *
 * What these tests prove (with a real port and a real SQLite file):
 *   - A server closed after a good poll of the simulator and booted again on the same
 *     database file and data folder still has that snapshot, unchanged, keeps the source
 *     on, and shows it late (stale) with the moment of its last good data kept.
 *     The e2e harness cannot restart its server, so this is the brief's "restart" check.
 *
 * What these tests deliberately do not cover:
 *   - That the restart alone marks the source stale, before its first poll: the second
 *     boot polls at once, so here the simulator is left failing on purpose to keep its
 *     data from being replaced; dataSourceRestart.test.ts proves the restart's own mark
 *     on a store with no poller.
 *   - Booting, close() and the poller's shutdown: startServer.test.ts.
 */
import type { DataSnapshot } from '@bajaovrlay/shared';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { committedMigrationsFolder } from '../db/openDatabase.js';
import type { StateStore } from '../store/createStateStore.js';
import {
  buildBootOptions,
  operatorActor,
  readTheSeededSimulator,
} from './bootedServer.testSupport.js';
import { startServer } from './startServer.js';

/** Reads the seeded simulator's last good data as the store holds it now. */
function readTheSeededSimulatorSnapshot(stateStore: StateStore): DataSnapshot | undefined {
  return stateStore
    .readAllSlices()
    .dataSnapshots.find((snapshot) => snapshot.sourceId === 'simulador-enduro');
}

describe('startServer after a restart', () => {
  it('keeps the last good data across a restart, and shows the source late', async () => {
    // Arrange: a first boot polls the seeded simulator, turned on, until it has data;
    // then, in the same instant (no poll can land in between), "Falha simulada" is
    // switched on and the server is closed, so every poll after the restart fails and
    // the data the first boot kept is the only data there is. If a step fails before
    // the explicit close, the cleanup closes the first boot instead, so its port, poll
    // timer and database file do not outlive this test.
    const bootOptions = buildBootOptions(committedMigrationsFolder);
    const firstBoot = await startServer(bootOptions);
    let isFirstBootClosed = false;
    onTestFinished(async () => {
      if (!isFirstBootClosed) {
        await firstBoot.close();
      }
    });
    firstBoot.stateStore.applyCommand(
      { type: 'setDataSourceEnabled', sourceId: 'simulador-enduro', isEnabled: true },
      operatorActor,
    );
    await vi.waitFor(() => {
      expect(
        readTheSeededSimulatorSnapshot(firstBoot.stateStore),
        'the first boot must receive a good poll of the simulator',
      ).toBeDefined();
    });
    const snapshotBeforeTheRestart = readTheSeededSimulatorSnapshot(firstBoot.stateStore);
    firstBoot.stateStore.applyCommand(
      { type: 'updateDataSource', sourceId: 'simulador-enduro', config: { isFailing: true } },
      operatorActor,
    );
    // close() stops the poller before its first await, so no poll lands after the edit.
    isFirstBootClosed = true;
    await firstBoot.close();

    // Act: boot again on the same database file and data folder, as a restart does.
    const secondBoot = await startServer(bootOptions);
    onTestFinished(() => secondBoot.close());

    // Assert: the snapshot is the very one from before the restart, and the source is
    // on and shown late, with the moment of its last good data kept.
    expect(
      readTheSeededSimulatorSnapshot(secondBoot.stateStore),
      'a restart must keep the last good data of the simulator, unchanged',
    ).toEqual(snapshotBeforeTheRestart);
    const simulatorAfterTheRestart = readTheSeededSimulator(secondBoot.stateStore);
    expect(simulatorAfterTheRestart?.isEnabled, 'the simulator must still be on').toBe(true);
    expect(
      simulatorAfterTheRestart?.status.isStale,
      'after a restart the kept data must be shown late (stale)',
    ).toBe(true);
    expect(
      simulatorAfterTheRestart?.status.lastOkAtMs,
      'the moment of the last good data must survive the restart',
    ).toBe(snapshotBeforeTheRestart?.receivedAtMs);
  });
});
