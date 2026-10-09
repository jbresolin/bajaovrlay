/**
 * Where the database file lives (apps/server)
 *
 * What this module is for:
 *   DATABASE_PATH (see .env.example) says where the SQLite file is. A relative path is
 *   read from the repository root, not from the folder the server was started in, so
 *   `pnpm dev` (which runs inside apps/server) and `pnpm start` from the root use the
 *   same file. When DATABASE_PATH is not set, the default is
 *   apps/server/data/bajaovrlay.sqlite, which is gitignored.
 *
 * What these tests prove:
 *   - Without DATABASE_PATH the default path is used, under the repository root.
 *   - A relative DATABASE_PATH is read from the repository root.
 *   - An absolute DATABASE_PATH is used exactly as given.
 *
 * What these tests deliberately do not cover:
 *   - Creating the folder or the file; openDatabase does that.
 */
import { describe, expect, it } from 'vitest';

import { readServerEnvironment } from './readServerEnvironment.js';
import { resolveDatabasePath } from './resolveDatabasePath.js';

const repositoryRootFolder = '/home/operador/bajaovrlay';

const databasePathScenarios = [
  // Most installs never set it: the gitignored default under apps/server/data.
  {
    name: 'uses apps/server/data/bajaovrlay.sqlite when DATABASE_PATH is not set',
    environmentVariables: {},
    expectedPath: '/home/operador/bajaovrlay/apps/server/data/bajaovrlay.sqlite',
  },
  // A relative path must not depend on where the server was started from.
  {
    name: 'reads a relative DATABASE_PATH from the repository root',
    environmentVariables: { DATABASE_PATH: 'dados/etapa-piracicaba.sqlite' },
    expectedPath: '/home/operador/bajaovrlay/dados/etapa-piracicaba.sqlite',
  },
  // An absolute path, for a database kept outside the repository, is taken as is.
  {
    name: 'keeps an absolute DATABASE_PATH as given',
    environmentVariables: { DATABASE_PATH: '/var/lib/bajaovrlay/etapa-piracicaba.sqlite' },
    expectedPath: '/var/lib/bajaovrlay/etapa-piracicaba.sqlite',
  },
];

describe('resolveDatabasePath', () => {
  it.each(databasePathScenarios)('$name', ({ environmentVariables, expectedPath }) => {
    // Arrange: the server environment read from these variables (from the table above).
    const environment = readServerEnvironment(environmentVariables);

    // Act: work out the database file's absolute path.
    const databasePath = resolveDatabasePath(environment.DATABASE_PATH, repositoryRootFolder);

    // Assert: it is the path the scenario expects.
    expect(databasePath, 'the database must be where the scenario says').toBe(expectedPath);
  });
});
