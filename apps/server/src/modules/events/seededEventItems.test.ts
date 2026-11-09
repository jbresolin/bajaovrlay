/**
 * The seeded "Avisos" panel and its two notice items (apps/server)
 *
 * What this module is for:
 *   So events have something to show from the first boot (BAJAOVRLAY-44), the server
 *   seeds a quick-fire panel "Avisos" holding two items on the notice graphic and the
 *   notice layer, every field the event fills an event field: "Volta mais rápida" (the
 *   fastest-lap variant) and "Penalidade" (the penalty variant), and a third on the Super
 *   Chat graphic, "Super Chat" (BAJAOVRLAY-35). The default rules show fastest laps with
 *   the first, incidents and manual events with the second, Super Chats with the third. They are
 *   seeded together with the rules, once per database: on a new database, and on one
 *   written before the inbox existed, at its first boot with the inbox. A panel the
 *   operator deleted is not brought back.
 *
 * What these tests prove:
 *   - A new database has the panel after "Atalhos", the three items as described, and the
 *     rules naming them (leader changes have no item: no design yet; Super Chats have the
 *     "Super Chat" item on the super-chat graphic, BAJAOVRLAY-35).
 *   - A database whose Super Chat rule still has no item gets the "Super Chat" item and the
 *     rule naming it, once; one whose operator chose another item, or chose none and kept
 *     the item, keeps that choice; one whose panel "Avisos" was deleted gets nothing.
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

/** The "Super Chat" item as the server seeds it (BAJAOVRLAY-35). */
const seededSuperChatItem: Item = {
  id: 'super-chat',
  home: { kind: 'quickFire', panelId: 'avisos' },
  order: 2,
  graphicId: 'super-chat',
  layerId: 'notice',
  label: 'Super Chat',
  color: 'warning',
  notes: '',
  fields: {
    amountText: { kind: 'eventField', path: 'amountText' },
    authorName: { kind: 'eventField', path: 'authorName' },
    messageText: { kind: 'eventField', path: 'messageText' },
  },
};

/**
 * Rewrites a closed database as one written before BAJAOVRLAY-35: the Super Chat rule with
 * no item and no "Super Chat" item, the rest as seeded.
 */
function makeTheDatabaseOlderThanSuperChats(databasePath: string): void {
  const database = openDatabaseForTests(databasePath);
  const readSlice = (name: string): unknown =>
    JSON.parse(
      (
        database.$client.prepare('SELECT json FROM slices WHERE name = ?').get(name) as {
          json: string;
        }
      ).json,
    );
  const writeSlice = (name: string, value: unknown): void => {
    database.$client
      .prepare('UPDATE slices SET json = ? WHERE name = ?')
      .run(JSON.stringify(value), name);
  };
  const rules = readSlice('eventRules') as Array<{ kind: string; itemId: string | null }>;
  writeSlice(
    'eventRules',
    rules.map((rule) => (rule.kind === 'superChat' ? { ...rule, itemId: null } : rule)),
  );
  const items = readSlice('items') as Array<{ id: string }>;
  writeSlice(
    'items',
    items.filter((item) => item.id !== 'super-chat'),
  );
  database.$client.close();
}

describe('the seeded "Avisos" panel', () => {
  it('starts a new database with the panel, its two items and the rules naming them', () => {
    // Arrange: nothing; a new database.

    // Act: open the store on it.
    const slices = openEventInboxOnTheStore().stateStore.readAllSlices();

    // Assert: the panel after "Atalhos" (and before the channel logo's "Logo", seeded
    // after it), the three items in it, and the rules wired.
    expect(slices.quickFirePanels, 'the panel "Avisos" follows "Atalhos"').toEqual([
      { id: 'atalhos', name: 'Atalhos', order: 0 },
      { id: 'avisos', name: 'Avisos', order: 1 },
      { id: 'logo', name: 'Logo', order: 2 },
    ]);
    expect(listItemsOfAvisos(slices.items), 'the notice items, as seeded').toEqual([
      seededFastestLapItem,
      seededPenaltyItem,
      seededSuperChatItem,
    ]);
    expect(
      slices.eventRules.map((rule) => [rule.kind, rule.itemId]),
      'fastest laps, incidents, manual events and Super Chats have their item',
    ).toEqual([
      ['newIncident', 'penalidade'],
      ['fastestLap', 'volta-mais-rapida'],
      ['leaderChanged', null],
      ['manual', 'penalidade'],
      ['superChat', 'super-chat'],
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
      'the three notice items are added',
    ).toEqual(['volta-mais-rapida', 'penalidade', 'super-chat']);
    expect(
      slices.eventRules.find((rule) => rule.kind === 'fastestLap')?.itemId,
      'the rules name them',
    ).toBe('volta-mais-rapida');
  });

  it('stays deleted after a restart once the operator deleted it', () => {
    // Arrange: the operator deletes the three items and the panel.
    const inbox = openEventInboxOnTheStore();
    applyOrThrow(inbox.stateStore, { type: 'deleteItem', itemId: 'volta-mais-rapida' });
    applyOrThrow(inbox.stateStore, { type: 'deleteItem', itemId: 'penalidade' });
    applyOrThrow(inbox.stateStore, { type: 'deleteItem', itemId: 'super-chat' });
    applyOrThrow(inbox.stateStore, { type: 'deleteQuickFirePanel', panelId: 'avisos' });

    // Act: restart.
    const slices = restartTheServer(inbox).stateStore.readAllSlices();

    // Assert: neither the panel nor the items came back; the channel logo's panel stays.
    expect(
      slices.quickFirePanels.map((panel) => panel.id),
      'a deleted panel is not seeded again',
    ).toEqual(['atalhos', 'logo']);
    expect(listItemsOfAvisos(slices.items), 'nor its items').toEqual([]);
  });
});

describe('the seeded "Super Chat" item on a database older than it', () => {
  it('is added, and named by the rule, when the rule still has no item', () => {
    // Arrange: a database as it was before BAJAOVRLAY-35.
    const inboxBefore = openEventInboxOnTheStore();
    inboxBefore.shutDown();
    makeTheDatabaseOlderThanSuperChats(inboxBefore.databasePath);

    // Act: boot on it.
    const slices = openEventInboxOnTheStore(inboxBefore).stateStore.readAllSlices();

    // Assert: the item is in "Avisos", after the other two, and the rule names it.
    expect(
      slices.items.find((item) => item.id === 'super-chat'),
      'the "Super Chat" item must be added as seeded',
    ).toEqual(seededSuperChatItem);
    expect(
      slices.eventRules.find((rule) => rule.kind === 'superChat')?.itemId,
      'the Super Chat rule must name it',
    ).toBe('super-chat');
  });

  it('is added once: an operator who later chose "no item" keeps that choice', () => {
    // Arrange: the item seeded, then the operator sets the rule to no item.
    const inbox = openEventInboxOnTheStore();
    applyOrThrow(inbox.stateStore, { type: 'updateEventRule', kind: 'superChat', itemId: null });

    // Act: restart.
    const slices = restartTheServer(inbox).stateStore.readAllSlices();

    // Assert: the rule still has no item; the item itself is kept for the operator.
    expect(
      slices.eventRules.find((rule) => rule.kind === 'superChat')?.itemId,
      'the operator’s "no item" must be kept',
    ).toBeNull();
    expect(
      slices.items.some((item) => item.id === 'super-chat'),
      'the item stays where it was',
    ).toBe(true);
  });

  it('leaves alone a rule whose operator chose another item', () => {
    // Arrange: an older database whose operator set the Super Chat rule to "Penalidade".
    const inboxBefore = openEventInboxOnTheStore();
    inboxBefore.shutDown();
    makeTheDatabaseOlderThanSuperChats(inboxBefore.databasePath);
    const database = openDatabaseForTests(inboxBefore.databasePath);
    const rules = JSON.parse(
      (
        database.$client.prepare("SELECT json FROM slices WHERE name = 'eventRules'").get() as {
          json: string;
        }
      ).json,
    ) as Array<{ kind: string; itemId: string | null }>;
    database.$client
      .prepare("UPDATE slices SET json = ? WHERE name = 'eventRules'")
      .run(
        JSON.stringify(
          rules.map((rule) => (rule.kind === 'superChat' ? { ...rule, itemId: 'penalidade' } : rule)),
        ),
      );
    database.$client.close();

    // Act: boot on it.
    const slices = openEventInboxOnTheStore(inboxBefore).stateStore.readAllSlices();

    // Assert: the operator's item kept, and no "Super Chat" item added.
    expect(
      slices.eventRules.find((rule) => rule.kind === 'superChat')?.itemId,
      'the operator’s choice must be kept',
    ).toBe('penalidade');
    expect(
      slices.items.some((item) => item.id === 'super-chat'),
      'no item is added beside the operator’s choice',
    ).toBe(false);
  });

  it('is not added when the operator deleted the panel "Avisos"', () => {
    // Arrange: an older database whose operator deleted the panel and its notice items.
    const inbox = openEventInboxOnTheStore();
    applyOrThrow(inbox.stateStore, { type: 'deleteItem', itemId: 'volta-mais-rapida' });
    applyOrThrow(inbox.stateStore, { type: 'deleteItem', itemId: 'penalidade' });
    applyOrThrow(inbox.stateStore, { type: 'deleteItem', itemId: 'super-chat' });
    applyOrThrow(inbox.stateStore, { type: 'deleteQuickFirePanel', panelId: 'avisos' });
    inbox.shutDown();
    makeTheDatabaseOlderThanSuperChats(inbox.databasePath);

    // Act: boot on it.
    const slices = openEventInboxOnTheStore(inbox).stateStore.readAllSlices();

    // Assert: nothing seeded, the rule still with no item.
    expect(
      slices.items.some((item) => item.id === 'super-chat'),
      'a deleted panel is not brought back for the item',
    ).toBe(false);
    expect(
      slices.eventRules.find((rule) => rule.kind === 'superChat')?.itemId,
      'the rule keeps no item',
    ).toBeNull();
  });
});
