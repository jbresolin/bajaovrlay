/**
 * An edit in Cadastros reaches the air (apps/server)
 *
 * What this module is for:
 *   A field that reads the entity library is always live (BAJAOVRLAY-19): when a team,
 *   person, sponsor or slot changes, the refresher rewrites every instance on air or in
 *   preview that reads it, through refreshBoundInstanceData as `sistema:vinculos`, the
 *   same command, rules and event-log exception as a source's new data. The instance's
 *   references are kept on its instanceBindings entry at the take (`entityFields`), so
 *   an item edited or deleted later does not change what is on air.
 *
 * What these tests prove (through a real store, the refresher run by hand):
 *   - Renaming team 7 changes the clock's title on air at once; the upsert is logged,
 *     the refresh is not.
 *   - Deleting team 7 keeps the last title on air (nothing on air is blanked, rule 4),
 *     and the next take of the item is refused, naming the car.
 *   - A clock in preview follows the edit too, and after "Tomar" the program instance
 *     keeps following.
 *   - A title typed on air with "Edição rápida" releases the reference: the next edit of
 *     the team does not overwrite it.
 *
 * What these tests deliberately do not cover:
 *   - Reading an attribute; the resolver tests.
 *   - Bindings to sources; the other live refresh tests.
 */
import { describe, expect, it } from 'vitest';

import {
  applyOrThrow,
  createClockItem,
  openStoreWithTheRefresher,
  readInstanceOn,
} from './liveRefresh.testSupport.js';

/** Team 7, Juriti Off-Road, as the Cadastros form saves it. */
function buildTeam7(teamName = 'Juriti Off-Road') {
  return { carNumber: 7, teamName, schoolName: 'UDESC', city: 'Joinville', state: 'SC' };
}

/** The clock's title reading the name of car 7's team. */
const titleFromTeam7 = {
  sessionName: { kind: 'entity', entityType: 'team', carNumber: 7, attribute: 'teamName' },
} as const;

/** A store with the refresher, team 7 saved, and a clock item whose title reads it. */
function openStoreWithTheClockReadingTeam7() {
  const opened = openStoreWithTheRefresher();
  applyOrThrow(opened.stateStore, {
    type: 'upsertEntity',
    entityType: 'team',
    record: buildTeam7(),
  });
  const clockItemId = createClockItem(
    opened.stateStore,
    'Relógio — equipe 7',
    'clock',
    titleFromTeam7,
  );
  return { ...opened, clockItemId };
}

describe('an entity edit through the store', () => {
  it('renames the title on air at once, logging the edit and not the refresh', () => {
    // Arrange: the clock on air with its title read from team 7.
    const { stateStore, refreshTimer, clockItemId } = openStoreWithTheClockReadingTeam7();
    applyOrThrow(stateStore, { type: 'takeItem', itemId: clockItemId });
    const titleBefore = readInstanceOn(stateStore, 'clock', 'program')?.resolvedData.sessionName;

    // Act: rename the team in Cadastros, and let the refresher run.
    applyOrThrow(stateStore, {
      type: 'upsertEntity',
      entityType: 'team',
      record: buildTeam7('Juriti Racing'),
    });
    refreshTimer.runThePendingRefresh();

    // Assert: the new name on air; the last row of the log is the edit itself.
    expect(titleBefore, 'the take read the team').toBe('Juriti Off-Road');
    expect(
      readInstanceOn(stateStore, 'clock', 'program')?.resolvedData.sessionName,
      'the edit reaches the air',
    ).toBe('Juriti Racing');
    expect(stateStore.readAllSlices().eventLog.at(-1)?.command, 'the refresh writes no row').toBe(
      'upsertEntity',
    );
  });

  it('keeps the last title on air when the team is deleted, and refuses the next take', () => {
    // Arrange: the clock on air with its title read from team 7.
    const { stateStore, refreshTimer, clockItemId } = openStoreWithTheClockReadingTeam7();
    applyOrThrow(stateStore, { type: 'takeItem', itemId: clockItemId });

    // Act: delete the team, let the refresher run, then try to take the item again.
    applyOrThrow(stateStore, { type: 'deleteEntity', entityType: 'team', carNumber: 7 });
    refreshTimer.runThePendingRefresh();
    const titleAfterTheDelete = readInstanceOn(stateStore, 'clock', 'program')?.resolvedData
      .sessionName;
    const secondTake = stateStore.applyCommand(
      { type: 'takeItem', itemId: clockItemId },
      'operador:mesa',
    );

    // Assert: nothing blanked on air; the next take refused, naming the car.
    expect(titleAfterTheDelete, 'the last good title stays on air').toBe('Juriti Off-Road');
    expect(secondTake, 'the take must be refused').toEqual({
      ok: false,
      error: {
        code: 'ENTITY_NOT_RESOLVED',
        message: 'Título: a equipe do carro 7 não está nos cadastros.',
      },
    });
  });

  it('updates a preview, and keeps following once it is taken', () => {
    // Arrange: the clock in preview, its title read from team 7.
    const { stateStore, refreshTimer, clockItemId } = openStoreWithTheClockReadingTeam7();
    applyOrThrow(stateStore, { type: 'previewItem', itemId: clockItemId, origin: 'manual' });

    // Act: rename the team, refresh, take the preview, rename again, refresh.
    applyOrThrow(stateStore, {
      type: 'upsertEntity',
      entityType: 'team',
      record: buildTeam7('Juriti Racing'),
    });
    refreshTimer.runThePendingRefresh();
    const titleInPreview = readInstanceOn(stateStore, 'clock', 'preview')?.resolvedData.sessionName;
    applyOrThrow(stateStore, { type: 'takePreview', layerId: 'clock' });
    applyOrThrow(stateStore, {
      type: 'upsertEntity',
      entityType: 'team',
      record: buildTeam7('Juriti Baja'),
    });
    refreshTimer.runThePendingRefresh();

    // Assert: Prévia showed the first rename, the air the second.
    expect(titleInPreview, 'a preview follows the library').toBe('Juriti Racing');
    expect(
      readInstanceOn(stateStore, 'clock', 'program')?.resolvedData.sessionName,
      'the reference moved to program with "Tomar"',
    ).toBe('Juriti Baja');
  });

  it('leaves a title typed on air alone at the next edit of the team', () => {
    // Arrange: the clock on air with its title read from team 7.
    const { stateStore, refreshTimer, clockItemId } = openStoreWithTheClockReadingTeam7();
    applyOrThrow(stateStore, { type: 'takeItem', itemId: clockItemId });
    const instanceId = readInstanceOn(stateStore, 'clock', 'program')?.id;

    // Act: type a title with "Edição rápida", then rename the team and refresh.
    applyOrThrow(stateStore, {
      type: 'updateInstanceData',
      instanceId,
      data: { sessionName: 'Equipe 7 — box' },
    });
    applyOrThrow(stateStore, {
      type: 'upsertEntity',
      entityType: 'team',
      record: buildTeam7('Juriti Racing'),
    });
    refreshTimer.runThePendingRefresh();

    // Assert: the typed title stays until the next take reads the item again.
    expect(
      readInstanceOn(stateStore, 'clock', 'program')?.resolvedData.sessionName,
      'what was typed on air is not overwritten',
    ).toBe('Equipe 7 — box');
  });
});
