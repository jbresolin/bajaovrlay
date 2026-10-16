/**
 * Converting stored items to their `home` at boot (apps/server)
 *
 * What this module is for:
 *   Until BAJAOVRLAY-16 an item said where it lived with `rundownId` (and the concept
 *   page planned a `quickFirePanelId`). Now it says so with `home`, a union of
 *   `{ kind: 'rundown', rundownId }` and `{ kind: 'quickFire', panelId }`. A database
 *   written before keeps items in the older shape, so the boot converts each stored
 *   item before the items row is checked against its schema, and writes the converted
 *   row back in the boot transaction.
 *
 * What these tests prove (with a real SQLite file, rows written in the older shape):
 *   - An item with `rundownId` comes back with a rundown home, and nothing else of it
 *     changes; one with `quickFirePanelId` comes back with a quick-fire home.
 *   - The converted row is written back with the boot time, and one info log line
 *     carries the count; a later boot finds nothing to convert and writes nothing.
 *   - An item with neither field, or with both, stops the boot, as any stored slice
 *     that fails its schema does.
 *
 * What these tests deliberately do not cover:
 *   - The item schema itself; packages/shared/src/rundown/itemHome.test.ts covers it.
 *   - Seeding the panels and macros; loadQuickFireAndMacroSlices.test.ts covers it.
 */
import { describe, expect, it } from 'vitest';

import type { ServerDatabase } from '../db/openDatabase.js';
import { readAllSliceRows, writeSliceRows } from '../db/sliceRowStorage.js';
import { openTemporaryDatabase } from '../db/temporaryDatabase.testSupport.js';
import { createLogger, type ServerLogger } from '../logger/createLogger.js';
import { createRecordingLogger } from '../logger/recordingLogger.testSupport.js';
import { createGraphicsFolderWithBuiltRaceClock } from './builtGraphicsFolder.testSupport.js';
import { loadInitialSlices } from './loadInitialSlices.js';

/** 9 October 2026, 08:00:00 UTC: when the database was first booted, by BAJAOVRLAY-15. */
const firstBootTime = new Date('2026-10-09T08:00:00.000Z');

/** 16 October 2026, 07:30:00 UTC: the first boot of the server with quick-fire panels. */
const upgradeBootTime = new Date('2026-10-16T07:30:00.000Z');

/** 17 October 2026, 07:30:00 UTC: the boot after that. */
const nextMorningBootTime = new Date('2026-10-17T07:30:00.000Z');

/** Boots the slices the way the store does, with the clock reading the given time. */
function loadSlicesAtBoot(database: ServerDatabase, bootTime: Date, logger?: ServerLogger) {
  return loadInitialSlices({
    database,
    graphicPackagesFolder: createGraphicsFolderWithBuiltRaceClock(),
    logger: logger ?? createLogger({ level: 'silent' }),
    readCurrentTime: () => bootTime,
  });
}

/** Builds "Largada do enduro" as BAJAOVRLAY-13 stored it: with `rundownId`, no `home`. */
function buildStartItemInTheOlderShape(): Record<string, unknown> {
  return {
    id: 'item-largada-do-enduro',
    rundownId: 'sessao-principal',
    order: 0,
    graphicId: 'race-clock',
    layerId: 'clock',
    fields: { state: { kind: 'literal', value: 'green' } },
    label: 'Largada do enduro',
    color: 'success',
    notes: 'Entrar quando o diretor de prova baixar a bandeira.',
    autoOutAfterMs: 30_000,
  };
}

/** Builds a lower third for team 42 with the planned `quickFirePanelId`, no `home`. */
function buildShortcutItemInThePlannedShape(): Record<string, unknown> {
  return {
    id: 'item-atalho-tarja-baja-ufpr',
    quickFirePanelId: 'atalhos',
    order: 0,
    graphicId: 'team-lower-third',
    layerId: 'lower-third',
    fields: { teamName: { kind: 'literal', value: 'Baja UFPR' } },
    label: 'Tarja — Baja UFPR',
    color: 'info',
    notes: '',
  };
}

/** Boots once, then overwrites the items row with the given items, as an older server left it. */
function createDatabaseWithStoredItems(storedItems: unknown[]): ServerDatabase {
  const { database } = openTemporaryDatabase();
  loadSlicesAtBoot(database, firstBootTime);
  writeSliceRows(database, [
    { name: 'items', json: storedItems, updatedAt: '2026-10-09T21:15:00.000Z' },
  ]);
  return database;
}

/** Reads the stored items row as it is in the database now. */
function readStoredItemsRow(database: ServerDatabase) {
  return readAllSliceRows(database).find((row) => row.name === 'items');
}

describe('stored items in the older shape, at boot', () => {
  it('gives an item with rundownId a rundown home and keeps everything else', () => {
    // Arrange: the start item stored by BAJAOVRLAY-13, with rundownId.
    const database = createDatabaseWithStoredItems([buildStartItemInTheOlderShape()]);

    // Act: boot the new server on it.
    const slices = loadSlicesAtBoot(database, upgradeBootTime);

    // Assert: the item has a rundown home and no rundownId; the rest is as stored.
    const { rundownId: rundownIdLeftBehind, ...restOfTheItem } = buildStartItemInTheOlderShape();
    expect(rundownIdLeftBehind, 'the older item named the main session').toBe('sessao-principal');
    expect(slices.items, 'rundownId must become a rundown home, nothing else changing').toEqual([
      { ...restOfTheItem, home: { kind: 'rundown', rundownId: 'sessao-principal' } },
    ]);
  });

  it('gives an item with quickFirePanelId a quick-fire home', () => {
    // Arrange: a shortcut item in the shape the concept page planned.
    const database = createDatabaseWithStoredItems([buildShortcutItemInThePlannedShape()]);

    // Act: boot the new server on it.
    const slices = loadSlicesAtBoot(database, upgradeBootTime);

    // Assert: the item has a quick-fire home naming the panel "atalhos".
    expect(
      slices.items.map((item) => item.home),
      'quickFirePanelId must become a quick-fire home',
    ).toEqual([{ kind: 'quickFire', panelId: 'atalhos' }]);
  });

  it('writes the converted row back with the boot time and logs how many were converted', () => {
    // Arrange: both older items stored, and a logger that remembers its lines.
    const database = createDatabaseWithStoredItems([
      buildStartItemInTheOlderShape(),
      buildShortcutItemInThePlannedShape(),
    ]);
    const { logger, readRecordedLines } = createRecordingLogger();

    // Act: boot the new server on it.
    const slices = loadSlicesAtBoot(database, upgradeBootTime, logger);

    // Assert: the database now holds what memory holds, stamped with this boot, and one
    // info line says two items were converted.
    expect(readStoredItemsRow(database), 'the converted items must be saved at boot').toEqual({
      name: 'items',
      json: slices.items,
      updatedAt: '2026-10-16T07:30:00.000Z',
    });
    const conversionLines = readRecordedLines().filter(
      (line) => line.message === 'stored items converted to their home',
    );
    expect(
      conversionLines.map((line) => [line.level, line.converted_items]),
      'one info line must carry the number of items converted',
    ).toEqual([['info', 2]]);
  });

  it('writes nothing on the boot after, when every item already has its home', () => {
    // Arrange: a database already converted by the boot of the 16th.
    const database = createDatabaseWithStoredItems([buildStartItemInTheOlderShape()]);
    loadSlicesAtBoot(database, upgradeBootTime);

    // Act: boot again the next morning.
    loadSlicesAtBoot(database, nextMorningBootTime);

    // Assert: the items row still carries the time of the boot that converted it.
    expect(
      readStoredItemsRow(database)?.updatedAt,
      'a boot with nothing to convert must not rewrite the items row',
    ).toBe('2026-10-16T07:30:00.000Z');
  });

  const refusedStoredItemScenarios = [
    // An item that says nowhere where it lives cannot be shown in any column.
    {
      name: 'stops the boot for an item with neither rundownId nor quickFirePanelId',
      storedItem: { ...buildStartItemInTheOlderShape(), rundownId: undefined },
    },
    // An item claiming two homes is damaged; guessing one would hide that.
    {
      name: 'stops the boot for an item with both rundownId and quickFirePanelId',
      storedItem: { ...buildStartItemInTheOlderShape(), quickFirePanelId: 'atalhos' },
    },
  ];

  it.each(refusedStoredItemScenarios)('$name', ({ storedItem }) => {
    // Arrange: a database holding this row's damaged item.
    const database = createDatabaseWithStoredItems([storedItem]);

    // Act: boot the new server on it.
    const bootOnTheDamagedItem = () => loadSlicesAtBoot(database, upgradeBootTime);

    // Assert: the boot stops, as for any stored slice that fails its schema.
    expect(bootOnTheDamagedItem, 'an item without exactly one home must stop the boot').toThrow();
  });
});
