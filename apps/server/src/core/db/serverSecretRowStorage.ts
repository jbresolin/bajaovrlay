import { eq } from 'drizzle-orm';

import type { ServerDatabase } from './openDatabase.js';
import { serverSecretRows } from './tables.js';

/**
 * The secret stored under `name`, or, when there is none yet, `makeSecret()`'s value,
 * written first. Only the first boot that asks writes it; every later one reads it back.
 * `onConflictDoNothing` keeps the first value should two callers ever race.
 */
export function readOrWriteServerSecret(
  database: ServerDatabase,
  name: string,
  makeSecret: () => string,
): string {
  database
    .insert(serverSecretRows)
    .values({ name, value: makeSecret() })
    .onConflictDoNothing()
    .run();
  const storedRow = database.select().from(serverSecretRows).where(eq(serverSecretRows.name, name)).get();
  if (storedRow === undefined) {
    throw new Error(`the server secret "${name}" could not be stored`);
  }
  return storedRow.value;
}
