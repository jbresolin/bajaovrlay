import { isAbsolute, join } from 'node:path';

/**
 * Turns DATA_DIR into an absolute folder, reading a relative one from the repository
 * root, not from the folder the server was started in (the same rule as DATABASE_PATH).
 */
export function resolveDataFolder(dataFolder: string, repositoryRootFolder: string): string {
  // `pnpm dev` runs inside apps/server while `pnpm start` may run from anywhere; both
  // must write recordings to the same folder, so the working directory is never used.
  if (isAbsolute(dataFolder)) {
    return dataFolder;
  }
  return join(repositoryRootFolder, dataFolder);
}
