/**
 * Loading or seeding the quick-fire panels and macros at boot (apps/server)
 *
 * What this module is for:
 *   The `quickFirePanels` and `macros` slices are the operator's work, saved like the
 *   rundowns: loaded from the database as they are, or seeded when their row is missing
 *   (a first boot, or a database written before BAJAOVRLAY-16). The seed is one panel,
 *   "Atalhos" (fixed id `atalhos`), and no macro. The `macroRuns` slice is never saved:
 *   every boot starts it empty, so a macro that was running when the server stopped is
 *   not resumed.
 *
 * What these tests prove (with a real SQLite file):
 *   - A first boot seeds "Atalhos" and no macro, saves both rows with the boot time,
 *     and starts with no macro running and no macroRuns row.
 *   - A database written before quick-fire panels boots and gets the same seed, and
 *     its other rows are not rewritten.
 *   - A later boot loads the stored panels and macros back and does not seed again,
 *     even when the operator deleted every macro.
 *   - A stored panels or macros row that fails its schema stops the boot.
 *
 * What these tests deliberately do not cover:
 *   - Rundowns and items at boot; loadRundownSlices.test.ts and itemHomeMigration.test.ts.
 *   - A macro run cut short by a restart; storeMacroRun.test.ts covers it.
 */
import { describe, expect, it } from 'vitest';

import type { ServerDatabase } from '../db/openDatabase.js';
import { readAllSliceRows, writeSliceRows } from '../db/sliceRowStorage.js';
import { openTemporaryDatabase } from '../db/temporaryDatabase.testSupport.js';
import { createLogger } from '../logger/createLogger.js';
import { createGraphicsFolderWithBuiltRaceClock } from './builtGraphicsFolder.testSupport.js';
import { loadInitialSlices } from './loadInitialSlices.js';

/** 9 October 2026, 08:00:00 UTC: when the database of these tests was first booted. */
const firstBootTime = new Date('2026-10-09T08:00:00.000Z');

/** 16 October 2026, 07:30:00 UTC: a later boot. */
const laterBootTime = new Date('2026-10-16T07:30:00.000Z');

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

/** Builds the macro "Abrir a sessão" as the operator saved it. */
function buildOpenTheSessionMacro() {
  return {
    id: 'macro-abrir-sessao',
    label: 'Abrir a sessão',
    color: 'success',
    steps: [
      { kind: 'takeItem', itemId: 'item-relogio-do-enduro' },
      { kind: 'wait', ms: 500 },
      { kind: 'takeItem', itemId: 'item-logo-baja-sae' },
    ],
  };
}

describe('the quick-fire panels and macros on the first boot', () => {
  it('seeds "Atalhos" (and the seeded panels after it) and only the sponsor roll’s macro, saves both rows, and starts with no run', () => {
    // Arrange: a brand-new database file.
    const { database } = openTemporaryDatabase();

    // Act: load the slices, as the first boot does.
    const slices = loadSlicesAtBoot(database, firstBootTime);

    // Assert: "Atalhos", then "Logo" (seeded with the channel logo, BAJAOVRLAY-63;
    // store/seededChannelLogo.test.ts covers it), "Chave" (the Super Prime's match graphics,
    // BAJAOVRLAY-65), then "Patrocinadores" with the plain sponsor roll's macro (BAJAOVRLAY-64;
    // store/seededPlainSponsorRoll.test.ts covers them), and no "Avisos": the event templates
    // live in "Modelos de evento" since BAJAOVRLAY-67 (modules/events covers it); no other
    // macro, no run, and the two rows saved with the boot time.
    expect(slices.quickFirePanels, 'the first boot must seed exactly these panels').toEqual([
      { id: 'atalhos', name: 'Atalhos', order: 0 },
      { id: 'logo', name: 'Logo', order: 1 },
      { id: 'chave', name: 'Chave', order: 2 },
      { id: 'patrocinadores', name: 'Patrocinadores', order: 3 },
    ]);
    expect(
      slices.macros.map((macro) => macro.id),
      'only the sponsor roll’s macro exists on the first boot',
    ).toEqual(['patrocinadores-simples']);
    expect(slices.macroRuns, 'no macro is running at boot').toEqual([]);
    const storedRows = readAllSliceRows(database);
    expect(
      storedRows.find((row) => row.name === 'quickFirePanels'),
      'the seeded panel must be saved, so the next boot loads it',
    ).toEqual({
      name: 'quickFirePanels',
      json: [
        { id: 'atalhos', name: 'Atalhos', order: 0 },
        { id: 'logo', name: 'Logo', order: 1 },
        { id: 'chave', name: 'Chave', order: 2 },
        { id: 'patrocinadores', name: 'Patrocinadores', order: 3 },
      ],
      updatedAt: '2026-10-09T08:00:00.000Z',
    });
    expect(
      storedRows.find((row) => row.name === 'macros'),
      'the macros list must be saved too',
    ).toEqual({ name: 'macros', json: slices.macros, updatedAt: '2026-10-09T08:00:00.000Z' });
    expect(
      storedRows.some((row) => row.name === 'macroRuns'),
      'the runs live in memory only and must never get a row',
    ).toBe(false);
  });
});

describe('the quick-fire panels and macros on a database written before they existed', () => {
  it('boots, seeds both and leaves the rows that were there as they were', () => {
    // Arrange: a database booted once, then stripped of the two rows, as BAJAOVRLAY-15
    // left it.
    const { database } = openTemporaryDatabase();
    loadSlicesAtBoot(database, firstBootTime);
    database.$client
      .prepare("DELETE FROM slices WHERE name IN ('quickFirePanels', 'macros')")
      .run();

    // Act: boot the new server on it a week later.
    const slices = loadSlicesAtBoot(database, laterBootTime);

    // Assert: the seed is there, saved now, and only graphics was rewritten besides.
    expect(
      slices.quickFirePanels.map((panel) => panel.name),
      'an older database must get the seeded panel',
    ).toEqual(['Atalhos']);
    expect(
      readUpdatedAtBySliceName(database),
      'only graphics (refreshed every boot), quickFirePanels and macros may be written',
    ).toEqual({
      // Seeded at the first boot (BAJAOVRLAY-49) with the layers, left alone afterwards.
      outputs: '2026-10-09T08:00:00.000Z',
      layers: '2026-10-09T08:00:00.000Z',
      graphics: '2026-10-16T07:30:00.000Z',
      instances: '2026-10-09T08:00:00.000Z',
      rundowns: '2026-10-09T08:00:00.000Z',
      items: '2026-10-09T08:00:00.000Z',
      quickFirePanels: '2026-10-16T07:30:00.000Z',
      macros: '2026-10-16T07:30:00.000Z',
      // Seeded at the first boot (BAJAOVRLAY-17), off, so a later boot leaves it alone.
      dataSources: '2026-10-09T08:00:00.000Z',
      // The default event rules, seeded at the first boot too (BAJAOVRLAY-44).
      eventRules: '2026-10-09T08:00:00.000Z',
      // The plain sponsor roll's trigger, seeded once at the first boot (BAJAOVRLAY-64).
      triggers: '2026-10-09T08:00:00.000Z',
    });
  });
});

describe('the quick-fire panels and macros on a later boot', () => {
  it('loads back what the operator left, and does not seed a panel or a macro again', () => {
    // Arrange: the operator renamed "Atalhos", added a sponsors panel and one macro.
    const { database } = openTemporaryDatabase();
    loadSlicesAtBoot(database, firstBootTime);
    const panelsLeftByTheOperator = [
      { id: 'atalhos', name: 'Atalhos do enduro', order: 0 },
      { id: 'patrocinadores', name: 'Patrocinadores', order: 1 },
    ];
    writeSliceRows(database, [
      {
        name: 'quickFirePanels',
        json: panelsLeftByTheOperator,
        updatedAt: '2026-10-09T21:15:00.000Z',
      },
      { name: 'macros', json: [buildOpenTheSessionMacro()], updatedAt: '2026-10-09T21:15:00.000Z' },
    ]);

    // Act: boot again.
    const slices = loadSlicesAtBoot(database, laterBootTime);

    // Assert: both come back as stored and neither row is rewritten.
    expect(slices.quickFirePanels, 'the stored panels must come back').toEqual(
      panelsLeftByTheOperator,
    );
    expect(slices.macros, 'the stored macro must come back').toEqual([buildOpenTheSessionMacro()]);
    const updatedAtBySliceName = readUpdatedAtBySliceName(database);
    expect(
      [updatedAtBySliceName.quickFirePanels, updatedAtBySliceName.macros],
      'a boot that finds both rows must not write them again',
    ).toEqual(['2026-10-09T21:15:00.000Z', '2026-10-09T21:15:00.000Z']);
  });

  const damagedRowScenarios = [
    // A panel without a name: a hand edit gone wrong.
    {
      name: 'stops the boot when a stored panel has no name',
      sliceName: 'quickFirePanels',
      json: [{ id: 'atalhos', order: 0 }],
    },
    // A macro with a wait over the limit could hold a show for a minute.
    {
      name: 'stops the boot when a stored macro has a wait of a minute',
      sliceName: 'macros',
      json: [{ ...buildOpenTheSessionMacro(), steps: [{ kind: 'wait', ms: 60_000 }] }],
    },
  ];

  it.each(damagedRowScenarios)('$name', ({ sliceName, json }) => {
    // Arrange: a booted database whose row of this scenario was damaged.
    const { database } = openTemporaryDatabase();
    loadSlicesAtBoot(database, firstBootTime);
    writeSliceRows(database, [{ name: sliceName, json, updatedAt: '2026-10-09T21:15:00.000Z' }]);

    // Act: load the slices, as the next boot does.
    const bootOnTheDamagedRow = () => loadSlicesAtBoot(database, laterBootTime);

    // Assert: the boot stops, as it does for every other slice it cannot read.
    expect(bootOnTheDamagedRow, 'a damaged stored row must stop the boot').toThrow();
  });
});
