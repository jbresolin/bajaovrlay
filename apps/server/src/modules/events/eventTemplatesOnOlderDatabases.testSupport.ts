// Test support: a closed database rewritten as one written before BAJAOVRLAY-67, when the
// event templates were buttons of the quick-fire panel "Avisos", and the one-off seeds a
// database remembers. Every function opens and closes its own connection.
import type { Item } from '@bajaovrlay/shared';

import { openDatabaseForTests } from '../../core/db/temporaryDatabase.testSupport.js';

/** The ids of the seeded templates, in the order "Avisos" held them. */
const seededTemplateIdsInOrder = ['volta-mais-rapida', 'penalidade', 'super-chat'];

/**
 * Rewrites a closed database as it was before BAJAOVRLAY-67: the panel "Avisos" between
 * "Atalhos" and "Logo", the seeded templates still in the database put back on it in their
 * order, the items given added as they are, and no seeds_done row for the move.
 */
export function makeTheDatabaseOlderThanTemplatesInRegras(
  databasePath: string,
  itemsTheOperatorAdded: Item[],
): void {
  const database = openDatabaseForTests(databasePath);
  const readSlice = (name: string): unknown =>
    JSON.parse(
      (
        database.$client.prepare('SELECT json FROM slices WHERE name = ?').get(name) as {
          json: string;
        }
      ).json,
    );
  const writeSlice = (name: string, value: unknown): void => {
    database.$client
      .prepare('UPDATE slices SET json = ? WHERE name = ?')
      .run(JSON.stringify(value), name);
  };

  writeSlice('quickFirePanels', [
    { id: 'atalhos', name: 'Atalhos', order: 0 },
    { id: 'avisos', name: 'Avisos', order: 1 },
    { id: 'logo', name: 'Logo', order: 2 },
  ]);
  const items = readSlice('items') as Item[];
  const itemsOnAvisos = items.map((item) => {
    const orderOnAvisos = seededTemplateIdsInOrder.indexOf(item.id);
    if (orderOnAvisos === -1) {
      return item;
    }
    return { ...item, home: { kind: 'quickFire', panelId: 'avisos' }, order: orderOnAvisos };
  });
  writeSlice('items', [...itemsOnAvisos, ...itemsTheOperatorAdded]);
  database.$client
    .prepare("DELETE FROM seeds_done WHERE name = 'eventTemplatesOffQuickFire'")
    .run();
  database.$client.close();
}

/** The names of the one-off seeds a closed database records as done. */
export function readSeedNamesDoneOfDatabase(databasePath: string): string[] {
  const database = openDatabaseForTests(databasePath);
  const rows = database.$client.prepare('SELECT name FROM seeds_done').all() as Array<{
    name: string;
  }>;
  database.$client.close();
  return rows.map((row) => row.name);
}
