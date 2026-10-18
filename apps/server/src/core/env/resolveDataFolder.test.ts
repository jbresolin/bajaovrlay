/**
 * Where the data folder lives (apps/server)
 *
 * What this module is for:
 *   DATA_DIR (see .env.example) says where the server keeps its files other than the
 *   database: the recordings of data sources go in DATA_DIR/recordings/<sourceId>/. A
 *   relative path is read from the repository root, like DATABASE_PATH, so `pnpm dev`
 *   and `pnpm start` use the same folder. The default is apps/server/data, gitignored.
 *
 * What these tests prove:
 *   - Without DATA_DIR the default folder is used, under the repository root.
 *   - A relative DATA_DIR is read from the repository root.
 *   - An absolute DATA_DIR is used exactly as given.
 *
 * What these tests deliberately do not cover:
 *   - Creating the folder; the recorder creates what it writes into.
 */
import { describe, expect, it } from 'vitest';

import { readServerEnvironment } from './readServerEnvironment.js';
import { resolveDataFolder } from './resolveDataFolder.js';

const repositoryRootFolder = '/home/operador/bajaovrlay';

const dataFolderScenarios = [
  // Most installs never set it: the gitignored default next to the database.
  {
    name: 'uses apps/server/data when DATA_DIR is not set',
    environmentVariables: {},
    expectedFolder: '/home/operador/bajaovrlay/apps/server/data',
  },
  // A relative folder must not depend on where the server was started from.
  {
    name: 'reads a relative DATA_DIR from the repository root',
    environmentVariables: { DATA_DIR: 'dados/etapa-piracicaba' },
    expectedFolder: '/home/operador/bajaovrlay/dados/etapa-piracicaba',
  },
  // An absolute folder, for recordings kept on another disk, is taken as is.
  {
    name: 'keeps an absolute DATA_DIR as given',
    environmentVariables: { DATA_DIR: '/var/lib/bajaovrlay' },
    expectedFolder: '/var/lib/bajaovrlay',
  },
];

describe('resolveDataFolder', () => {
  it.each(dataFolderScenarios)('$name', ({ environmentVariables, expectedFolder }) => {
    // Arrange: the server environment read from these variables (from the table above).
    const environment = readServerEnvironment(environmentVariables);

    // Act: work out the data folder's absolute path.
    const dataFolder = resolveDataFolder(environment.DATA_DIR, repositoryRootFolder);

    // Assert: it is the folder the scenario expects.
    expect(dataFolder, 'the data folder must be where the scenario says').toBe(expectedFolder);
  });
});
