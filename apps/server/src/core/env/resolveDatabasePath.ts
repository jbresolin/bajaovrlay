import { isAbsolute, join } from 'node:path';

/**
 * Turns DATABASE_PATH into an absolute path. A relative path is read from the
 * repository root, not from the folder the server was started in: `pnpm dev` runs
 * inside apps/server while `pnpm start` may run from anywhere, and both must open the
 * same file.
 */
export function resolveDatabasePath(databasePath: string, repositoryRootFolder: string): string {
  if (isAbsolute(databasePath)) {
    return databasePath;
  }
  return join(repositoryRootFolder, databasePath);
}
