// Test support: what the tests of a booted server share (startServer.test.ts and
// startServerRestart.test.ts): the boot options production uses, pointed at temporary
// places, and a reader of the seeded simulator. Functions only; nothing is shared between tests.
import type { DataSource } from '@bajaovrlay/shared';

import { noSourceHostAllowlist } from '../../modules/dataSources/index.js';
import { createTemporaryDatabasePath } from '../db/temporaryDatabase.testSupport.js';
import { createStandInThemeFolder } from '../http/themeFolder.testSupport.js';
import { createLogger } from '../logger/createLogger.js';
import { missingGraphicsFolderPath } from '../store/builtGraphicsFolder.testSupport.js';
import type { StateStore } from '../store/createStateStore.js';
import { createTemporaryDataFolder } from './temporaryDataFolder.testSupport.js';

/** The operator connection the tests send their commands as. */
export const operatorActor = 'operador:conexao-7';

/**
 * The options production uses, on a random port, a temporary database file and data
 * folder, a stand-in theme folder, a silent logger and no BAJAOVRLAY_SOURCE_ALLOWED_HOSTS set.
 * The backups copy the database into a folder of the test's own, not the system's /tmp,
 * which other servers on the machine share.
 */
export function buildBootOptions(migrationsFolder: string) {
  return {
    logger: createLogger({ level: 'silent' }),
    version: '0.3.1',
    host: '127.0.0.1',
    port: 0,
    databasePath: createTemporaryDatabasePath(),
    migrationsFolder,
    graphicPackagesFolder: missingGraphicsFolderPath,
    themeFolder: createStandInThemeFolder(),
    dataFolder: createTemporaryDataFolder(),
    sourceHostAllowlist: noSourceHostAllowlist,
    backupTemporaryFolder: createTemporaryDataFolder(),
  };
}

/** Reads the seeded "Simulador — Enduro" as the store holds it now. */
export function readTheSeededSimulator(stateStore: StateStore): DataSource | undefined {
  return stateStore.readAllSlices().dataSources.find((source) => source.id === 'simulador-enduro');
}
