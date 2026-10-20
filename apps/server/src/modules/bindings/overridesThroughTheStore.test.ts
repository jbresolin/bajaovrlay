/**
 * Corrections reach the air at once and last (apps/server)
 *
 * What this module is for:
 *   An override corrects what a source says, everywhere it is bound, until it is
 *   cleared. Setting or clearing one changes on-air data at once: the refresher sees the
 *   overrides slice change and rewrites every bound instance through
 *   refreshBoundInstanceData. A take reads the correction too, and the corrections are
 *   saved, so a restart keeps them. These tests run that through a real store.
 *
 * What these tests prove:
 *   - Correcting the session name changes the title on air at once, and clearing the
 *     correction puts the source's name back; the two commands are logged, the
 *     refreshes are not.
 *   - A take after a correction shows the corrected value.
 *   - The corrections are back after a restart, as they were.
 *   - Deleting a source drops its corrections.
 *
 * What these tests deliberately do not cover:
 *   - Each rule of setOverride and clearOverride; overrideCommands.test.ts.
 *   - Who may send them; authorizeBindingCommands.test.ts.
 */
import { describe, expect, it } from 'vitest';

import {
  createTemporaryDatabasePath,
  openDatabaseForTests,
} from '../../core/db/temporaryDatabase.testSupport.js';
import { createLogger } from '../../core/logger/createLogger.js';
import { createGraphicsFolderWithBuiltRaceClock } from '../../core/store/builtGraphicsFolder.testSupport.js';
import { createStateStore } from '../../core/store/createStateStore.js';
import {
  applyOrThrow,
  buildEnduroSession,
  buildSessionBinding,
  createClockItem,
  enduroSimulatorId,
  openStoreWithTheRefresher,
  pollTheSimulatorWithSession,
  readInstanceOn,
} from './liveRefresh.testSupport.js';

/** The operator's correction of the session name, as "Corrigir valor da fonte…" sends it. */
const setTheSessionNameCorrection = {
  type: 'setOverride',
  sourceId: enduroSimulatorId,
  scope: 'session',
  field: 'sessionName',
  value: 'Enduro — Etapa Nacional',
  reason: 'Nome oficial da prova.',
};

/** "Remover correção" of that correction. */
const clearTheSessionNameCorrection = {
  type: 'clearOverride',
  sourceId: enduroSimulatorId,
  scope: 'session',
  field: 'sessionName',
};

describe('an override through the store', () => {
  it('changes the title on air at once, and clearing it puts the name back', () => {
    // Arrange: the clock on air with its title bound live to the session name.
    const { stateStore, refreshTimer } = openStoreWithTheRefresher();
    pollTheSimulatorWithSession(stateStore, buildEnduroSession());
    const clockItemId = createClockItem(stateStore, 'Relógio — título da fonte', 'clock', {
      sessionName: buildSessionBinding('sessionName'),
    });
    applyOrThrow(stateStore, { type: 'takeItem', itemId: clockItemId });

    // Act: correct the session name, let the refresher run, then clear it and run again.
    applyOrThrow(stateStore, setTheSessionNameCorrection);
    refreshTimer.runThePendingRefresh();
    const titleWhileCorrected = readInstanceOn(stateStore, 'clock', 'program')?.resolvedData
      .sessionName;
    applyOrThrow(stateStore, clearTheSessionNameCorrection);
    refreshTimer.runThePendingRefresh();
    const titleAfterClearing = readInstanceOn(stateStore, 'clock', 'program')?.resolvedData
      .sessionName;

    // Assert: corrected at once, then the source's name back; the event log ends with the
    // two commands, the refreshes leaving no row.
    expect(titleWhileCorrected, 'the correction must reach the air').toBe(
      'Enduro — Etapa Nacional',
    );
    expect(titleAfterClearing, "the source's name must come back").toBe('Enduro de Resistência');
    expect(
      stateStore
        .readAllSlices()
        .eventLog.slice(-2)
        .map((row) => row.command),
      'only the two commands are logged',
    ).toEqual(['setOverride', 'clearOverride']);
  });

  it('shows the corrected value at the next take', () => {
    // Arrange: the session name corrected before the clock goes on air.
    const { stateStore } = openStoreWithTheRefresher();
    pollTheSimulatorWithSession(stateStore, buildEnduroSession());
    applyOrThrow(stateStore, setTheSessionNameCorrection);
    const clockItemId = createClockItem(stateStore, 'Relógio — título da fonte', 'clock', {
      sessionName: buildSessionBinding('sessionName'),
    });

    // Act: take the clock.
    applyOrThrow(stateStore, { type: 'takeItem', itemId: clockItemId });

    // Assert: the take read the correction.
    expect(
      readInstanceOn(stateStore, 'clock', 'program')?.resolvedData.sessionName,
      'a take must read the correction',
    ).toBe('Enduro — Etapa Nacional');
  });

  it('keeps the corrections across a restart', () => {
    // Arrange: a store on a file, with the session name corrected.
    const databasePath = createTemporaryDatabasePath();
    const graphicPackagesFolder = createGraphicsFolderWithBuiltRaceClock();
    const firstDatabase = openDatabaseForTests(databasePath);
    const storeBeforeRestart = createStateStore({
      database: firstDatabase,
      logger: createLogger({ level: 'silent' }),
      graphicPackagesFolder,
      readCurrentTime: () => new Date('2027-08-14T14:00:00.000Z'),
    });
    applyOrThrow(storeBeforeRestart, setTheSessionNameCorrection);
    const overridesBeforeRestart = storeBeforeRestart.readAllSlices().overrides;

    // Act: restart on the same file.
    firstDatabase.$client.close();
    const storeAfterRestart = createStateStore({
      database: openDatabaseForTests(databasePath),
      logger: createLogger({ level: 'silent' }),
      graphicPackagesFolder,
      readCurrentTime: () => new Date('2027-08-14T14:10:00.000Z'),
    });

    // Assert: the correction is back exactly as it was set.
    expect(overridesBeforeRestart, 'one correction was set').toHaveLength(1);
    expect(storeAfterRestart.readAllSlices().overrides, 'the corrections must survive').toEqual(
      overridesBeforeRestart,
    );
  });

  it('drops the corrections of a deleted source', () => {
    // Arrange: the session name of the simulator corrected.
    const { stateStore } = openStoreWithTheRefresher();
    applyOrThrow(stateStore, setTheSessionNameCorrection);

    // Act: delete the simulator.
    applyOrThrow(stateStore, { type: 'deleteDataSource', sourceId: enduroSimulatorId });

    // Assert: nothing left to correct.
    expect(stateStore.readAllSlices().overrides, 'its corrections go with it').toEqual([]);
  });
});
