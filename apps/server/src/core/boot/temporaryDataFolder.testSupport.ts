// Test support: an empty data folder (DATA_DIR) for one test, in the system's temporary
// folder, removed when the test ends, so a booted server never writes into the repository.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { onTestFinished } from 'vitest';

/** Makes an empty data folder for the running test and returns its absolute path. */
export function createTemporaryDataFolder(): string {
  const dataFolder = mkdtempSync(join(tmpdir(), 'bajaovrlay-dados-'));
  onTestFinished(() => rmSync(dataFolder, { recursive: true, force: true }));
  return dataFolder;
}
