/**
 * The layers of the first boot (apps/server)
 *
 * What this module is for:
 *   On the first boot the store seeds the program output's fixed layers (seedLayers.ts):
 *   bug, sponsor-roll-plain, channel-logo, bracket-match, ticker, clock, tower,
 *   lower-third, notice, fullscreen and image, bottom to top. Every graphic's default
 *   layer is one of them, so a mistake here puts graphics on the wrong layer or none.
 *   (Moved out of loadInitialSlices.test.ts by BAJAOVRLAY-84, when the eleventh layer took
 *   that file past 400 lines.)
 *
 * What these tests prove (a real SQLite file and a stand-in graphics folder):
 *   - An empty database is seeded with the eleven layers in ascending z-order, each with
 *     its pt-BR name, `out-then-in` swaps, only the logo, channel logo, match bug, clock
 *     and tower persistent; the seed is saved, stamped with the store's clock.
 *
 * What these tests deliberately do not cover:
 *   - The graphics and instances of the first boot, and later boots:
 *     loadInitialSlices.test.ts.
 *   - A layer seeded since a database was written: loadInitialSlicesNewSeededLayer.test.ts
 *     and each one-off seed's own test (seededImageLayer.test.ts for the image's).
 */
import { describe, expect, it } from 'vitest';

import type { ServerDatabase } from '../db/openDatabase.js';
import { readAllSliceRows } from '../db/sliceRowStorage.js';
import { openTemporaryDatabase } from '../db/temporaryDatabase.testSupport.js';
import { createLogger } from '../logger/createLogger.js';
import { createGraphicsFolderWithBuiltRaceClock } from './builtGraphicsFolder.testSupport.js';
import { loadInitialSlices } from './loadInitialSlices.js';

const silentLogger = createLogger({ level: 'silent' });

/** 9 October 2026, 08:00:00 UTC: the boot time every test's clock reports. */
const bootTime = new Date('2026-10-09T08:00:00.000Z');

/** Boots the slices the way the store does, on a fixed clock. */
function loadSlicesAtBoot(options: { database: ServerDatabase; graphicPackagesFolder: string }) {
  return loadInitialSlices({
    database: options.database,
    graphicPackagesFolder: options.graphicPackagesFolder,
    logger: silentLogger,
    readCurrentTime: () => bootTime,
  });
}

describe('loadInitialSlices on an empty database', () => {
  it('seeds the eleven layers in ascending z-order and saves them, stamped with the store clock', () => {
    // Arrange: a brand-new database file.
    const { database } = openTemporaryDatabase();

    // Act: load the slices, as the first boot does.
    const slices = loadSlicesAtBoot({
      database,
      graphicPackagesFolder: createGraphicsFolderWithBuiltRaceClock(),
    });

    // Assert: the eleven layers, bottom to top, all out-then-in, only the ones meant to stay up
    // all day persistent (logo, channel logo, match bug, clock, tower); the seed is saved.
    expect(slices.layers, 'the seeded layers must be exactly these eleven').toEqual([
      {
        id: 'bug',
        outputId: 'program',
        name: 'Logo',
        zIndex: 10,
        replacePolicy: 'out-then-in',
        persistent: true,
      },
      {
        id: 'sponsor-roll-plain',
        outputId: 'program',
        name: 'Patrocinadores (rodízio)',
        zIndex: 12,
        replacePolicy: 'out-then-in',
        persistent: false,
      },
      {
        id: 'channel-logo',
        outputId: 'program',
        name: 'Logo do canal',
        zIndex: 15,
        replacePolicy: 'out-then-in',
        persistent: true,
      },
      {
        id: 'bracket-match',
        outputId: 'program',
        name: 'Partida da chave',
        zIndex: 17,
        replacePolicy: 'out-then-in',
        persistent: true,
      },
      {
        id: 'ticker',
        outputId: 'program',
        name: 'Letreiro',
        zIndex: 20,
        replacePolicy: 'out-then-in',
        persistent: false,
      },
      {
        id: 'clock',
        outputId: 'program',
        name: 'Relógio',
        zIndex: 30,
        replacePolicy: 'out-then-in',
        persistent: true,
      },
      {
        id: 'tower',
        outputId: 'program',
        name: 'Torre',
        zIndex: 35,
        replacePolicy: 'out-then-in',
        persistent: true,
      },
      {
        id: 'lower-third',
        outputId: 'program',
        name: 'Tarja',
        zIndex: 40,
        replacePolicy: 'out-then-in',
        persistent: false,
      },
      {
        id: 'notice',
        outputId: 'program',
        name: 'Aviso',
        zIndex: 45,
        replacePolicy: 'out-then-in',
        persistent: false,
      },
      {
        id: 'fullscreen',
        outputId: 'program',
        name: 'Tela cheia',
        zIndex: 50,
        replacePolicy: 'out-then-in',
        persistent: false,
      },
      // The image graphic's own layer (BAJAOVRLAY-84), on top of everything.
      {
        id: 'image',
        outputId: 'program',
        name: 'Imagem',
        zIndex: 60,
        replacePolicy: 'out-then-in',
        persistent: false,
      },
    ]);
    const zIndexes = slices.layers.map((layer) => layer.zIndex);
    expect(zIndexes, 'each layer must sit above the one before').toEqual(
      [...zIndexes].sort((lower, higher) => lower - higher),
    );
    expect(new Set(zIndexes).size, 'no two layers may share a z-index').toBe(11);
    expect(
      readAllSliceRows(database).map((row) => [row.name, row.updatedAt]),
      'the seed must be saved, stamped with the store clock, so the next boot loads it',
    ).toEqual([
      // The program output since BAJAOVRLAY-49; modules/outputs covers what it holds.
      ['outputs', '2026-10-09T08:00:00.000Z'],
      ['layers', '2026-10-09T08:00:00.000Z'],
      ['graphics', '2026-10-09T08:00:00.000Z'],
      ['instances', '2026-10-09T08:00:00.000Z'],
      // Seeded too since BAJAOVRLAY-13; loadRundownSlices.test.ts covers what they hold.
      ['rundowns', '2026-10-09T08:00:00.000Z'],
      ['items', '2026-10-09T08:00:00.000Z'],
      // Seeded too since BAJAOVRLAY-16; loadQuickFireAndMacroSlices.test.ts covers them.
      ['quickFirePanels', '2026-10-09T08:00:00.000Z'],
      ['macros', '2026-10-09T08:00:00.000Z'],
      // The seeded simulator since BAJAOVRLAY-17; modules/dataSources covers it.
      ['dataSources', '2026-10-09T08:00:00.000Z'],
      // The default event rules since BAJAOVRLAY-44; modules/events covers them.
      ['eventRules', '2026-10-09T08:00:00.000Z'],
      // The plain sponsor roll's trigger since BAJAOVRLAY-64; seededPlainSponsorRoll.test.ts.
      ['triggers', '2026-10-09T08:00:00.000Z'],
    ]);
    expect(slices.instances, 'nothing is on air on the first boot').toEqual([]);
  });
});
