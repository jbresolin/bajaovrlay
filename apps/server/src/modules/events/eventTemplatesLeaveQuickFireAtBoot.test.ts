/**
 * Event templates leave the quick-fire panels, once per database (apps/server)
 *
 * What this module is for:
 *   Until BAJAOVRLAY-67 the event templates ("Volta mais rápida", "Penalidade", "Super
 *   Chat") lived on a quick-fire panel, "Avisos", as buttons that refused every take: to the
 *   operator, clutter they could not use. They now live in a home of their own, "Modelos de
 *   evento", shown beside each rule in "Regras". A database written before that is moved
 *   at its next boot, once (seeds_done remembers it as eventTemplatesOffQuickFire): every
 *   template leaves every panel, kept with its id, so the rules still name it, and the
 *   panel "Avisos" is deleted only when nothing else is left on it.
 *
 * What these tests prove:
 *   - "Avisos" as seeded: the three templates move to "Modelos de evento" in their order,
 *     the rules still name them, and the panel is gone.
 *   - "Avisos" with an ordinary item the operator added: the templates move, the panel and
 *     its own item stay, renumbered from 0.
 *   - A template the operator put on "Atalhos" leaves it too, panel by panel in the
 *     panels' order; "Atalhos" keeps the rest.
 *   - The move is recorded in seeds_done, and a second boot changes nothing.
 *
 * What these tests deliberately do not cover:
 *   - Refusing a template on a panel once moved; eventTemplatesOffQuickFire.test.ts.
 *   - What a new database seeds; seededEventItems.test.ts.
 */
import type { Item } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { openEventInboxOnTheStore, restartTheServer } from './eventInboxOnTheStore.testSupport.js';
import {
  makeTheDatabaseOlderThanTemplatesInRegras,
  readSeedNamesDoneOfDatabase,
} from './eventTemplatesOnOlderDatabases.testSupport.js';

/** The ids and orders of the items of one panel, first to last. */
function readItemsOfPanel(items: Item[], panelId: string): Array<[string, number]> {
  return items
    .filter((item) => item.home.kind === 'quickFire' && item.home.panelId === panelId)
    .sort((first, second) => first.order - second.order)
    .map((item) => [item.id, item.order]);
}

/** The ids and orders of the event templates, first to last. */
function readEventTemplates(items: Item[]): Array<[string, number]> {
  return items
    .filter((item) => item.home.kind === 'eventTemplates')
    .sort((first, second) => first.order - second.order)
    .map((item) => [item.id, item.order]);
}

/** A "Bandeira amarela" race clock button the operator added to a panel at this place. */
function buildYellowFlagButton(panelId: string, order: number): Item {
  return {
    id: 'bandeira-amarela',
    home: { kind: 'quickFire', panelId },
    order,
    graphicId: 'race-clock',
    layerId: 'clock',
    label: 'Bandeira amarela',
    color: 'warning',
    notes: '',
    fields: {
      sessionName: { kind: 'literal', value: 'Enduro de Resistência' },
      state: { kind: 'literal', value: 'yellow' },
      clockMode: { kind: 'literal', value: 'remaining' },
      referenceTimeMs: { kind: 'literal', value: 4_560_000 },
      referenceWallClockMs: { kind: 'literal', value: Date.parse('2027-08-14T14:00:00.000Z') },
      running: { kind: 'literal', value: true },
    },
  };
}

/** A copy of the "Penalidade" template the operator once put first on "Atalhos". */
function buildPenaltyCopyOnAtalhos(): Item {
  return {
    id: 'penalidade-copia',
    home: { kind: 'quickFire', panelId: 'atalhos' },
    order: 0,
    graphicId: 'notice',
    layerId: 'notice',
    label: 'Penalidade (cópia)',
    color: 'danger',
    notes: '',
    fields: {
      variant: { kind: 'literal', value: 'penalty' },
      carNumber: { kind: 'eventField', path: 'carNumber' },
      reason: { kind: 'eventField', path: 'reason' },
    },
  };
}

describe('the one-time move of the templates off the panels', () => {
  it('moves the three templates of "Avisos" as seeded, and deletes the panel', () => {
    // Arrange: a database as BAJAOVRLAY-35 left it, "Avisos" holding the three templates.
    const inboxBefore = openEventInboxOnTheStore();
    inboxBefore.shutDown();
    makeTheDatabaseOlderThanTemplatesInRegras(inboxBefore.databasePath, []);

    // Act: boot on it.
    const slices = openEventInboxOnTheStore(inboxBefore).stateStore.readAllSlices();

    // Assert: the templates in "Modelos de evento" in their order, the rules still naming
    // them, and no panel "Avisos".
    expect(readEventTemplates(slices.items), 'the templates keep their ids and order').toEqual([
      ['volta-mais-rapida', 0],
      ['penalidade', 1],
      ['super-chat', 2],
    ]);
    expect(
      slices.eventRules.map((rule) => [rule.kind, rule.itemId]),
      'the rules still name the same templates',
    ).toEqual([
      ['newIncident', 'penalidade'],
      ['fastestLap', 'volta-mais-rapida'],
      ['leaderChanged', null],
      ['manual', 'penalidade'],
      ['superChat', 'super-chat'],
    ]);
    expect(
      slices.quickFirePanels.map((panel) => panel.id),
      'an "Avisos" left empty is deleted',
    ).toEqual(['atalhos', 'logo']);
  });

  it('keeps "Avisos" when the operator added an ordinary item to it', () => {
    // Arrange: the same older database, "Bandeira amarela" added after the templates.
    const inboxBefore = openEventInboxOnTheStore();
    inboxBefore.shutDown();
    makeTheDatabaseOlderThanTemplatesInRegras(inboxBefore.databasePath, [
      buildYellowFlagButton('avisos', 3),
    ]);

    // Act: boot on it.
    const slices = openEventInboxOnTheStore(inboxBefore).stateStore.readAllSlices();

    // Assert: the templates moved; the panel stays with the operator's item, now first.
    expect(readEventTemplates(slices.items), 'the three templates moved').toEqual([
      ['volta-mais-rapida', 0],
      ['penalidade', 1],
      ['super-chat', 2],
    ]);
    expect(
      slices.quickFirePanels.some((panel) => panel.id === 'avisos'),
      'a panel holding the operator’s own item stays',
    ).toBe(true);
    expect(readItemsOfPanel(slices.items, 'avisos'), 'its item, renumbered from 0').toEqual([
      ['bandeira-amarela', 0],
    ]);
  });

  it('moves a template the operator put on "Atalhos", leaving the rest of "Atalhos"', () => {
    // Arrange: a copy of "Penalidade" first on "Atalhos", "Bandeira amarela" second.
    const inboxBefore = openEventInboxOnTheStore();
    inboxBefore.shutDown();
    makeTheDatabaseOlderThanTemplatesInRegras(inboxBefore.databasePath, [
      buildPenaltyCopyOnAtalhos(),
      buildYellowFlagButton('atalhos', 1),
    ]);

    // Act: boot on it.
    const slices = openEventInboxOnTheStore(inboxBefore).stateStore.readAllSlices();

    // Assert: the copy is a template, first since "Atalhos" comes before "Avisos" (the
    // move goes panel by panel, in the panels' order); "Atalhos" keeps its button.
    expect(readEventTemplates(slices.items), 'the copy joins the templates').toEqual([
      ['penalidade-copia', 0],
      ['volta-mais-rapida', 1],
      ['penalidade', 2],
      ['super-chat', 3],
    ]);
    expect(readItemsOfPanel(slices.items, 'atalhos'), '"Atalhos" closes up').toEqual([
      ['bandeira-amarela', 0],
    ]);
  });
});

describe('where the move is remembered', () => {
  it('records eventTemplatesOffQuickFire in seeds_done, and a second boot changes nothing', () => {
    // Arrange: the older database, moved at one boot.
    const inboxBefore = openEventInboxOnTheStore();
    inboxBefore.shutDown();
    makeTheDatabaseOlderThanTemplatesInRegras(inboxBefore.databasePath, [
      buildYellowFlagButton('avisos', 3),
    ]);
    const inboxMoved = openEventInboxOnTheStore(inboxBefore);
    const slicesAfterTheMove = inboxMoved.stateStore.readAllSlices();

    // Act: boot a second time.
    const inboxAfterASecondBoot = restartTheServer(inboxMoved);
    const slicesAfterASecondBoot = inboxAfterASecondBoot.stateStore.readAllSlices();
    inboxAfterASecondBoot.shutDown();
    const seedNamesDone = readSeedNamesDoneOfDatabase(inboxMoved.databasePath);

    // Assert: remembered, and the panels and items as the first boot left them.
    expect(seedNamesDone, 'the move is recorded as done').toContain('eventTemplatesOffQuickFire');
    expect(
      { panels: slicesAfterASecondBoot.quickFirePanels, items: slicesAfterASecondBoot.items },
      'a second boot must change nothing',
    ).toEqual({ panels: slicesAfterTheMove.quickFirePanels, items: slicesAfterTheMove.items });
  });
});
