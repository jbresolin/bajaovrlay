/**
 * The seeded plain sponsor roll, its layer, macro and trigger, once per database (apps/server)
 *
 * What this module is for:
 *   The plain sponsor roll (BAJAOVRLAY-64, packages/graphics/sponsor-roll-plain) comes ready
 *   to use: a layer of its own, "Patrocinadores (rodízio)", at z 12, just above the sponsor
 *   bug's (10) with the same footprint, so a pass covers the bug in its corner and the bug is
 *   still there when the roll leaves (João's ruling at gate 2 of PR #59); an item
 *   "Patrocinadores (simples)" on it reading every sponsor of Cadastros, as the sponsor roll's
 *   items do, a macro of the same name that takes it, and a trigger
 *   "Patrocinadores a cada 30 min" that runs the macro. The trigger is seeded off and asking,
 *   so nothing goes on air by surprise until the operator switches it on. The item is the
 *   only button of a quick-fire panel of its own, "Patrocinadores", as the channel logo's is
 *   (João's ruling at gate 2 of PR #56: never a button of "Atalhos", never in the rundown).
 *   All of it is seeded once per database (`seeds_done`), so what the operator deletes
 *   stays deleted.
 *
 * What these tests prove (a real SQLite file and a stand-in graphics folder):
 *   - A new database has the layer at z 12 on program, between the bug and the channel logo,
 *     not persistent, out-then-in; the panel after "Logo", the item alone in it on that layer,
 *     its sponsors on the list of Cadastros and its corner top-left, the macro taking it, and
 *     the trigger off, asking, every 30 minutes all day, with no count started. "Atalhos" and
 *     the rundown stay empty.
 *   - A database written before them gains all five at its next boot, keeping its own, the
 *     rows written; an info line says so.
 *   - Once the operator deleted them, none comes back after a restart.
 *   - A database where the operator's own layer already holds z 12 gains none (the item would
 *     have no layer to go on), keeps its layer, and warns once, naming the height.
 *
 * What these tests deliberately do not cover:
 *   - The trigger firing once switched on; modules/triggers/intervalTriggers.test.ts.
 *   - The roll leaving after its pass; plainSponsorRollAutoOut.test.ts.
 */
import type { Item, Layer, Macro, Trigger } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import type { ServerDatabase } from '../db/openDatabase.js';
import { readAllSliceRows, writeSliceRows } from '../db/sliceRowStorage.js';
import { openTemporaryDatabase } from '../db/temporaryDatabase.testSupport.js';
import { createLogger, type ServerLogger } from '../logger/createLogger.js';
import { createRecordingLogger } from '../logger/recordingLogger.testSupport.js';
import { createGraphicsFolderWithBuiltRaceClock } from './builtGraphicsFolder.testSupport.js';
import { loadInitialSlices } from './loadInitialSlices.js';

const silentLogger = createLogger({ level: 'silent' });

/** 10 November 2026, 09:00 UTC: the boot of the server with the plain sponsor roll. */
const bootTime = new Date('2026-11-10T09:00:00.000Z');

/** The roll's layer as the server seeds it: just above the sponsor bug, on program. */
const seededPlainSponsorRollLayer: Layer = {
  id: 'sponsor-roll-plain',
  outputId: 'program',
  name: 'Patrocinadores (rodízio)',
  zIndex: 12,
  replacePolicy: 'out-then-in',
  persistent: false,
};

/** The item as the server seeds it: the one button of the "Patrocinadores" panel. */
const seededPlainSponsorRollItem: Item = {
  id: 'patrocinadores-simples',
  home: { kind: 'quickFire', panelId: 'patrocinadores' },
  order: 0,
  graphicId: 'sponsor-roll-plain',
  layerId: 'sponsor-roll-plain',
  label: 'Patrocinadores (simples)',
  color: 'neutral',
  notes: '',
  fields: {
    sponsors: { kind: 'entityList', entityType: 'sponsor' },
    corner: { kind: 'literal', value: 'top-left' },
  },
};

/** The macro as the server seeds it: one step, the take of the item. */
const seededPlainSponsorRollMacro: Macro = {
  id: 'patrocinadores-simples',
  label: 'Patrocinadores (simples)',
  color: 'neutral',
  steps: [{ kind: 'takeItem', itemId: 'patrocinadores-simples' }],
};

/** The trigger as the server seeds it: off and asking, every 30 minutes all day. */
const seededSponsorsEvery30MinutesTrigger: Trigger = {
  id: 'patrocinadores-a-cada-30-min',
  name: 'Patrocinadores a cada 30 min',
  isEnabled: false,
  when: { kind: 'schedule', moment: { kind: 'everyMinutes', everyMinutes: 30, window: null } },
  macroId: 'patrocinadores-simples',
  mode: 'ask',
  minimumIntervalMs: 10_000,
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
 * A database as the server of BAJAOVRLAY-63 left it: booted once, then the plain roll's
 * layer, panel, item, macro, trigger and seed mark taken out again. The operator had made a macro
 * "Abrir a sessão" and a trigger of their own there.
 */
function openDatabaseOfAServerBeforeThePlainRoll() {
  const graphicPackagesFolder = createGraphicsFolderWithBuiltRaceClock();
  const { database } = openTemporaryDatabase();
  const slicesOfTheOldBoot = loadSlicesAtBoot({ database, graphicPackagesFolder });
  const operatorsMacro: Macro = {
    id: 'abrir-a-sessao',
    label: 'Abrir a sessão',
    color: 'success',
    steps: [],
  };
  const operatorsTrigger: Trigger = {
    ...seededSponsorsEvery30MinutesTrigger,
    id: 'gatilho-1',
    name: 'Abertura às 08:00',
    isEnabled: true,
    when: { kind: 'schedule', moment: { kind: 'timeOfDay', timeOfDay: '08:00' } },
    macroId: 'abrir-a-sessao',
  };
  const updatedAt = '2026-11-09T22:10:00.000Z';
  writeSliceRows(database, [
    {
      name: 'layers',
      json: slicesOfTheOldBoot.layers.filter((layer) => layer.id !== 'sponsor-roll-plain'),
      updatedAt,
    },
    {
      name: 'quickFirePanels',
      json: slicesOfTheOldBoot.quickFirePanels.filter((panel) => panel.id !== 'patrocinadores'),
      updatedAt,
    },
    {
      name: 'items',
      json: slicesOfTheOldBoot.items.filter((item) => item.id !== 'patrocinadores-simples'),
      updatedAt,
    },
    { name: 'macros', json: [operatorsMacro], updatedAt },
    { name: 'triggers', json: [operatorsTrigger], updatedAt },
  ]);
  database.$client.prepare("DELETE FROM seeds_done WHERE name = 'plainSponsorRoll'").run();
  return { database, graphicPackagesFolder };
}

describe('a new database', () => {
  it('has the roll’s layer above the bug, the roll alone in a "Patrocinadores" panel, its macro, and its trigger off and asking', () => {
    // Arrange: an empty database.
    const graphicPackagesFolder = createGraphicsFolderWithBuiltRaceClock();
    const { database } = openTemporaryDatabase();

    // Act: boot for the first time.
    const slices = loadSlicesAtBoot({ database, graphicPackagesFolder });

    // Assert: the layer between the bug and the channel logo; the panel last, the item, the
    // macro and the trigger as seeded.
    expect(
      slices.layers.find((layer) => layer.id === 'sponsor-roll-plain'),
      'the roll’s layer is seeded at z 12 on program',
    ).toEqual(seededPlainSponsorRollLayer);
    expect(
      slices.layers.map((layer) => layer.id).slice(0, 3),
      'the roll sits just above the bug and under the channel logo',
    ).toEqual(['bug', 'sponsor-roll-plain', 'channel-logo']);
    expect(
      slices.quickFirePanels.map((panel) => [panel.id, panel.name, panel.order]),
      'the "Patrocinadores" panel comes after the four seeded before it',
    ).toEqual([
      ['atalhos', 'Atalhos', 0],
      ['avisos', 'Avisos', 1],
      ['logo', 'Logo', 2],
      ['chave', 'Chave', 3],
      ['patrocinadores', 'Patrocinadores', 4],
    ]);
    expect(
      slices.items.find((item) => item.id === 'patrocinadores-simples'),
      'the item reads every sponsor of Cadastros, top-left on the roll’s layer',
    ).toEqual(seededPlainSponsorRollItem);
    expect(slices.macros, 'the macro takes the item').toEqual([seededPlainSponsorRollMacro]);
    expect(
      slices.triggers,
      'the trigger is off and asking, so nothing goes on air by surprise',
    ).toEqual([seededSponsorsEvery30MinutesTrigger]);
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

describe('a database written before the plain sponsor roll', () => {
  it('gains the layer, panel, item, macro and trigger at its next boot, keeping its own, and says so', () => {
    // Arrange: the operator's database from before this update, and a logger we can read.
    const { database, graphicPackagesFolder } = openDatabaseOfAServerBeforeThePlainRoll();
    const { logger, readRecordedLines } = createRecordingLogger();

    // Act: boot the updated server on it.
    const slices = loadSlicesAtBoot({ database, graphicPackagesFolder, logger });

    // Assert: the layer in its z-order place; the operator's macro and trigger first, the
    // seeded ones after; the rows written.
    expect(
      slices.layers.map((layer) => [layer.id, layer.zIndex]).slice(0, 3),
      'the layer is added in its z-order place',
    ).toEqual([
      ['bug', 10],
      ['sponsor-roll-plain', 12],
      ['channel-logo', 15],
    ]);
    expect(
      slices.macros.map((macro) => macro.id),
      'the operator’s macro is kept',
    ).toEqual(['abrir-a-sessao', 'patrocinadores-simples']);
    expect(
      slices.triggers.map((trigger) => trigger.id),
      'the operator’s trigger is kept',
    ).toEqual(['gatilho-1', 'patrocinadores-a-cada-30-min']);
    expect(slices.quickFirePanels.at(-1), 'the panel is added after the last panel').toEqual({
      id: 'patrocinadores',
      name: 'Patrocinadores',
      order: 4,
    });
    const storedRows = readAllSliceRows(database);
    for (const sliceName of ['layers', 'quickFirePanels', 'items', 'macros', 'triggers'] as const) {
      expect(
        storedRows.find((row) => row.name === sliceName)?.json,
        `the ${sliceName} row is written with what was seeded`,
      ).toEqual(slices[sliceName]);
    }
    expect(readRecordedLines(), 'an info line says what was seeded').toContainEqual(
      expect.objectContaining({
        level: 'info',
        message:
          'seeded the "Patrocinadores (rodízio)" layer and the "Patrocinadores (simples)" item, macro and trigger',
      }),
    );
  });

  it('does not bring them back after the operator deleted them', () => {
    // Arrange: a database that got them, then the operator deleted the item, macro and trigger.
    const { database, graphicPackagesFolder } = openDatabaseOfAServerBeforeThePlainRoll();
    const slicesWithTheRoll = loadSlicesAtBoot({ database, graphicPackagesFolder });
    const updatedAt = '2026-11-10T10:00:00.000Z';
    writeSliceRows(database, [
      {
        name: 'items',
        json: slicesWithTheRoll.items.filter((item) => item.id !== 'patrocinadores-simples'),
        updatedAt,
      },
      {
        name: 'macros',
        json: slicesWithTheRoll.macros.filter((macro) => macro.id !== 'patrocinadores-simples'),
        updatedAt,
      },
      {
        name: 'triggers',
        json: slicesWithTheRoll.triggers.filter(
          (trigger) => trigger.id !== 'patrocinadores-a-cada-30-min',
        ),
        updatedAt,
      },
    ]);

    // Act: restart.
    const slicesAfterTheRestart = loadSlicesAtBoot({ database, graphicPackagesFolder });

    // Assert: none came back.
    expect(
      slicesAfterTheRestart.items.map((item) => item.id),
      'a deleted item is not seeded again',
    ).not.toContain('patrocinadores-simples');
    expect(
      slicesAfterTheRestart.macros.map((macro) => macro.id),
      'a deleted macro is not seeded again',
    ).not.toContain('patrocinadores-simples');
    expect(
      slicesAfterTheRestart.triggers.map((trigger) => trigger.id),
      'a deleted trigger is not seeded again',
    ).not.toContain('patrocinadores-a-cada-30-min');
  });

  it('gains none when the operator already has a layer at z 12, and warns once', () => {
    // Arrange: the operator's database with their own "Patrocínio extra" layer at 12.
    const { database, graphicPackagesFolder } = openDatabaseOfAServerBeforeThePlainRoll();
    const storedLayers = readAllSliceRows(database).find((row) => row.name === 'layers')
      ?.json as Layer[];
    const operatorsLayerAtTwelve: Layer = {
      id: 'patrocinio-extra',
      outputId: 'program',
      name: 'Patrocínio extra',
      zIndex: 12,
      replacePolicy: 'out-then-in',
      persistent: false,
    };
    writeSliceRows(database, [
      {
        name: 'layers',
        json: [...storedLayers, operatorsLayerAtTwelve].sort(
          (lower, higher) => lower.zIndex - higher.zIndex,
        ),
        updatedAt: '2026-11-09T22:20:00.000Z',
      },
    ]);
    const { logger, readRecordedLines } = createRecordingLogger();

    // Act: boot the updated server on it, then once more.
    const slices = loadSlicesAtBoot({ database, graphicPackagesFolder, logger });
    loadSlicesAtBoot({ database, graphicPackagesFolder, logger });

    // Assert: the operator's layer keeps its height; no item, macro or trigger; one warning.
    expect(
      slices.layers.find((layer) => layer.zIndex === 12)?.id,
      'the operator’s layer keeps its height',
    ).toBe('patrocinio-extra');
    expect(
      slices.items.map((item) => item.id),
      'no item is seeded without its layer',
    ).not.toContain('patrocinadores-simples');
    expect(
      slices.macros.map((macro) => macro.id),
      'nor its macro',
    ).toEqual(['abrir-a-sessao']);
    expect(
      slices.triggers.map((trigger) => trigger.id),
      'nor its trigger',
    ).toEqual(['gatilho-1']);
    const warnings = readRecordedLines().filter(
      (line) => line.level === 'warn' && line.message.includes('Patrocinadores (rodízio)'),
    );
    expect(warnings, 'one warning, at the first boot only, naming the height').toEqual([
      expect.objectContaining({ z_index: 12 }),
    ]);
  });
});
