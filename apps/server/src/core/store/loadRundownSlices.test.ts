/**
 * Loading or seeding the rundowns and items at boot (apps/server)
 *
 * What this module is for:
 *   The `rundowns` and `items` slices are the operator's work, so they are loaded from
 *   the database as they are. When a row is missing it is seeded: `rundowns` with the
 *   single rundown "Sessão principal", `items` with an empty list. A row is missing on
 *   the very first boot, and also on a database written before rundowns existed (M0),
 *   which has layers, graphics and instances but nothing else.
 *
 * What these tests prove (with a real SQLite file and a stand-in graphics folder):
 *   - A first boot seeds the rundown "Sessão principal", with no items and its cursor
 *     on nothing, and saves both rows stamped with the store's clock.
 *   - A database written by M0 boots, gets the same seed, and keeps its layers and
 *     instances rows exactly as they were.
 *   - A later boot loads the stored rundowns and items back and does not seed again,
 *     an item whose fields read from a data source (BAJAOVRLAY-20) included.
 *   - A stored items row that fails its schema stops the boot.
 *
 * What these tests deliberately do not cover:
 *   - Layers, instances and graphics at boot; loadInitialSlices.test.ts covers them.
 *   - Rundowns and items changed by commands surviving a restart;
 *     storeRundownCommands.test.ts covers it.
 */
import type { Item, Rundown } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import type { ServerDatabase } from '../db/openDatabase.js';
import { readAllSliceRows, writeSliceRows } from '../db/sliceRowStorage.js';
import { openTemporaryDatabase } from '../db/temporaryDatabase.testSupport.js';
import { createLogger } from '../logger/createLogger.js';
import { createGraphicsFolderWithBuiltRaceClock } from './builtGraphicsFolder.testSupport.js';
import { loadInitialSlices } from './loadInitialSlices.js';

/** 9 October 2026, 08:00:00 UTC: when the database of these tests was first booted. */
const firstBootTime = new Date('2026-10-09T08:00:00.000Z');

/** 10 October 2026, 07:30:00 UTC: the boot on the morning of the enduro. */
const raceDayBootTime = new Date('2026-10-10T07:30:00.000Z');

/** The one rundown the server seeds. */
const seededMainSessionRundown: Rundown = {
  id: 'sessao-principal',
  name: 'Sessão principal',
  sessionLabel: '',
  cursorItemId: null,
};

/** Boots the slices the way the store does, with the clock reading the given time. */
function loadSlicesAtBoot(database: ServerDatabase, bootTime: Date) {
  return loadInitialSlices({
    database,
    graphicPackagesFolder: createGraphicsFolderWithBuiltRaceClock(),
    logger: createLogger({ level: 'silent' }),
    readCurrentTime: () => bootTime,
  });
}

/** Reads when each stored slice row was last written, by slice name. */
function readUpdatedAtBySliceName(database: ServerDatabase): Record<string, string> {
  const updatedAtBySliceName: Record<string, string> = {};
  for (const row of readAllSliceRows(database)) {
    updatedAtBySliceName[row.name] = row.updatedAt;
  }
  return updatedAtBySliceName;
}

/** Builds the rundown as the operator left it: renamed, its cursor on the start item. */
function buildRenamedRundownWithCursor(): Rundown {
  return {
    id: 'sessao-principal',
    name: 'Enduro de sábado',
    sessionLabel: 'Enduro de Resistência',
    cursorItemId: 'item-largada-do-enduro',
  };
}

/** Builds the one item the operator prepared: the race clock for the start. */
function buildEnduroStartItem(): Item {
  return {
    id: 'item-largada-do-enduro',
    home: { kind: 'rundown', rundownId: 'sessao-principal' },
    order: 0,
    graphicId: 'race-clock',
    layerId: 'clock',
    fields: { state: { kind: 'literal', value: 'green' } },
    label: 'Largada do enduro',
    color: 'success',
    notes: '',
  };
}

describe('the rundowns and items on the first boot', () => {
  it('seeds the rundown "Sessão principal" with no items and saves both rows', () => {
    // Arrange: a brand-new database file.
    const { database } = openTemporaryDatabase();

    // Act: load the slices, as the first boot does.
    const slices = loadSlicesAtBoot(database, firstBootTime);

    // Assert: one rundown, no items in it, and both are saved with the boot time. The only
    // items are the two notice items of the panel "Avisos", seeded with the event rules
    // (BAJAOVRLAY-44; modules/events covers them).
    expect(slices.rundowns, 'the first boot must seed exactly this rundown').toEqual([
      seededMainSessionRundown,
    ]);
    expect(
      slices.items.filter((item) => item.home.kind === 'rundown'),
      'no item exists in the rundown on the first boot',
    ).toEqual([]);
    const storedRows = readAllSliceRows(database);
    expect(
      storedRows.find((row) => row.name === 'rundowns'),
      'the seeded rundown must be saved, so the next boot loads it',
    ).toEqual({
      name: 'rundowns',
      json: [seededMainSessionRundown],
      updatedAt: '2026-10-09T08:00:00.000Z',
    });
    expect(
      storedRows.find((row) => row.name === 'items'),
      'the items list must be saved too',
    ).toEqual({ name: 'items', json: slices.items, updatedAt: '2026-10-09T08:00:00.000Z' });
  });
});

describe('the rundowns and items on a database written before they existed (M0)', () => {
  it('boots, seeds the rundown and leaves the layers and instances rows as they were', () => {
    // Arrange: a database booted once, then stripped of its rundowns, items, panels and
    // macros rows, so it holds what an M0 server wrote: layers, graphics and instances.
    const { database } = openTemporaryDatabase();
    loadSlicesAtBoot(database, firstBootTime);
    database.$client
      .prepare(
        "DELETE FROM slices WHERE name IN ('rundowns', 'items', 'quickFirePanels', 'macros')",
      )
      .run();

    // Act: boot the new server on it the next morning.
    const slices = loadSlicesAtBoot(database, raceDayBootTime);

    // Assert: it booted with the seeded rundown, saved it, and did not rewrite the
    // operator's layers and instances.
    expect(slices.rundowns, 'an M0 database must get the seeded rundown').toEqual([
      seededMainSessionRundown,
    ]);
    expect(slices.items, 'an M0 database starts with no items').toEqual([]);
    expect(slices.layers.length, 'the eight stored layers must load back').toBe(8);
    expect(
      readUpdatedAtBySliceName(database),
      'only graphics (refreshed every boot) and the seeded rows may be written by this boot',
    ).toEqual({
      // Seeded at the first boot (BAJAOVRLAY-49) with the layers, left alone afterwards.
      outputs: '2026-10-09T08:00:00.000Z',
      layers: '2026-10-09T08:00:00.000Z',
      graphics: '2026-10-10T07:30:00.000Z',
      instances: '2026-10-09T08:00:00.000Z',
      rundowns: '2026-10-10T07:30:00.000Z',
      items: '2026-10-10T07:30:00.000Z',
      quickFirePanels: '2026-10-10T07:30:00.000Z',
      macros: '2026-10-10T07:30:00.000Z',
      // Seeded at the first boot (BAJAOVRLAY-17), off, so a later boot leaves it alone.
      dataSources: '2026-10-09T08:00:00.000Z',
      // The default event rules, seeded at the first boot too (BAJAOVRLAY-44).
      eventRules: '2026-10-09T08:00:00.000Z',
      // The inbox's one-time seeds remembered, at the first boot too (BAJAOVRLAY-35).
      eventInboxSeedsApplied: '2026-10-09T08:00:00.000Z',
    });
  });
});

describe('the rundowns and items on a later boot', () => {
  it('loads back what the operator left and does not seed again', () => {
    // Arrange: a booted database where the operator renamed the rundown and prepared
    // one item, saved the evening before the race.
    const { database } = openTemporaryDatabase();
    loadSlicesAtBoot(database, firstBootTime);
    writeSliceRows(database, [
      {
        name: 'rundowns',
        json: [buildRenamedRundownWithCursor()],
        updatedAt: '2026-10-09T21:15:00.000Z',
      },
      { name: 'items', json: [buildEnduroStartItem()], updatedAt: '2026-10-09T21:15:00.000Z' },
    ]);

    // Act: boot again on the morning of the race.
    const slices = loadSlicesAtBoot(database, raceDayBootTime);

    // Assert: the operator's rundown, cursor and item are back, and neither row was
    // rewritten by the boot.
    expect(slices.rundowns, 'the stored rundown must come back with its cursor').toEqual([
      buildRenamedRundownWithCursor(),
    ]);
    expect(slices.items, 'the stored item must come back').toEqual([buildEnduroStartItem()]);
    const updatedAtBySliceName = readUpdatedAtBySliceName(database);
    expect(
      [updatedAtBySliceName.rundowns, updatedAtBySliceName.items],
      'a boot that finds both rows must not write them again',
    ).toEqual(['2026-10-09T21:15:00.000Z', '2026-10-09T21:15:00.000Z']);
  });

  it('loads back an item whose flag and whole clock are bound to the simulator', () => {
    // Arrange: a booted database holding "Relógio do enduro — fonte", saved with
    // bindings the evening before the race.
    const { database } = openTemporaryDatabase();
    loadSlicesAtBoot(database, firstBootTime);
    const boundClockItem: Item = {
      ...buildEnduroStartItem(),
      label: 'Relógio do enduro — fonte',
      fields: {
        sessionName: { kind: 'literal', value: 'Enduro de Resistência' },
        state: {
          kind: 'binding',
          sourceId: 'simulador-enduro',
          shapeKey: 'session',
          path: 'state',
          isLive: true,
        },
        referenceTimeMs: {
          kind: 'binding',
          sourceId: 'simulador-enduro',
          shapeKey: 'session',
          path: 'clock',
          isLive: true,
        },
      },
    };
    writeSliceRows(database, [
      { name: 'items', json: [boundClockItem], updatedAt: '2026-10-09T21:15:00.000Z' },
    ]);

    // Act: boot again on the morning of the race.
    const slices = loadSlicesAtBoot(database, raceDayBootTime);

    // Assert: the item and its bindings are back exactly as saved.
    expect(slices.items, 'the bound item must come back as saved').toEqual([boundClockItem]);
  });

  it('stops the boot when the stored items fail their schema', () => {
    // Arrange: a booted database whose items row was damaged into an item with no
    // rundown, graphic or layer, as a hand edit might leave it.
    const { database } = openTemporaryDatabase();
    loadSlicesAtBoot(database, firstBootTime);
    writeSliceRows(database, [
      {
        name: 'items',
        json: [{ id: 'item-largada-do-enduro', label: 'Largada do enduro' }],
        updatedAt: '2026-10-09T21:15:00.000Z',
      },
    ]);

    // Act: load the slices, as the next boot does.
    const loadTheDamagedItems = () => loadSlicesAtBoot(database, raceDayBootTime);

    // Assert: the boot stops, as it does for every other slice it cannot read.
    expect(loadTheDamagedItems, 'damaged items must stop the boot').toThrow();
  });
});
