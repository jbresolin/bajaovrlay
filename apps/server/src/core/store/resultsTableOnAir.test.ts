/**
 * The results table taken and updated on the server, with its real manifest (apps/server)
 *
 * What this module is for:
 *   "Tabela de resultado" (BAJAOVRLAY-83) shows a result page as the site writes it: text
 *   cells, the site's rank or none, and the item's own settings ("Colunas mostradas",
 *   "Ordenar por", "Sentido"). The item form checks them first, but the server's Ajv check
 *   of the manifest's schema stays the authority over what reaches a take or an update.
 *
 * What these tests prove (with a real SQLite file, and the manifest read from
 * packages/graphics/results-table):
 *   - A take of the overall page during spoilers (no rank, "SPOILERS" in the cells) goes
 *     on air with its rows and settings as sent.
 *   - A take with a cell written as a number is refused with INVALID_GRAPHIC_DATA, and
 *     nothing goes on air.
 *   - An on-air update with a direction that is neither "ascending" nor "descending" is
 *     refused, and the page on air stays as it was.
 *
 * What these tests deliberately do not cover:
 *   - Binding the fields to a source: the shared shape and preset tests.
 *   - The graphic's own check; its manifest-data agreement test.
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  createTemporaryDatabasePath,
  openDatabaseForTests,
} from '../db/temporaryDatabase.testSupport.js';
import { createLogger } from '../logger/createLogger.js';
import { createGraphicsFolderWithBuiltPackage } from './builtGraphicsFolder.testSupport.js';
import { createStateStore, type StateStore } from './createStateStore.js';

const operatorActor = 'operador:mesa-principal';

/** The real manifest of the results table, as the package ships it. */
function readTheResultsTableManifest(): object {
  const manifestAddress = new URL(
    '../../../../../packages/graphics/results-table/results-table.ograf.json',
    import.meta.url,
  );
  return JSON.parse(readFileSync(manifestAddress, 'utf8')) as object;
}

/** A store on a new database file that knows the built results table. */
function openStoreWithTheResultsTable(): StateStore {
  return createStateStore({
    database: openDatabaseForTests(createTemporaryDatabasePath()),
    logger: createLogger({ level: 'silent' }),
    graphicPackagesFolder: createGraphicsFolderWithBuiltPackage(
      'results-table',
      readTheResultsTableManifest(),
    ),
    readCurrentTime: () => new Date('2026-11-23T13:00:00.000Z'),
  });
}

/** Two rows of 25SU's overall page during spoilers: no rank, Projeto and Total hidden. */
function buildTwoRowsDuringSpoilers(): unknown[] {
  return [
    {
      carNumber: 1,
      teamName: 'Procobaja',
      schoolName: 'UTFPR-CP',
      cells: ['-15', 'SPOILERS', '84.71', 'SPOILERS'],
    },
    {
      carNumber: 2,
      teamName: 'Sagui',
      schoolName: 'UFPR',
      cells: ['0', 'SPOILERS', '91.3', 'SPOILERS'],
    },
  ];
}

/** Prepares a results table item with these rows and takes it; answers the take's outcome. */
function prepareAndTakeResultsTable(stateStore: StateStore, entries: unknown[]) {
  const literal = (value: unknown) => ({ kind: 'literal' as const, value });
  const createOutcome = stateStore.applyCommand(
    {
      type: 'createItem',
      home: { kind: 'rundown', rundownId: 'sessao-principal' },
      graphicId: 'results-table',
      layerId: 'fullscreen',
      label: 'Geral com spoilers',
      fields: {
        entries: literal(entries),
        columnHeads: literal(['Segurança', 'Projeto', 'Enduro', 'Total']),
        tableName: literal('Geral'),
        columnsShown: literal('Segurança, Enduro, Total'),
        sortByColumn: literal('Enduro'),
        sortDirection: literal('descending'),
      },
    },
    operatorActor,
  );
  if (!createOutcome.ok || createOutcome.createdItemId === undefined) {
    return createOutcome;
  }
  return stateStore.applyCommand(
    { type: 'takeItem', itemId: createOutcome.createdItemId },
    operatorActor,
  );
}

/** The results table on air on the program output, if any. */
function readResultsTableOnAir(stateStore: StateStore) {
  return stateStore
    .readAllSlices()
    .instances.find(
      (instance) => instance.graphicId === 'results-table' && instance.target === 'program',
    );
}

describe('the results table at the take', () => {
  it('takes the overall page during spoilers on air with its settings', () => {
    // Arrange: the store with the real results table.
    const stateStore = openStoreWithTheResultsTable();

    // Act: prepare the page with spoilers and take it.
    const outcome = prepareAndTakeResultsTable(stateStore, buildTwoRowsDuringSpoilers());

    // Assert: on air with the rows and the order asked for.
    expect(outcome, 'the take must be accepted').toEqual({ ok: true });
    const resolvedData = readResultsTableOnAir(stateStore)?.resolvedData;
    expect(resolvedData?.entries, 'the rows as sent, "SPOILERS" kept').toEqual(
      buildTwoRowsDuringSpoilers(),
    );
    expect(resolvedData?.sortDirection, 'the direction as chosen').toBe('descending');
  });

  it('refuses a cell written as a number, and nothing goes on air', () => {
    // Arrange: the store, and Procobaja's Enduro cell sent as a number.
    const stateStore = openStoreWithTheResultsTable();
    const rows = buildTwoRowsDuringSpoilers();
    rows[0] = { ...(rows[0] as object), cells: ['-15', 'SPOILERS', 84.71, 'SPOILERS'] };

    // Act: prepare and take it.
    const outcome = prepareAndTakeResultsTable(stateStore, rows);

    // Assert: refused for the data, nothing on air.
    expect(outcome.ok ? undefined : outcome.error.code, 'a number cell must be refused').toBe(
      'INVALID_GRAPHIC_DATA',
    );
    expect(readResultsTableOnAir(stateStore), 'nothing goes on air').toBeUndefined();
  });
});

describe('the results table updated on air', () => {
  it('refuses a direction that is neither, and the page on air stays', () => {
    // Arrange: the page with spoilers on air.
    const stateStore = openStoreWithTheResultsTable();
    prepareAndTakeResultsTable(stateStore, buildTwoRowsDuringSpoilers());
    const instanceId = readResultsTableOnAir(stateStore)?.id ?? '';

    // Act: an on-air update with "crescente", the label, not the value.
    const outcome = stateStore.applyCommand(
      { type: 'updateInstanceData', instanceId, data: { sortDirection: 'crescente' } },
      operatorActor,
    );

    // Assert: refused, and the direction on air unchanged.
    expect(outcome.ok ? undefined : outcome.error.code, 'the direction must be refused').toBe(
      'INVALID_GRAPHIC_DATA',
    );
    expect(
      readResultsTableOnAir(stateStore)?.resolvedData.sortDirection,
      'the page on air keeps its direction',
    ).toBe('descending');
  });
});
