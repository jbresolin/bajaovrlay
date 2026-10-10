import { isAbsolute, join } from 'node:path';

/**
 * Turns DATABASE_PATH into an absolute path, reading a relative one from the repository
 * root, not from the folder the server was started in.
 */
export function resolveDatabasePath(databasePath: string, repositoryRootFolder: string): string {
  // `pnpm dev` runs inside apps/server while `pnpm start` may run from anywhere; both
  // must open the same file, so the working directory is never used.
  if (isAbsolute(databasePath)) {
    return databasePath;
  }
  return join(repositoryRootFolder, databasePath);
}
