import type { ServerDatabase } from './openDatabase.js';
import { seedDoneRows } from './tables.js';

/** The names of the one-off seeds this database has had, in no particular order. */
export function readSeedNamesDone(database: ServerDatabase): string[] {
  return database
    .select()
    .from(seedDoneRows)
    .all()
    .map((row) => row.name);
}

/**
 * Records seeds as done, inside the caller's transaction (or on their own if there is
 * none). A name already recorded keeps its first time: a seed is done once.
 */
export function writeSeedNamesDone(
  database: ServerDatabase,
  seedNames: string[],
  doneAt: string,
): void {
  for (const seedName of seedNames) {
    database.insert(seedDoneRows).values({ name: seedName, doneAt }).onConflictDoNothing().run();
  }
}
