/**
 * Booting and stopping the whole server (apps/server)
 *
 * What this module is for:
 *   `startServer` is what `pnpm dev` and `pnpm start` run (through main.ts): open the
 *   SQLite file and apply migrations, load or seed the slices, build the HTTP app,
 *   listen, and attach the WebSocket hub to the same port. `close()` undoes all of it.
 *
 * What these tests prove (with a real port and a real SQLite file):
 *   - A booted server answers GET /api/v1/state over real HTTP with the seeded layers.
 *   - A booted server serves the theme folder it was given at /theme/, so the renderer
 *     page it serves can link the tokens from the same port.
 *   - A booted server has the seeded rundown and a running auto-out scheduler: an item
 *     taken with a delay leaves the air by itself (in real time, with a 40 ms delay).
 *   - A booted server runs the data-source service: a source turned on is polled.
 *   - close() stops the data-source poller first: no poll timer fires at the closed
 *     database (no error is logged). That a poll answering late is dropped is proved in
 *     modules/dataSources/pollerLifecycle.test.ts.
 *   - A migration failure makes the boot reject, so main.ts can exit non-zero.
 *   - A boot that fails on a port already in use stops the poller it started, so a
 *     source left on sends nothing to the closed database.
 *   - After close() the port no longer answers.
 *
 * What these tests deliberately do not cover:
 *   - main.ts itself (reading the environment, exiting on failure); it only wires
 *     these pieces together and is checked by booting it with `pnpm dev`.
 *   - A restart keeping the last good data: startServerRestart.test.ts.
 */
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { committedMigrationsFolder } from '../db/openDatabase.js';
import { writeBrokenMigrationsFolder } from '../db/temporaryDatabase.testSupport.js';
import { standInTokensCss } from '../http/themeFolder.testSupport.js';
import { createRecordingLogger } from '../logger/recordingLogger.testSupport.js';
import { createGraphicsFolderWithBuiltRaceClock } from '../store/builtGraphicsFolder.testSupport.js';
import {
  buildBootOptions,
  operatorActor,
  readTheSeededSimulator,
} from './bootedServer.testSupport.js';
import { startServer } from './startServer.js';

/** Lets real time pass, for the few tests that watch timers of a booted server. */
function waitInRealTime(durationInMilliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, durationInMilliseconds));
}

describe('startServer', () => {
  it('answers GET /api/v1/state over real HTTP with the seeded layers', async () => {
    // Arrange: a server booted on a random port.
    const runningServer = await startServer(buildBootOptions(committedMigrationsFolder));
    onTestFinished(() => runningServer.close());

    // Act: ask for the state over the network, as the renderer does.
    const response = await fetch(`http://127.0.0.1:${runningServer.port}/api/v1/state`);
    const body = (await response.json()) as { layers: Array<{ id: string }> };

    // Assert: 200 and the ten seeded layers.
    expect(response.status, 'the booted server must answer 200 OK').toBe(200);
    expect(
      body.layers.map((layer) => layer.id),
      'the seeded layers must be served',
    ).toEqual([
      'bug',
      'sponsor-roll-plain',
      'channel-logo',
      'bracket-match',
      'ticker',
      'clock',
      'tower',
      'lower-third',
      'notice',
      'fullscreen',
    ]);
  });

  it('serves the theme tokens it was booted with at /theme/ over real HTTP', async () => {
    // Arrange: a server booted on a random port with the stand-in theme folder.
    const runningServer = await startServer(buildBootOptions(committedMigrationsFolder));
    onTestFinished(() => runningServer.close());

    // Act: ask for the tokens over the network, as the renderer page's <link> does.
    const response = await fetch(`http://127.0.0.1:${runningServer.port}/theme/ardosia/tokens.css`);
    const body = await response.text();

    // Assert: 200, never cached, and the tokens file of the folder the boot was given.
    expect(response.status, 'the booted server must serve the theme tokens').toBe(200);
    expect(response.headers.get('cache-control'), 'the tokens must not be cached').toBe('no-cache');
    expect(body, 'the body must be the tokens file of the theme folder given at boot').toBe(
      standInTokensCss,
    );
  });

  it('takes an item with an auto-out delay off air by itself, and seeds the rundown', async () => {
    // Arrange: a booted server with a built race clock, and a clock item for the
    // seeded rundown that leaves by itself after 40 milliseconds (real time).
    const runningServer = await startServer({
      ...buildBootOptions(committedMigrationsFolder),
      graphicPackagesFolder: createGraphicsFolderWithBuiltRaceClock(),
    });
    onTestFinished(() => runningServer.close());
    const { stateStore } = runningServer;
    const seededRundown = stateStore.readAllSlices().rundowns[0];
    stateStore.applyCommand(
      {
        type: 'createItem',
        home: { kind: 'rundown', rundownId: seededRundown?.id },
        graphicId: 'race-clock',
        layerId: 'clock',
        label: 'Relógio do patrocinador',
        fields: {
          sessionName: { kind: 'literal', value: 'Enduro de Resistência' },
          state: { kind: 'literal', value: 'green' },
          clockMode: { kind: 'literal', value: 'elapsed' },
          referenceTimeMs: { kind: 'literal', value: 3_900_000 },
          referenceWallClockMs: { kind: 'literal', value: 1_791_550_800_000 },
          running: { kind: 'literal', value: true },
        },
        autoOutAfterMs: 40,
      },
      'operador:conexao-7',
    );

    // Act: press "next", as the Space key does, and look at once.
    const outcomeOfTheTake = stateStore.applyCommand(
      { type: 'takeNext', rundownId: seededRundown?.id },
      'operador:conexao-7',
    );
    const numberOfInstancesRightAfterTheTake = stateStore.readAllSlices().instances.length;

    // Assert: the boot seeded "Sessão principal", the item went on air, and the booted
    // server's own scheduler cleared it, signed sistema:auto-out, without anyone asking.
    expect(seededRundown?.name, 'the boot must seed the rundown').toBe('Sessão principal');
    expect(outcomeOfTheTake, 'the take must be accepted').toEqual({ ok: true });
    expect(numberOfInstancesRightAfterTheTake, 'the item must be on air after the take').toBe(1);
    await vi.waitFor(() => {
      expect(
        stateStore.readAllSlices().instances,
        'the item must leave the air by itself once its delay is over',
      ).toEqual([]);
    });
    expect(
      stateStore.readAllSlices().eventLog.at(-1)?.actor,
      'the clear must be signed by the auto-out scheduler',
    ).toBe('sistema:auto-out');
  });

  it('polls a data source turned on, through the data-source service', async () => {
    // Arrange: a booted server, with the seeded "Simulador — Enduro" off.
    const runningServer = await startServer(buildBootOptions(committedMigrationsFolder));
    onTestFinished(() => runningServer.close());
    const { stateStore } = runningServer;

    // Act: the operator turns the simulator on.
    stateStore.applyCommand(
      { type: 'setDataSourceEnabled', sourceId: 'simulador-enduro', isEnabled: true },
      operatorActor,
    );

    // Assert: soon a poll has been attempted (good or failed), so the poller is running.
    await vi.waitFor(() => {
      expect(
        readTheSeededSimulator(stateStore)?.status.lastAttemptAtMs,
        'the booted server must poll a source turned on',
      ).toBeDefined();
    });
  });

  it('stops the poller before closing the database, so no poll timer fires at it', async () => {
    // Arrange: a booted server logging into memory, the simulator polled every half a
    // second and polled at least once.
    const { logger, readRecordedLines } = createRecordingLogger();
    const runningServer = await startServer({
      ...buildBootOptions(committedMigrationsFolder),
      logger,
    });
    const { stateStore } = runningServer;
    stateStore.applyCommand(
      { type: 'updateDataSource', sourceId: 'simulador-enduro', pollIntervalMs: 500 },
      operatorActor,
    );
    stateStore.applyCommand(
      { type: 'setDataSourceEnabled', sourceId: 'simulador-enduro', isEnabled: true },
      operatorActor,
    );
    await vi.waitFor(() => {
      expect(
        readTheSeededSimulator(stateStore)?.status.lastAttemptAtMs,
        'the first poll must happen',
      ).toBeDefined();
    });

    // Act: shut the server down, then let more than a poll interval go by.
    await runningServer.close();
    await waitInRealTime(700);

    // Assert: nothing was logged as an error: no poll result met the closed database.
    expect(
      readRecordedLines().filter((line) => line.level === 'error'),
      'no poll may be sent to a closed database',
    ).toEqual([]);
  });

  it('rejects when a migration fails, so the boot stops', async () => {
    // Arrange: boot options pointing at a migrations folder with broken SQL.
    const bootOptions = buildBootOptions(writeBrokenMigrationsFolder());

    // Act: try to boot.
    const boot = startServer(bootOptions);

    // Assert: the boot rejects with the migration error.
    await expect(boot, 'a failed migration must stop the boot').rejects.toThrow(
      'database migration failed',
    );
  });

  it('stops the poller it started when the port is already in use', async () => {
    // Arrange: a first boot on a database file leaves the simulator on, polled every half
    // a second, and closes; a second server holds a port.
    const firstBootOptions = buildBootOptions(committedMigrationsFolder);
    const firstBoot = await startServer(firstBootOptions);
    firstBoot.stateStore.applyCommand(
      { type: 'updateDataSource', sourceId: 'simulador-enduro', pollIntervalMs: 500 },
      operatorActor,
    );
    firstBoot.stateStore.applyCommand(
      { type: 'setDataSourceEnabled', sourceId: 'simulador-enduro', isEnabled: true },
      operatorActor,
    );
    await firstBoot.close();
    const serverHoldingThePort = await startServer(buildBootOptions(committedMigrationsFolder));
    onTestFinished(() => serverHoldingThePort.close());
    const { logger, readRecordedLines } = createRecordingLogger();

    // Act: boot again on that database file and on the taken port, then let more than a
    // poll interval go by.
    const bootError: unknown = await startServer({
      ...firstBootOptions,
      logger,
      port: serverHoldingThePort.port,
    }).catch((error: unknown) => error);
    await waitInRealTime(700);

    // Assert: the boot failed, and nothing was logged as an error since: no poll result
    // met the closed database.
    expect(bootError, 'a port already in use must stop the boot').toBeInstanceOf(Error);
    expect(
      readRecordedLines().filter((line) => line.level === 'error'),
      'a failed boot must leave no poll running against its closed database',
    ).toEqual([]);
  });

  it('stops answering on its port after close()', async () => {
    // Arrange: a booted server.
    const runningServer = await startServer(buildBootOptions(committedMigrationsFolder));
    const healthAddress = `http://127.0.0.1:${runningServer.port}/health`;

    // Act: shut it down.
    await runningServer.close();

    // Assert: the port no longer accepts requests.
    await expect(fetch(healthAddress), 'a closed server must not answer').rejects.toThrow();
  });
});
