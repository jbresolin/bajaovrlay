/**
 * A sponsor's light plate choice at boot (apps/server)
 *
 * What this module is for:
 *   BAJAOVRLAY-23 gives a sponsor `logoOnLightPlate`, the team's rule for a dark logo. The
 *   `sponsors` slice is saved, so a database written before the choice existed holds
 *   sponsors without it. Such a database must boot as it is: left out means no plate, and
 *   nothing is migrated or made up.
 *
 * What these tests prove (with a real SQLite file):
 *   - A sponsors row stored before the choice existed boots, every sponsor as it was.
 *   - A sponsors row with the choice boots with it kept.
 *
 * What these tests deliberately do not cover:
 *   - The schema's rules for the choice; packages/shared's sponsorLogoOnLightPlate.test.ts.
 *   - The library's other slices at boot; entitiesThroughTheStore.test.ts.
 */
import { describe, expect, it } from 'vitest';

import type { ServerDatabase } from '../../core/db/openDatabase.js';
import { writeSliceRows } from '../../core/db/sliceRowStorage.js';
import { openTemporaryDatabase } from '../../core/db/temporaryDatabase.testSupport.js';
import { createLogger } from '../../core/logger/createLogger.js';
import { createGraphicsFolderWithBuiltRaceClock } from '../../core/store/builtGraphicsFolder.testSupport.js';
import { loadInitialSlices } from '../../core/store/loadInitialSlices.js';

/** 24 October 2026, 08:00:00 UTC: the boot of these tests. */
const bootTime = new Date('2026-10-24T08:00:00.000Z');

/** Boots the slices the way the store does. */
function loadSlicesAtBoot(database: ServerDatabase) {
  return loadInitialSlices({
    database,
    graphicPackagesFolder: createGraphicsFolderWithBuiltRaceClock(),
    logger: createLogger({ level: 'silent' }),
    readCurrentTime: () => bootTime,
  });
}

/** The two sponsors as BAJAOVRLAY-19's Cadastros saved them, before the plate choice. */
function buildSponsorsSavedBeforeThePlate() {
  return [
    {
      sponsorId: 'patrocinador-master',
      name: 'Mineradora Serra Azul',
      tier: 'master',
      rollWeight: 10,
      logoMediaId: '7d1e3a5c9b0f2e4d6c8a1b3f5e7d9c0b2a4f6e8d0c2b4a6f8e0d2c4b6a8f0e2d',
    },
    { sponsorId: 'apoio-pneus', name: 'Pneus Trilha', tier: 'apoio', rollWeight: 2 },
  ];
}

describe('the sponsors slice at boot', () => {
  it('boots a sponsors row stored before the plate choice, every sponsor as it was', () => {
    // Arrange: a database booted once, whose sponsors row was then written before
    // BAJAOVRLAY-23.
    const { database } = openTemporaryDatabase();
    loadSlicesAtBoot(database);
    writeSliceRows(database, [
      {
        name: 'sponsors',
        json: buildSponsorsSavedBeforeThePlate(),
        updatedAt: '2026-10-20T21:15:00.000Z',
      },
    ]);

    // Act: boot.
    const slices = loadSlicesAtBoot(database);

    // Assert: the sponsors come back unchanged, with no plate choice made up.
    expect(slices.sponsors, 'an old sponsors row must boot as it was stored').toEqual(
      buildSponsorsSavedBeforeThePlate(),
    );
  });

  it('boots a sponsors row with the plate choice and keeps it', () => {
    // Arrange: a database booted once, with the master sponsor's logo then marked for the
    // light plate in Cadastros.
    const { database } = openTemporaryDatabase();
    loadSlicesAtBoot(database);
    const [masterSponsor, supportSponsor] = buildSponsorsSavedBeforeThePlate();
    const sponsorsWithThePlate = [{ ...masterSponsor, logoOnLightPlate: true }, supportSponsor];
    writeSliceRows(database, [
      { name: 'sponsors', json: sponsorsWithThePlate, updatedAt: '2026-10-24T07:00:00.000Z' },
    ]);

    // Act: boot.
    const slices = loadSlicesAtBoot(database);

    // Assert: the choice is still there.
    expect(slices.sponsors, 'the plate choice must survive a restart').toEqual(
      sponsorsWithThePlate,
    );
  });
});
