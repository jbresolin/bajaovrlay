import { eq, lte } from 'drizzle-orm';

import type { ServerDatabase } from './openDatabase.js';
import { type OperatorSessionRow, operatorSessionRows } from './tables.js';

/** Reads every stored operator session, expired ones included. */
export function readOperatorSessionRows(database: ServerDatabase): OperatorSessionRow[] {
  return database.select().from(operatorSessionRows).all();
}

/** Writes one new operator session (a login). */
export function writeOperatorSessionRow(database: ServerDatabase, row: OperatorSessionRow): void {
  database.insert(operatorSessionRows).values(row).run();
}

/** Deletes one operator session ("Sair"); nothing happens when it is already gone. */
export function deleteOperatorSessionRow(database: ServerDatabase, sessionId: string): void {
  database.delete(operatorSessionRows).where(eq(operatorSessionRows.sessionId, sessionId)).run();
}

/**
 * Deletes every session that ended at or before `now` (ISO 8601 text, which sorts as
 * time does), so the table holds only open sessions plus those expired since the last call.
 */
export function deleteOperatorSessionRowsEndedBy(database: ServerDatabase, now: string): void {
  database.delete(operatorSessionRows).where(lte(operatorSessionRows.expiresAt, now)).run();
}
