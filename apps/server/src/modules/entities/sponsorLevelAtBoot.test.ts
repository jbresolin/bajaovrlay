/**
 * A stored sponsor's level at boot: "master" read as "diamante" (apps/server)
 *
 * What this module is for:
 *   BAJAOVRLAY-46 renames the top sponsor level from "master" to the design's "diamante"
 *   and adds "realizacao", the organiser. The `sponsors` slice is saved, so a database
 *   written before holds sponsors with `tier: "master"`, which the new schema refuses; and
 *   a stored row that fails its schema stops the boot. So the stored row is migrated
 *   first, then checked: sponsorLevelMigration.ts reads every "master" as "diamante".
 *
 * What these tests prove:
 *   - The migration turns a stored "master" into "diamante", leaves every other sponsor
 *     (and anything that is not a sponsor) as it was, and changes nothing it was given.
 *   - With a real SQLite file, a sponsors row stored with "master" boots, the sponsor at
 *     Diamante and the rest of it untouched, and a row already in the new levels boots
 *     unchanged.
 *   - A stored level that is neither old nor new still stops the boot: nothing is guessed.
 *
 * What these tests deliberately do not cover:
 *   - The six levels and their order; packages/shared's sponsorLevels.test.ts.
 *   - The CSV, which takes "master" as an alias; the control page's entityCsvImport.test.ts.
 */
import { buildFakeMediaId } from '@bajaovrlay/shared/fakeMediaIds.testSupport';
import { describe, expect, it } from 'vitest';

import type { ServerDatabase } from '../../core/db/openDatabase.js';
import { writeSliceRows } from '../../core/db/sliceRowStorage.js';
import { openTemporaryDatabase } from '../../core/db/temporaryDatabase.testSupport.js';
import { createLogger } from '../../core/logger/createLogger.js';
import { createGraphicsFolderWithBuiltRaceClock } from '../../core/store/builtGraphicsFolder.testSupport.js';
import { loadInitialSlices } from '../../core/store/loadInitialSlices.js';
import { readStoredSponsorsInTheDesignsLevels } from './sponsorLevelMigration.js';

/** 25 October 2026, 08:00:00 UTC: the boot of these tests. */
const bootTime = new Date('2026-10-25T08:00:00.000Z');

/** Boots the slices the way the store does. */
function loadSlicesAtBoot(database: ServerDatabase) {
  return loadInitialSlices({
    database,
    graphicPackagesFolder: createGraphicsFolderWithBuiltRaceClock(),
    logger: createLogger({ level: 'silent' }),
    readCurrentTime: () => bootTime,
  });
}

/** The sponsors as BAJAOVRLAY-23's Cadastros saved them: Bosch at "master", Pneus Trilha at apoio. */
function buildSponsorsSavedWithTheOldTopLevel() {
  return [
    {
      sponsorId: 'bosch',
      name: 'Bosch',
      tier: 'master',
      rollWeight: 10,
      logoMediaId: buildFakeMediaId(7),
      logoOnLightPlate: true,
    },
    { sponsorId: 'apoio-pneus', name: 'Pneus Trilha', tier: 'apoio', rollWeight: 2 },
  ];
}

describe('readStoredSponsorsInTheDesignsLevels', () => {
  it('reads a stored "master" as "diamante" and leaves the other sponsors as they were', () => {
    // Arrange: the two sponsors as an old database holds them.
    const storedSponsors = buildSponsorsSavedWithTheOldTopLevel();

    // Act: migrate them.
    const migratedSponsors = readStoredSponsorsInTheDesignsLevels(storedSponsors);

    // Assert: Bosch at Diamante with everything else kept; Pneus Trilha untouched.
    const [bosch, pneusTrilha] = buildSponsorsSavedWithTheOldTopLevel();
    expect(migratedSponsors, 'only the old top level may change').toEqual([
      { ...bosch, tier: 'diamante' },
      pneusTrilha,
    ]);
  });

  it('changes nothing it was given, so a refused boot leaves the stored value as it was', () => {
    // Arrange: the old sponsors, and a copy to compare with afterwards.
    const storedSponsors = buildSponsorsSavedWithTheOldTopLevel();

    // Act: migrate them.
    readStoredSponsorsInTheDesignsLevels(storedSponsors);

    // Assert: the value handed in still says "master".
    expect(storedSponsors, 'the migration must be pure').toEqual(
      buildSponsorsSavedWithTheOldTopLevel(),
    );
  });

  const valuesThatAreNotASponsorList = [
    // A database written before BAJAOVRLAY-19 has no sponsors row: the loader reads [].
    { name: 'hands back an empty list as it is', storedValue: [] },
    // A damaged row is the schema's to refuse, not the migration's to mend.
    { name: 'hands back a row that is not a list as it is', storedValue: { bosch: 'master' } },
    // An element that is not an object cannot carry a level.
    { name: 'hands back an element that is not an object', storedValue: ['master'] },
  ];

  it.each(valuesThatAreNotASponsorList)('$name', ({ storedValue }) => {
    // Arrange: the stored value of this row.

    // Act: migrate it.
    const migratedValue = readStoredSponsorsInTheDesignsLevels(storedValue);

    // Assert: the same value back, for the schema to judge.
    expect(migratedValue, 'anything but a sponsor at "master" must pass through').toEqual(
      storedValue,
    );
  });
});

describe('the sponsors slice at boot', () => {
  it('boots a sponsors row stored with "master", the sponsor at Diamante', () => {
    // Arrange: a database booted once, whose sponsors row was then written before
    // BAJAOVRLAY-46, with the old name of the top level.
    const { database } = openTemporaryDatabase();
    loadSlicesAtBoot(database);
    writeSliceRows(database, [
      {
        name: 'sponsors',
        json: buildSponsorsSavedWithTheOldTopLevel(),
        updatedAt: '2026-10-23T21:15:00.000Z',
      },
    ]);

    // Act: boot.
    const slices = loadSlicesAtBoot(database);

    // Assert: the boot went on, Bosch at Diamante, nothing else changed.
    const [bosch, pneusTrilha] = buildSponsorsSavedWithTheOldTopLevel();
    expect(slices.sponsors, 'an old top level must boot as Diamante').toEqual([
      { ...bosch, tier: 'diamante' },
      pneusTrilha,
    ]);
  });

  it('boots a sponsors row already in the design’s levels unchanged', () => {
    // Arrange: a database whose sponsors were saved after BAJAOVRLAY-46, the organiser
    // among them.
    const { database } = openTemporaryDatabase();
    loadSlicesAtBoot(database);
    const sponsorsInTheNewLevels = [
      { sponsorId: 'bosch', name: 'Bosch', tier: 'diamante', rollWeight: 10 },
      { sponsorId: 'sae-brasil', name: 'SAE Brasil', tier: 'realizacao', rollWeight: 5 },
    ];
    writeSliceRows(database, [
      { name: 'sponsors', json: sponsorsInTheNewLevels, updatedAt: '2026-10-25T07:00:00.000Z' },
    ]);

    // Act: boot.
    const slices = loadSlicesAtBoot(database);

    // Assert: exactly as stored.
    expect(slices.sponsors, 'a row in the new levels must boot as it was').toEqual(
      sponsorsInTheNewLevels,
    );
  });

  it('still stops the boot on a level that is neither the old name nor a new one', () => {
    // Arrange: a sponsors row with a level nobody ever sold.
    const { database } = openTemporaryDatabase();
    loadSlicesAtBoot(database);
    writeSliceRows(database, [
      {
        name: 'sponsors',
        json: [{ sponsorId: 'bosch', name: 'Bosch', tier: 'platina', rollWeight: 10 }],
        updatedAt: '2026-10-25T07:00:00.000Z',
      },
    ]);

    // Act: boot, catching the refusal.
    const boot = () => loadSlicesAtBoot(database);

    // Assert: the boot stops, as for any stored slice that fails its schema.
    expect(boot, 'an unknown level must not be guessed').toThrow();
  });
});
