/**
 * The entity library through the store: logged, operators only, kept across a restart
 * (apps/server)
 *
 * What this module is for:
 *   The entity commands go through the one command path like every other (validate →
 *   authorise → apply → save → event log → broadcast). The library is the operator's own
 *   data, typed on the Cadastros page, so it is saved and every change is logged.
 *
 * What these tests prove (with a real SQLite file in a temporary folder):
 *   - An upsert and a delete each write an event-log row naming the command and what
 *     changed.
 *   - An import's row names the type and the keys it carried, not every record, so a
 *     hundred teams do not ride along in the eventLog slice every page is sent again.
 *   - A renderer may not send them (NOT_ALLOWED), and the refusal is logged.
 *   - Teams, people, sponsors and the schedule are back after a restart, as they were.
 *
 * What these tests deliberately do not cover:
 *   - Each rule of the commands; reducers/entityCommands.test.ts.
 *   - On-air fields that reference a record; the entity reference tests.
 */
import { describe, expect, it } from 'vitest';

import {
  createTemporaryDatabasePath,
  openDatabaseForTests,
} from '../../core/db/temporaryDatabase.testSupport.js';
import { createLogger } from '../../core/logger/createLogger.js';
import { createGraphicsFolderWithBuiltRaceClock } from '../../core/store/builtGraphicsFolder.testSupport.js';
import { createStateStore, type StateStore } from '../../core/store/createStateStore.js';
import {
  buildMasterAndSupportSponsors,
  buildNarratorAndJudge,
  buildSaturdayEnduroSlots,
  buildTeam7,
  buildTeam13,
  buildTeam42,
} from './entitySlices.testSupport.js';

const operatorActor = 'operador:tablet-cadastros';
const rendererActor = 'renderer:obs-programa';

/** A store on a new database file, at 09:00 on the Saturday of the event. */
function openStoreOnANewFile(): { stateStore: StateStore; reopen: () => StateStore } {
  const databasePath = createTemporaryDatabasePath();
  const graphicPackagesFolder = createGraphicsFolderWithBuiltRaceClock();
  const database = openDatabaseForTests(databasePath);
  const stateStore = createStateStore({
    database,
    logger: createLogger({ level: 'silent' }),
    graphicPackagesFolder,
    readCurrentTime: () => new Date('2026-11-14T12:00:00.000Z'),
  });
  const reopen = () => {
    database.$client.close();
    return createStateStore({
      database: openDatabaseForTests(databasePath),
      logger: createLogger({ level: 'silent' }),
      graphicPackagesFolder,
      readCurrentTime: () => new Date('2026-11-14T12:30:00.000Z'),
    });
  };
  return { stateStore, reopen };
}

/** Applies a command as the operator and fails the test if it was refused. */
function applyAsTheOperator(stateStore: StateStore, command: unknown): void {
  const outcome = stateStore.applyCommand(command, operatorActor);
  if (!outcome.ok) {
    throw new Error(`the command was refused: ${outcome.error.message}`);
  }
}

describe('the entity commands through the store', () => {
  it('writes one event-log row for an upsert and one for a delete', () => {
    // Arrange: a store with an empty library.
    const { stateStore } = openStoreOnANewFile();

    // Act: save team 42, then delete it.
    applyAsTheOperator(stateStore, {
      type: 'upsertEntity',
      entityType: 'team',
      record: buildTeam42(),
    });
    applyAsTheOperator(stateStore, { type: 'deleteEntity', entityType: 'team', carNumber: 42 });

    // Assert: two rows, each with the operator, the command and what it carried.
    const lastTwoRows = stateStore.readAllSlices().eventLog.slice(-2);
    expect(
      lastTwoRows.map((row) => [row.actor, row.command, row.result.status]),
      'one row per command, both ok',
    ).toEqual([
      [operatorActor, 'upsertEntity', 'ok'],
      [operatorActor, 'deleteEntity', 'ok'],
    ]);
    expect(lastTwoRows[0]?.payload, 'the upsert row carries the record').toEqual({
      type: 'upsertEntity',
      entityType: 'team',
      record: buildTeam42(),
    });
  });

  it("writes an import's row with the type and the keys, not every record", () => {
    // Arrange: a store with an empty library.
    const { stateStore } = openStoreOnANewFile();

    // Act: import three teams.
    applyAsTheOperator(stateStore, {
      type: 'importEntities',
      entityType: 'team',
      records: [buildTeam42(), buildTeam7(), buildTeam13()],
    });

    // Assert: the row says which cars were imported, and the teams are all there.
    const lastRow = stateStore.readAllSlices().eventLog.at(-1);
    expect(lastRow?.payload, 'the import row names the keys').toEqual({
      type: 'importEntities',
      entityType: 'team',
      recordCount: 3,
      recordKeys: [42, 7, 13],
    });
    expect(stateStore.readAllSlices().teams, 'every imported team is stored').toHaveLength(3);
  });

  it('refuses an upsert from a renderer and logs the refusal', () => {
    // Arrange: a store with an empty library.
    const { stateStore } = openStoreOnANewFile();

    // Act: the OBS page tries to save a team.
    const outcome = stateStore.applyCommand(
      { type: 'upsertEntity', entityType: 'team', record: buildTeam42() },
      rendererActor,
    );

    // Assert: refused as not allowed, nothing stored, the refusal logged.
    expect(outcome.ok === false && outcome.error.code, 'a screen may not edit the library').toBe(
      'NOT_ALLOWED',
    );
    expect(stateStore.readAllSlices().teams, 'no team is stored').toEqual([]);
    expect(stateStore.readAllSlices().eventLog.at(-1)?.result.status, 'logged as failed').toBe(
      'failed',
    );
  });

  it('keeps teams, people, sponsors and the schedule across a restart', () => {
    // Arrange: one of each kind of record saved.
    const { stateStore, reopen } = openStoreOnANewFile();
    applyAsTheOperator(stateStore, {
      type: 'importEntities',
      entityType: 'team',
      records: [buildTeam42(), buildTeam7()],
    });
    applyAsTheOperator(stateStore, {
      type: 'importEntities',
      entityType: 'person',
      records: buildNarratorAndJudge(),
    });
    applyAsTheOperator(stateStore, {
      type: 'importEntities',
      entityType: 'sponsor',
      records: buildMasterAndSupportSponsors(),
    });
    applyAsTheOperator(stateStore, {
      type: 'importEntities',
      entityType: 'scheduleSlot',
      records: buildSaturdayEnduroSlots(),
    });

    // Act: restart on the same file.
    const storeAfterRestart = reopen();

    // Assert: the library is back exactly as it was saved.
    const slicesAfterRestart = storeAfterRestart.readAllSlices();
    expect(slicesAfterRestart.teams, 'the teams must survive').toEqual([
      buildTeam42(),
      buildTeam7(),
    ]);
    expect(slicesAfterRestart.people, 'the people must survive').toEqual(buildNarratorAndJudge());
    expect(slicesAfterRestart.sponsors, 'the sponsors must survive').toEqual(
      buildMasterAndSupportSponsors(),
    );
    expect(slicesAfterRestart.scheduleSlots, 'the schedule must survive').toEqual(
      buildSaturdayEnduroSlots(),
    );
  });
});
