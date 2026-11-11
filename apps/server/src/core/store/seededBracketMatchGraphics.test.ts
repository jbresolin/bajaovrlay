/**
 * The seeded "Partida da chave" layer and the "Chave" panel's two items, once per database
 * (apps/server)
 *
 * What this module is for:
 *   The match bug (BAJAOVRLAY-65, packages/graphics/bracket-match-bug) goes on its own
 *   layer, "Partida da chave", so it can stay on air beside the sponsor bug and the channel
 *   logo. It comes with two items in a quick-fire panel of their own, "Chave": "Partida
 *   agora" (the bug) bound to "Chaves › Partida agora" and "Partida a seguir" (the card, on
 *   the lower third) bound to "Chaves › Partida a seguir", both of the seeded simulator,
 *   whose Super Prime is there for rehearsal. All three are seeded once per database, as
 *   the channel logo's are: `seeds_done` remembers it, so what the operator deleted later
 *   never comes back.
 *
 * What these tests prove (with a real SQLite file and a stand-in graphics folder):
 *   - A new database has the layer at z 17 on program, between the channel logo (15) and
 *     the ticker (20), persistent; a "Chave" panel after "Logo"; and the two items, every
 *     field bound live to their slot of the simulator's brackets, the bug in the top-left
 *     corner beside the sponsor bug.
 *   - A database written before them gains all three at its next boot, its own kept.
 *   - Once the operator deleted them, none comes back after a restart.
 *   - A database where the operator already put a layer of their own at z 17 gains
 *     neither layer nor items, keeps its layer, and logs a warning naming the height.
 *
 * What these tests deliberately do not cover:
 *   - The graphics: their own packages' tests. What the bindings read: shared's
 *     bindingResolutionBracketMatchFocus.test.ts and modules/bindings'
 *     liveRefreshBracketMatchFocus.test.ts.
 *   - The channel logo's own seed: seededChannelLogo.test.ts.
 */
import type { Item, Layer } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import type { ServerDatabase } from '../db/openDatabase.js';
import { readAllSliceRows, writeSliceRows } from '../db/sliceRowStorage.js';
import { openTemporaryDatabase } from '../db/temporaryDatabase.testSupport.js';
import { createLogger, type ServerLogger } from '../logger/createLogger.js';
import { createRecordingLogger } from '../logger/recordingLogger.testSupport.js';
import { createGraphicsFolderWithBuiltRaceClock } from './builtGraphicsFolder.testSupport.js';
import { loadInitialSlices } from './loadInitialSlices.js';

const silentLogger = createLogger({ level: 'silent' });

/** 10 November 2026, 09:00 UTC: the boot of the server with the match graphics. */
const bootTime = new Date('2026-11-10T09:00:00.000Z');

/** The "Partida da chave" layer as the server seeds it. */
const seededBracketMatchLayer: Layer = {
  id: 'bracket-match',
  outputId: 'program',
  name: 'Partida da chave',
  zIndex: 17,
  replacePolicy: 'out-then-in',
  persistent: true,
};

/** A live binding to a path of the seeded simulator's brackets. */
function buildSimulatorBracketsBinding(path: string) {
  return {
    kind: 'binding' as const,
    sourceId: 'simulador-enduro',
    shapeKey: 'brackets' as const,
    path,
    isLive: true,
  };
}

/** Boots the slices the way the store does, on a fixed clock. */
function loadSlicesAtBoot(options: {
  database: ServerDatabase;
  graphicPackagesFolder: string;
  logger?: ServerLogger;
}) {
  return loadInitialSlices({
    database: options.database,
    graphicPackagesFolder: options.graphicPackagesFolder,
    logger: options.logger ?? silentLogger,
    readCurrentTime: () => bootTime,
  });
}

/** The ids of the two seeded items. */
const seededItemIds = ['partida-agora', 'partida-a-seguir'];

/**
 * A database as the server of BAJAOVRLAY-63 left it: booted once, then the match graphics'
 * layer, panel, items and seed mark taken out again, and the plain sponsor roll's layer,
 * panel, item and seed mark too (BAJAOVRLAY-64, seeded after it), so it holds what an
 * operator's database held before this update.
 */
function openDatabaseOfAServerBeforeTheMatchGraphics() {
  const graphicPackagesFolder = createGraphicsFolderWithBuiltRaceClock();
  const { database } = openTemporaryDatabase();
  const slicesOfTheOldBoot = loadSlicesAtBoot({ database, graphicPackagesFolder });
  writeSliceRows(database, [
    {
      name: 'layers',
      json: slicesOfTheOldBoot.layers.filter(
        (layer) => layer.id !== 'bracket-match' && layer.id !== 'sponsor-roll-plain',
      ),
      updatedAt: '2026-11-09T22:10:00.000Z',
    },
    {
      name: 'quickFirePanels',
      json: slicesOfTheOldBoot.quickFirePanels.filter(
        (panel) => panel.id !== 'chave' && panel.id !== 'patrocinadores',
      ),
      updatedAt: '2026-11-09T22:10:00.000Z',
    },
    {
      name: 'items',
      json: slicesOfTheOldBoot.items.filter(
        (item) => !seededItemIds.includes(item.id) && item.id !== 'patrocinadores-simples',
      ),
      updatedAt: '2026-11-09T22:10:00.000Z',
    },
  ]);
  database.$client.prepare("DELETE FROM seeds_done WHERE name = 'bracketMatchGraphics'").run();
  database.$client.prepare("DELETE FROM seeds_done WHERE name = 'plainSponsorRoll'").run();
  return { database, graphicPackagesFolder };
}

describe('a new database', () => {
  it('has the layer above the channel logo, and the two items in a "Chave" panel', () => {
    // Arrange: an empty database.
    const graphicPackagesFolder = createGraphicsFolderWithBuiltRaceClock();
    const { database } = openTemporaryDatabase();

    // Act: boot for the first time.
    const slices = loadSlicesAtBoot({ database, graphicPackagesFolder });

    // Assert: the layer in its place, the panel after "Logo", the two items in it.
    expect(
      slices.layers.find((layer) => layer.id === 'bracket-match'),
      'the layer is seeded at z 17 on program',
    ).toEqual(seededBracketMatchLayer);
    expect(
      slices.layers.map((layer) => layer.id).slice(0, 5),
      'the match bug sits above the channel logo and under the ticker',
    ).toEqual(['bug', 'sponsor-roll-plain', 'channel-logo', 'bracket-match', 'ticker']);
    expect(
      slices.quickFirePanels.map((panel) => [panel.id, panel.name, panel.order]),
      'the "Chave" panel comes after the panels seeded before it (no "Avisos" since BAJAOVRLAY-67)',
    ).toEqual([
      ['atalhos', 'Atalhos', 0],
      ['logo', 'Logo', 1],
      ['chave', 'Chave', 2],
      // The plain sponsor roll's panel (BAJAOVRLAY-64), seeded after this one.
      ['patrocinadores', 'Patrocinadores', 3],
    ]);
    const itemsOfTheKeyPanel = slices.items.filter(
      (item) => item.home.kind === 'quickFire' && item.home.panelId === 'chave',
    );
    expect(
      itemsOfTheKeyPanel.map((item) => [
        item.id,
        item.order,
        item.graphicId,
        item.layerId,
        item.label,
      ]),
      'the bug first, then the card on the lower third',
    ).toEqual([
      ['partida-agora', 0, 'bracket-match-bug', 'bracket-match', 'Partida agora'],
      ['partida-a-seguir', 1, 'bracket-match-card', 'lower-third', 'Partida a seguir'],
    ]);
  });

  it('binds every field of the bug to "agora" and every field of the card to "a seguir", live', () => {
    // Arrange: an empty database.
    const graphicPackagesFolder = createGraphicsFolderWithBuiltRaceClock();
    const { database } = openTemporaryDatabase();

    // Act: boot for the first time and read the two items.
    const slices = loadSlicesAtBoot({ database, graphicPackagesFolder });
    const bug = slices.items.find((item) => item.id === 'partida-agora');
    const card = slices.items.find((item) => item.id === 'partida-a-seguir');

    // Assert: a few fields read as the graphics need them; the bug's corner typed.
    expect(bug?.fields, 'the bug reads "agora" of the simulator').toMatchObject({
      roundName: buildSimulatorBracketsBinding('matchNow.roundName'),
      carAShortName: buildSimulatorBracketsBinding('matchNow.carA.shortName'),
      carBWins: buildSimulatorBracketsBinding('matchNow.carB.wins'),
      winnerCarNumber: buildSimulatorBracketsBinding('matchNow.winnerCarNumber'),
      corner: { kind: 'literal', value: 'top-left' },
    });
    expect(card?.fields, 'the card reads "a seguir" of the simulator').toMatchObject({
      roundName: buildSimulatorBracketsBinding('matchUpNext.roundName'),
      carATeamName: buildSimulatorBracketsBinding('matchUpNext.carA.teamName'),
      carBLogoUrl: buildSimulatorBracketsBinding('matchUpNext.carB.logoUrl'),
      carBCity: buildSimulatorBracketsBinding('matchUpNext.carB.city'),
    });
    expect(
      Object.values(bug?.fields ?? {}).filter((field) => field.kind === 'binding'),
      "eleven of the bug's fields are bound (all but the corner)",
    ).toHaveLength(11);
    expect(
      Object.values(card?.fields ?? {}).filter((field) => field.kind === 'binding'),
      'every field of the card is bound',
    ).toHaveLength(20);
  });
});

describe('a database written before the match graphics', () => {
  it('gains the layer, the panel and the items at its next boot, and says so', () => {
    // Arrange: the operator's database from before this update, and a logger we can read.
    const { database, graphicPackagesFolder } = openDatabaseOfAServerBeforeTheMatchGraphics();
    const { logger, readRecordedLines } = createRecordingLogger();

    // Act: boot the updated server on it.
    const slices = loadSlicesAtBoot({ database, graphicPackagesFolder, logger });

    // Assert: all three back, the rows written, an info line.
    expect(
      slices.layers.map((layer) => layer.id),
      'the layer is added in its z-order place',
    ).toContain('bracket-match');
    expect(
      slices.quickFirePanels.find((panel) => panel.id === 'chave'),
      'the "Chave" panel is added after the last panel ("Patrocinadores" comes after it)',
    ).toEqual({
      id: 'chave',
      name: 'Chave',
      order: 2,
    });
    expect(
      slices.items.filter((item) => seededItemIds.includes(item.id)).map((item) => item.id),
      'both items are added',
    ).toEqual(seededItemIds);
    const storedRows = readAllSliceRows(database);
    expect(
      storedRows.find((row) => row.name === 'items')?.json,
      'the items row is written with the new items',
    ).toEqual(slices.items);
    expect(readRecordedLines(), 'an info line says what was seeded').toContainEqual(
      expect.objectContaining({
        level: 'info',
        message: 'seeded the "Partida da chave" layer and the "Chave" panel',
      }),
    );
  });

  it('does not bring them back after the operator deleted them', () => {
    // Arrange: a database that got them, then the operator deleted the layer and the items.
    const { database, graphicPackagesFolder } = openDatabaseOfAServerBeforeTheMatchGraphics();
    const slicesWithThem = loadSlicesAtBoot({ database, graphicPackagesFolder });
    writeSliceRows(database, [
      {
        name: 'layers',
        json: slicesWithThem.layers.filter((layer) => layer.id !== 'bracket-match'),
        updatedAt: '2026-11-10T10:00:00.000Z',
      },
      {
        name: 'items',
        json: slicesWithThem.items.filter((item) => !seededItemIds.includes(item.id)),
        updatedAt: '2026-11-10T10:00:00.000Z',
      },
    ]);

    // Act: restart.
    const slicesAfterTheRestart = loadSlicesAtBoot({ database, graphicPackagesFolder });

    // Assert: none came back.
    expect(
      slicesAfterTheRestart.layers.map((layer) => layer.id),
      'a deleted layer is not seeded again',
    ).not.toContain('bracket-match');
    expect(
      slicesAfterTheRestart.items.filter((item: Item) => seededItemIds.includes(item.id)),
      'deleted items are not seeded again',
    ).toEqual([]);
  });

  it('gains neither layer nor items when the operator already has a layer at z 17, and warns', () => {
    // Arrange: the operator's database with their own layer at 17.
    const { database, graphicPackagesFolder } = openDatabaseOfAServerBeforeTheMatchGraphics();
    const storedLayers = readAllSliceRows(database).find((row) => row.name === 'layers')
      ?.json as Layer[];
    const operatorsLayerAtSeventeen: Layer = {
      id: 'placar-proprio',
      outputId: 'program',
      name: 'Placar próprio',
      zIndex: 17,
      replacePolicy: 'out-then-in',
      persistent: true,
    };
    writeSliceRows(database, [
      {
        name: 'layers',
        json: [...storedLayers, operatorsLayerAtSeventeen].sort(
          (lower, higher) => lower.zIndex - higher.zIndex,
        ),
        updatedAt: '2026-11-09T22:20:00.000Z',
      },
    ]);
    const { logger, readRecordedLines } = createRecordingLogger();

    // Act: boot the updated server on it.
    const slices = loadSlicesAtBoot({ database, graphicPackagesFolder, logger });

    // Assert: the operator's layer stays, no match items, and a warning naming 17.
    expect(
      slices.layers.find((layer) => layer.zIndex === 17)?.id,
      'the operator’s layer keeps its height',
    ).toBe('placar-proprio');
    expect(
      slices.items.filter((item) => seededItemIds.includes(item.id)),
      'no item is seeded without its layer',
    ).toEqual([]);
    expect(
      readRecordedLines().filter(
        (line) => line.level === 'warn' && line.message.includes('Partida da chave'),
      ),
      'one warning naming the height',
    ).toEqual([expect.objectContaining({ z_index: 17 })]);
  });
});
