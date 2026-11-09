/**
 * The seeded "Avisos" panel and its two notice items (apps/server)
 *
 * What this module is for:
 *   So events have something to show from the first boot (BAJAOVRLAY-44), the server
 *   seeds a quick-fire panel "Avisos" holding two items on the notice graphic and the
 *   notice layer, every field the event fills an event field: "Volta mais rápida" (the
 *   fastest-lap variant) and "Penalidade" (the penalty variant). The default rules show
 *   fastest laps with the first, incidents and manual events with the second. They are
 *   seeded together with the rules, once per database: on a new database, and on one
 *   written before the inbox existed, at its first boot with the inbox. A panel the
 *   operator deleted is not brought back.
 *
 * What these tests prove:
 *   - A new database has the panel after "Atalhos", the two items as described, and the
 *     rules naming them (leader changes and Super Chats have no item: no design yet).
 *   - A database written before the inbox gets the panel, the items and the rules at its
 *     next boot, its own panels and items kept.
 *   - Once deleted by the operator, the panel and its items stay deleted after a restart.
 *
 * What these tests deliberately do not cover:
 *   - The notice graphic itself (packages/graphics/notice) and showing an event with these
 *     items (the inbox's store tests use a race clock item, the only graphic they build).
 *   - The notice layer at z 45; loadInitialSlicesNewSeededLayer.test.ts covers seeded
 *     layers.
 */
import type { Item } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { openDatabaseForTests } from '../../core/db/temporaryDatabase.testSupport.js';
import {
  applyOrThrow,
  openEventInboxOnTheStore,
  restartTheServer,
} from './eventInboxOnTheStore.testSupport.js';

/** The items in the "Avisos" panel (Atalhos has its own seeded "Logo do canal"). */
function listItemsOfAvisos(items: Item[]): Item[] {
  return items.filter((item) => item.home.kind === 'quickFire' && item.home.panelId === 'avisos');
}

/** The "Volta mais rápida" item as the server seeds it. */
const seededFastestLapItem: Item = {
  id: 'volta-mais-rapida',
  home: { kind: 'quickFire', panelId: 'avisos' },
  order: 0,
  graphicId: 'notice',
  layerId: 'notice',
  label: 'Volta mais rápida',
  color: 'success',
  notes: '',
  fields: {
    variant: { kind: 'literal', value: 'fastestLap' },
    carNumber: { kind: 'eventField', path: 'carNumber' },
    teamName: { kind: 'eventField', path: 'teamName' },
    schoolName: { kind: 'eventField', path: 'schoolName' },
    lapNumber: { kind: 'eventField', path: 'lapNumber' },
    lapTimeText: { kind: 'eventField', path: 'lapTimeText' },
  },
};

/** The "Penalidade" item as the server seeds it. */
const seededPenaltyItem: Item = {
  id: 'penalidade',
  home: { kind: 'quickFire', panelId: 'avisos' },
  order: 1,
  graphicId: 'notice',
  layerId: 'notice',
  label: 'Penalidade',
  color: 'danger',
  notes: '',
  fields: {
    variant: { kind: 'literal', value: 'penalty' },
    noticeKind: { kind: 'eventField', path: 'noticeKind' },
    carNumber: { kind: 'eventField', path: 'carNumber' },
    teamName: { kind: 'eventField', path: 'teamName' },
    schoolName: { kind: 'eventField', path: 'schoolName' },
    reason: { kind: 'eventField', path: 'reason' },
    penaltyText: { kind: 'eventField', path: 'penaltyText' },
  },
};

describe('the seeded "Avisos" panel', () => {
  it('starts a new database with the panel, its two items and the rules naming them', () => {
    // Arrange: nothing; a new database.

    // Act: open the store on it.
    const slices = openEventInboxOnTheStore().stateStore.readAllSlices();

    // Assert: the panel after "Atalhos", the two items in it, and the rules wired.
    expect(slices.quickFirePanels, 'the panel "Avisos" follows "Atalhos"').toEqual([
      { id: 'atalhos', name: 'Atalhos', order: 0 },
      { id: 'avisos', name: 'Avisos', order: 1 },
    ]);
    expect(listItemsOfAvisos(slices.items), 'the two notice items, as seeded').toEqual([
      seededFastestLapItem,
      seededPenaltyItem,
    ]);
    expect(
      slices.eventRules.map((rule) => [rule.kind, rule.itemId]),
      'fastest laps, incidents and manual events have their item',
    ).toEqual([
      ['newIncident', 'penalidade'],
      ['fastestLap', 'volta-mais-rapida'],
      ['leaderChanged', null],
      ['manual', 'penalidade'],
      ['superChat', null],
    ]);
  });

  it('is added to a database written before the inbox, at its next boot', () => {
    // Arrange: a database as BAJAOVRLAY-22 left it: no rules row, only the panel
    // "Atalhos", and none of the two items.
    const inboxBefore = openEventInboxOnTheStore();
    inboxBefore.shutDown();
    const olderDatabase = openDatabaseForTests(inboxBefore.databasePath);
    olderDatabase.$client.prepare("DELETE FROM slices WHERE name = 'eventRules'").run();
    olderDatabase.$client
      .prepare("UPDATE slices SET json = ? WHERE name = 'quickFirePanels'")
      .run(JSON.stringify([{ id: 'atalhos', name: 'Atalhos', order: 0 }]));
    olderDatabase.$client.prepare("UPDATE slices SET json = '[]' WHERE name = 'items'").run();
    olderDatabase.$client.close();

    // Act: boot on it.
    const slices = openEventInboxOnTheStore(inboxBefore).stateStore.readAllSlices();

    // Assert: the panel, the items and the wired rules are all there.
    expect(
      slices.quickFirePanels.map((panel) => panel.name),
      'the older panel stays first and "Avisos" is added',
    ).toEqual(['Atalhos', 'Avisos']);
    expect(
      slices.items.map((item) => item.id),
      'the two notice items are added',
    ).toEqual(['volta-mais-rapida', 'penalidade']);
    expect(
      slices.eventRules.find((rule) => rule.kind === 'fastestLap')?.itemId,
      'the rules name them',
    ).toBe('volta-mais-rapida');
  });

  it('stays deleted after a restart once the operator deleted it', () => {
    // Arrange: the operator deletes the two items and the panel.
    const inbox = openEventInboxOnTheStore();
    applyOrThrow(inbox.stateStore, { type: 'deleteItem', itemId: 'volta-mais-rapida' });
    applyOrThrow(inbox.stateStore, { type: 'deleteItem', itemId: 'penalidade' });
    applyOrThrow(inbox.stateStore, { type: 'deleteQuickFirePanel', panelId: 'avisos' });

    // Act: restart.
    const slices = restartTheServer(inbox).stateStore.readAllSlices();

    // Assert: neither the panel nor the items came back.
    expect(
      slices.quickFirePanels.map((panel) => panel.id),
      'a deleted panel is not seeded again',
    ).toEqual(['atalhos']);
    expect(listItemsOfAvisos(slices.items), 'nor its items').toEqual([]);
  });
});
