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
 *   - A booted server has the seeded rundown and a running auto-out scheduler: an item
 *     taken with a delay leaves the air by itself (in real time, with a 40 ms delay).
 *   - A migration failure makes the boot reject, so main.ts can exit non-zero.
 *   - After close() the port no longer answers.
 *
 * What these tests deliberately do not cover:
 *   - main.ts itself (reading the environment, exiting on failure); it only wires
 *     these pieces together and is checked by booting it with `pnpm dev`.
 */
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { committedMigrationsFolder } from '../db/openDatabase.js';
import {
  createTemporaryDatabasePath,
  writeBrokenMigrationsFolder,
} from '../db/temporaryDatabase.testSupport.js';
import { createLogger } from '../logger/createLogger.js';
import {
  createGraphicsFolderWithBuiltRaceClock,
  missingGraphicsFolderPath,
} from '../store/builtGraphicsFolder.testSupport.js';
import { startServer } from './startServer.js';

/** The options production uses, on a random port, a temporary file and a silent logger. */
function buildBootOptions(migrationsFolder: string) {
  return {
    logger: createLogger({ level: 'silent' }),
    version: '0.3.1',
    host: '127.0.0.1',
    port: 0,
    databasePath: createTemporaryDatabasePath(),
    migrationsFolder,
    graphicPackagesFolder: missingGraphicsFolderPath,
  };
}

describe('startServer', () => {
  it('answers GET /api/v1/state over real HTTP with the seeded layers', async () => {
    // Arrange: a server booted on a random port.
    const runningServer = await startServer(buildBootOptions(committedMigrationsFolder));
    onTestFinished(() => runningServer.close());

    // Act: ask for the state over the network, as the renderer does.
    const response = await fetch(`http://127.0.0.1:${runningServer.port}/api/v1/state`);
    const body = (await response.json()) as { layers: Array<{ id: string }> };

    // Assert: 200 and the five seeded layers.
    expect(response.status, 'the booted server must answer 200 OK').toBe(200);
    expect(
      body.layers.map((layer) => layer.id),
      'the seeded layers must be served',
    ).toEqual(['bug', 'ticker', 'clock', 'lower-third', 'fullscreen']);
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
        rundownId: seededRundown?.id,
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
