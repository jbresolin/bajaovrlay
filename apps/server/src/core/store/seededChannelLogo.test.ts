/**
 * The seeded "Logo do canal" layer and item, once per database (apps/server)
 *
 * What this module is for:
 *   The channel logo (BAJAOVRLAY-63, packages/graphics/logo-bug) goes on its own layer,
 *   "Logo do canal", so it can be on air beside the sponsor bug, and comes with an item of
 *   the same name, with no image chosen: the operator only picks the file. The item is
 *   the only button of a quick-fire panel of its own, "Logo", so it never takes a button
 *   of "Atalhos" from the operator's own (João's ruling at gate 2 of PR #56). Both are seeded once per database: on a new one, and on
 *   one written before them at its first boot with them. A database remembers that it got
 *   them in the `seeds_done` table, so a layer or an item the operator deleted later is
 *   never brought back.
 *
 * What these tests prove (with a real SQLite file and a stand-in graphics folder):
 *   - A new database has the layer at z 15 on program, between the bug (10) and the ticker
 *     (20), persistent, out-then-in; a "Logo" panel after "Atalhos" and "Avisos"; and the
 *     item as its only button, on the logo bug and that layer, its corner, height and
 *     opacity at the defaults and no image. "Atalhos" and the rundown stay empty.
 *   - A database written before them, with outputs (the operator's own layers since
 *     BAJAOVRLAY-49), gains all three at its next boot, its own layers, panels and items
 *     kept (its "Atalhos" button stays alone there), and the layers, panels and items
 *     rows are written; an info line says so.
 *   - Once the operator deleted them, neither comes back after a restart.
 *   - A database where the operator already put a layer of their own at z 15 gains neither
 *     (the item would have no layer to go on), keeps its layer, and logs a warning naming
 *     the height; it is not tried again at the next boot.
 *
 * What these tests deliberately do not cover:
 *   - The logo bug itself, and the form refusing a take with no image; the graphic's own
 *     tests and apps/control's ItemEditorPanelChannelLogo.test.tsx cover them; the server
 *     refusing the take is ws/takeSeededChannelLogo.test.ts.
 *   - The other layers' seed; outputsAtBoot.test.ts and loadInitialSlicesNewSeededLayer.test.ts.
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

/** 9 November 2026, 09:00 UTC: the boot of the server with the channel logo. */
const bootTime = new Date('2026-11-09T09:00:00.000Z');

/** The "Logo do canal" layer as the server seeds it. */
const seededChannelLogoLayer: Layer = {
  id: 'channel-logo',
  outputId: 'program',
  name: 'Logo do canal',
  zIndex: 15,
  replacePolicy: 'out-then-in',
  persistent: true,
};

/** The "Logo do canal" item as the server seeds it: the one button of the "Logo" panel. */
const seededChannelLogoItem: Item = {
  id: 'logo-do-canal',
  home: { kind: 'quickFire', panelId: 'logo' },
  order: 0,
  graphicId: 'logo-bug',
  layerId: 'channel-logo',
  label: 'Logo do canal',
  color: 'neutral',
  notes: '',
  fields: {
    corner: { kind: 'literal', value: 'bottom-right' },
    heightPx: { kind: 'literal', value: 80 },
    opacityPercent: { kind: 'literal', value: 100 },
  },
};

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

/**
 * A database as the server of BAJAOVRLAY-61 left it: booted once, then the channel logo's
 * layer, item and seed mark taken out again, and the Super Prime match graphics' and the
 * plain sponsor roll's layers, panels and items too (BAJAOVRLAY-65 and -64, seeded after
 * it), so it holds what an operator's database held before this update. The operator had
 * added a "Patrocínio" button to "Atalhos" there.
 */
function openDatabaseOfAServerBeforeTheChannelLogo() {
  const graphicPackagesFolder = createGraphicsFolderWithBuiltRaceClock();
  const { database } = openTemporaryDatabase();
  const slicesOfTheOldBoot = loadSlicesAtBoot({ database, graphicPackagesFolder });
  const operatorsSponsorButton: Item = {
    ...seededChannelLogoItem,
    id: 'patrocinio-bosch',
    home: { kind: 'quickFire', panelId: 'atalhos' },
    graphicId: 'sponsor-bug',
    layerId: 'bug',
    label: 'Patrocínio',
    fields: {},
  };
  const laterSeededPanelIds = ['logo', 'chave', 'patrocinadores'];
  const laterSeededItemIds = [
    'logo-do-canal',
    'partida-agora',
    'partida-a-seguir',
    'patrocinadores-simples',
  ];
  const itemsBefore = slicesOfTheOldBoot.items.filter(
    (item) => !laterSeededItemIds.includes(item.id),
  );
  writeSliceRows(database, [
    {
      name: 'layers',
      json: slicesOfTheOldBoot.layers.filter(
        (layer) =>
          layer.id !== 'channel-logo' &&
          layer.id !== 'bracket-match' &&
          layer.id !== 'sponsor-roll-plain',
      ),
      updatedAt: '2026-11-08T22:10:00.000Z',
    },
    {
      name: 'quickFirePanels',
      json: slicesOfTheOldBoot.quickFirePanels.filter(
        (panel) => !laterSeededPanelIds.includes(panel.id),
      ),
      updatedAt: '2026-11-08T22:10:00.000Z',
    },
    {
      name: 'items',
      json: [...itemsBefore, operatorsSponsorButton],
      updatedAt: '2026-11-08T22:10:00.000Z',
    },
  ]);
  database.$client.prepare('DELETE FROM seeds_done').run();
  return { database, graphicPackagesFolder };
}

describe('a new database', () => {
  it('has the layer between the bug and the ticker, and the item with no image alone in a "Logo" panel', () => {
    // Arrange: an empty database.
    const graphicPackagesFolder = createGraphicsFolderWithBuiltRaceClock();
    const { database } = openTemporaryDatabase();

    // Act: boot for the first time.
    const slices = loadSlicesAtBoot({ database, graphicPackagesFolder });

    // Assert: the layer as seeded, just above the bug; the item as seeded.
    expect(
      slices.layers.find((layer) => layer.id === 'channel-logo'),
      'the layer is seeded at z 15 on program',
    ).toEqual(seededChannelLogoLayer);
    expect(
      slices.layers.map((layer) => layer.id).slice(0, 5),
      'the channel logo sits above the bug and the sponsor roll’s layer, under the match bug and the ticker',
    ).toEqual(['bug', 'sponsor-roll-plain', 'channel-logo', 'bracket-match', 'ticker']);
    expect(
      slices.items.find((item) => item.id === 'logo-do-canal'),
      'the item is seeded with no image, the rest at the defaults',
    ).toEqual(seededChannelLogoItem);
    expect(
      slices.quickFirePanels.map((panel) => [panel.id, panel.name, panel.order]),
      'the "Logo" panel comes after the two seeded before it, the sponsor roll’s after it',
    ).toEqual([
      ['atalhos', 'Atalhos', 0],
      ['avisos', 'Avisos', 1],
      ['logo', 'Logo', 2],
      ['chave', 'Chave', 3],
      ['patrocinadores', 'Patrocinadores', 4],
    ]);
    expect(
      slices.items.filter(
        (item) => item.home.kind === 'quickFire' && item.home.panelId === 'atalhos',
      ),
      '"Atalhos" stays empty, so the operator’s first button is button 1',
    ).toEqual([]);
    expect(
      slices.items.filter((item) => item.home.kind === 'rundown'),
      'the rundown stays empty, so the operator’s first item gets the cursor',
    ).toEqual([]);
  });
});

describe('a database written before the channel logo', () => {
  it('gains the layer and the item at its next boot, keeping its own, and says so', () => {
    // Arrange: the operator's database from before this update, and a logger we can read.
    const { database, graphicPackagesFolder } = openDatabaseOfAServerBeforeTheChannelLogo();
    const { logger, readRecordedLines } = createRecordingLogger();

    // Act: boot the updated server on it.
    const slices = loadSlicesAtBoot({ database, graphicPackagesFolder, logger });

    // Assert: the layer in its z-order place, the panel last, the item alone in it, the
    // operator's button alone in "Atalhos", the three
    // rows written, and an info line.
    expect(
      slices.layers.map((layer) => [layer.id, layer.zIndex]).slice(0, 5),
      'the layer is added in its z-order place',
    ).toEqual([
      ['bug', 10],
      ['sponsor-roll-plain', 12],
      ['channel-logo', 15],
      ['bracket-match', 17],
      ['ticker', 20],
    ]);
    expect(
      slices.items
        .filter(
          (item) =>
            item.home.kind === 'quickFire' &&
            item.home.panelId !== 'avisos' &&
            item.home.panelId !== 'chave' &&
            item.home.panelId !== 'patrocinadores',
        )
        .map((item) => [
          item.id,
          item.home.kind === 'quickFire' ? item.home.panelId : '',
          item.order,
        ]),
      'the logo goes alone in its own panel; the operator’s button stays alone in "Atalhos"',
    ).toEqual([
      ['patrocinio-bosch', 'atalhos', 0],
      ['logo-do-canal', 'logo', 0],
    ]);
    expect(
      slices.quickFirePanels.find((panel) => panel.id === 'logo'),
      'the "Logo" panel is added after the last panel ("Chave" and "Patrocinadores" come after it)',
    ).toEqual({ id: 'logo', name: 'Logo', order: 2 });
    const storedRows = readAllSliceRows(database);
    expect(
      storedRows.find((row) => row.name === 'layers')?.json,
      'the layers row is written with the new layer',
    ).toEqual(slices.layers);
    expect(
      storedRows.find((row) => row.name === 'items')?.json,
      'the items row is written with the new item',
    ).toEqual(slices.items);
    expect(
      storedRows.find((row) => row.name === 'quickFirePanels')?.json,
      'the panels row is written with the new panel',
    ).toEqual(slices.quickFirePanels);
    expect(readRecordedLines(), 'an info line says what was seeded').toContainEqual(
      expect.objectContaining({
        level: 'info',
        message: 'seeded the "Logo do canal" layer and item',
      }),
    );
  });

  it('does not bring them back after the operator deleted them', () => {
    // Arrange: a database that got them, then the operator deleted both.
    const { database, graphicPackagesFolder } = openDatabaseOfAServerBeforeTheChannelLogo();
    const slicesWithTheLogo = loadSlicesAtBoot({ database, graphicPackagesFolder });
    writeSliceRows(database, [
      {
        name: 'layers',
        json: slicesWithTheLogo.layers.filter((layer) => layer.id !== 'channel-logo'),
        updatedAt: '2026-11-09T10:00:00.000Z',
      },
      {
        name: 'items',
        json: slicesWithTheLogo.items.filter((item) => item.id !== 'logo-do-canal'),
        updatedAt: '2026-11-09T10:00:00.000Z',
      },
    ]);

    // Act: restart.
    const slicesAfterTheRestart = loadSlicesAtBoot({ database, graphicPackagesFolder });

    // Assert: neither came back.
    expect(
      slicesAfterTheRestart.layers.map((layer) => layer.id),
      'a deleted layer is not seeded again',
    ).not.toContain('channel-logo');
    expect(
      slicesAfterTheRestart.items.map((item) => item.id),
      'a deleted item is not seeded again',
    ).not.toContain('logo-do-canal');
  });

  it('gains neither when the operator already has a layer at z 15, and warns once', () => {
    // Arrange: the operator's database with their own "Patrocínio extra" layer at 15.
    const { database, graphicPackagesFolder } = openDatabaseOfAServerBeforeTheChannelLogo();
    const storedLayers = readAllSliceRows(database).find((row) => row.name === 'layers')
      ?.json as Layer[];
    const operatorsLayerAtFifteen: Layer = {
      id: 'patrocinio-extra',
      outputId: 'program',
      name: 'Patrocínio extra',
      zIndex: 15,
      replacePolicy: 'out-then-in',
      persistent: false,
    };
    writeSliceRows(database, [
      {
        name: 'layers',
        json: [...storedLayers, operatorsLayerAtFifteen].sort(
          (lower, higher) => lower.zIndex - higher.zIndex,
        ),
        updatedAt: '2026-11-08T22:20:00.000Z',
      },
    ]);
    const { logger, readRecordedLines } = createRecordingLogger();

    // Act: boot the updated server on it, then once more.
    const slices = loadSlicesAtBoot({ database, graphicPackagesFolder, logger });
    loadSlicesAtBoot({ database, graphicPackagesFolder, logger });

    // Assert: the operator's layer stays, no channel logo, and one warning naming 15.
    expect(
      slices.layers.find((layer) => layer.zIndex === 15)?.id,
      'the operator’s layer keeps its height',
    ).toBe('patrocinio-extra');
    expect(
      slices.items.map((item) => item.id),
      'no item is seeded without its layer',
    ).not.toContain('logo-do-canal');
    const warnings = readRecordedLines().filter(
      (line) => line.level === 'warn' && line.message.includes('Logo do canal'),
    );
    expect(warnings, 'one warning, at the first boot only, naming the height').toEqual([
      expect.objectContaining({ z_index: 15 }),
    ]);
  });
});
