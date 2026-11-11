/**
 * The seeded event templates (apps/server)
 *
 * What this module is for:
 *   So events have something to show from the first boot (BAJAOVRLAY-44), the server
 *   seeds two templates on the notice graphic and the notice layer, every field the event
 *   fills an event field: "Volta mais rápida" (the fastest-lap variant) and "Penalidade"
 *   (the penalty variant), and a third on the Super Chat graphic, "Super Chat"
 *   (BAJAOVRLAY-35). The default rules show fastest laps with the first, incidents and
 *   manual events with the second, Super Chats with the third. Since BAJAOVRLAY-67 they
 *   live in "Modelos de evento", shown in "Regras", not on a quick-fire panel: no panel
 *   "Avisos" is seeded. They are seeded together with the rules, once per database: on a
 *   new database, and on one written before the inbox existed, at its first boot with the
 *   inbox. A template the operator deleted is not brought back.
 *
 * What these tests prove:
 *   - A new database has no panel "Avisos", the three templates as described, and the
 *     rules naming them (leader changes have no item: no design yet; Super Chats have the
 *     "Super Chat" item on the super-chat graphic, BAJAOVRLAY-35).
 *   - A database whose Super Chat rule still has no item gets the "Super Chat" template and
 *     the rule naming it, once; one whose operator chose another item, or chose none and
 *     kept the item, keeps that choice; one whose panel "Avisos" was deleted gets nothing;
 *     and an operator who deletes the item and clears the rule never gets it back (gate 2
 *     of PR #54: the seed is remembered in seeds_done, as superChatItem).
 *   - A database written before the inbox gets the templates and the rules at its next
 *     boot, its own panels and items kept.
 *   - Once deleted by the operator, the templates stay deleted after a restart.
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
import {
  makeTheDatabaseOlderThanTemplatesInRegras,
  readSeedNamesDoneOfDatabase,
} from './eventTemplatesOnOlderDatabases.testSupport.js';

/** The event templates, in "Modelos de evento", first to last. */
function listEventTemplates(items: Item[]): Item[] {
  return items
    .filter((item) => item.home.kind === 'eventTemplates')
    .sort((first, second) => first.order - second.order);
}

/** The "Volta mais rápida" item as the server seeds it. */
const seededFastestLapItem: Item = {
  id: 'volta-mais-rapida',
  home: { kind: 'eventTemplates' },
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
  home: { kind: 'eventTemplates' },
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
  home: { kind: 'eventTemplates' },
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
 * Rewrites a closed database as one written before BAJAOVRLAY-35: the templates on the
 * panel "Avisos" (as before BAJAOVRLAY-67), the Super Chat rule with no item, no "Super
 * Chat" item and no row remembering its seed, the rest as seeded. With
 * `isAvisosDeleted`, the operator had deleted the panel "Avisos" and its two templates.
 */
function makeTheDatabaseOlderThanSuperChats(
  databasePath: string,
  isAvisosDeleted: boolean = false,
): void {
  makeTheDatabaseOlderThanTemplatesInRegras(databasePath, []);
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
  const idsLeftOut = isAvisosDeleted
    ? ['super-chat', 'volta-mais-rapida', 'penalidade']
    : ['super-chat'];
  writeSlice(
    'items',
    items.filter((item) => !idsLeftOut.includes(item.id)),
  );
  if (isAvisosDeleted) {
    writeSlice('quickFirePanels', [
      { id: 'atalhos', name: 'Atalhos', order: 0 },
      { id: 'logo', name: 'Logo', order: 2 },
    ]);
  }
  // Nor the seeds_done row that remembers the seed was considered (gate 2 of PR #54).
  database.$client.prepare("DELETE FROM seeds_done WHERE name = 'superChatItem'").run();
  database.$client.close();
}

describe('the seeded event templates', () => {
  it('starts a new database with the three templates, the rules naming them, and no "Avisos"', () => {
    // Arrange: nothing; a new database.

    // Act: open the store on it.
    const slices = openEventInboxOnTheStore().stateStore.readAllSlices();

    // Assert: no panel "Avisos" (only "Atalhos", the channel logo's "Logo", the Super
    // Prime's "Chave" and the sponsor roll's "Patrocinadores"), the three templates, and the
    // rules wired.
    expect(slices.quickFirePanels, 'no panel holds the templates').toEqual([
      { id: 'atalhos', name: 'Atalhos', order: 0 },
      { id: 'logo', name: 'Logo', order: 1 },
      { id: 'chave', name: 'Chave', order: 2 },
      { id: 'patrocinadores', name: 'Patrocinadores', order: 3 },
    ]);
    expect(listEventTemplates(slices.items), 'the templates, as seeded').toEqual([
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
    // "Atalhos", and none of the templates.
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

    // Assert: the templates and the wired rules are there, and the panels as they were.
    expect(
      slices.quickFirePanels.map((panel) => panel.name),
      'the older panel stays, and no "Avisos" is added',
    ).toEqual(['Atalhos']);
    expect(
      listEventTemplates(slices.items).map((item) => item.id),
      'the three templates are added',
    ).toEqual(['volta-mais-rapida', 'penalidade', 'super-chat']);
    expect(
      slices.eventRules.find((rule) => rule.kind === 'fastestLap')?.itemId,
      'the rules name them',
    ).toBe('volta-mais-rapida');
  });

  it('stay deleted after a restart once the operator deleted them', () => {
    // Arrange: the operator deletes the three templates.
    const inbox = openEventInboxOnTheStore();
    applyOrThrow(inbox.stateStore, { type: 'deleteItem', itemId: 'volta-mais-rapida' });
    applyOrThrow(inbox.stateStore, { type: 'deleteItem', itemId: 'penalidade' });
    applyOrThrow(inbox.stateStore, { type: 'deleteItem', itemId: 'super-chat' });

    // Act: restart.
    const slices = restartTheServer(inbox).stateStore.readAllSlices();

    // Assert: none came back.
    expect(listEventTemplates(slices.items), 'deleted templates are not seeded again').toEqual([]);
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

    // Assert: the item is a template after the other two, and the rule names it.
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

  it('is added once: an operator who deleted it and cleared the rule never gets it back', () => {
    // Arrange: an older database gets the item at its boot; the operator then deletes it
    // and sets the Super Chat rule to no item.
    const inboxBefore = openEventInboxOnTheStore();
    inboxBefore.shutDown();
    makeTheDatabaseOlderThanSuperChats(inboxBefore.databasePath);
    const inbox = openEventInboxOnTheStore(inboxBefore);
    applyOrThrow(inbox.stateStore, { type: 'deleteItem', itemId: 'super-chat' });
    applyOrThrow(inbox.stateStore, { type: 'updateEventRule', kind: 'superChat', itemId: null });

    // Act: restart.
    const slices = restartTheServer(inbox).stateStore.readAllSlices();

    // Assert: neither the item nor the rule's item came back.
    expect(
      slices.items.some((item) => item.id === 'super-chat'),
      'a seed the operator undid must not come back',
    ).toBe(false);
    expect(
      slices.eventRules.find((rule) => rule.kind === 'superChat')?.itemId,
      'the rule keeps the operator’s "no item"',
    ).toBeNull();
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
          rules.map((rule) =>
            rule.kind === 'superChat' ? { ...rule, itemId: 'penalidade' } : rule,
          ),
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
    inbox.shutDown();
    makeTheDatabaseOlderThanSuperChats(inbox.databasePath, true);

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

describe('where the "Super Chat" seed is remembered', () => {
  it('records superChatItem in seeds_done at the first boot', () => {
    // Arrange: a new database.
    const inbox = openEventInboxOnTheStore();
    inbox.shutDown();

    // Act: read the seeds the boot recorded as done.
    const seedNamesDone = readSeedNamesDoneOfDatabase(inbox.databasePath);

    // Assert: the Super Chat seed is there, beside the channel logo's, and so is the move
    // of the templates off the panels: a new database never needs it.
    expect(
      seedNamesDone,
      'the one table of one-off seeds (BAJAOVRLAY-63) remembers the Super Chat item too',
    ).toContain('superChatItem');
    expect(
      seedNamesDone,
      'a new database has its templates where they belong from the start',
    ).toContain('eventTemplatesOffQuickFire');
  });
});
