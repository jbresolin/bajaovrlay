/**
 * Which items get "Escolher carros" (apps/control)
 *
 * What this module is for:
 *   "Escolher carros" (BAJAOVRLAY-82) picks an item's cars from the console without
 *   opening the item editor. It is generic: any item whose graphic declares car groups
 *   a car of the positions can fill gets one number box per group, and "Pela posição" when
 *   one car runs right behind another. This module decides, from the item and the
 *   graphics the server lists, what (if anything) the console offers.
 *
 * What these tests prove:
 *   - The battle card offers both cars, the car ahead then the car behind, and the battle
 *     between them for "Pela posição".
 *   - A notice item that is not a template offers its one car and no battle.
 *   - The team card offers nothing: a team of Cadastros fills it, not a car of the positions.
 *   - An event template offers nothing, even on a graphic with cars: its cars come from
 *     the event.
 *   - An item whose graphic the server does not list offers nothing.
 *
 * What these tests deliberately do not cover:
 *   - The shared check of a manifest's car groups (packages/shared carGroupsOfManifest tests).
 *   - Drawing the boxes: QuickCarPickBox.test.tsx.
 */
import type { Graphic, Item } from '@bajaovrlay/shared';
import teamCardManifest from '@bajaovrlay/team-card/team-card.ograf.json';
import { describe, expect, it } from 'vitest';

import {
  buildBattleCardGraphic,
  buildBattleCardOfTheLeadersItem,
} from '@/features/items/battleCardOfTheLeaders.testSupport';
import {
  buildNoticeGraphic,
  buildSeededPenaltyTemplate,
} from '@/features/items/noticeTemplates.testSupport';

import { findCarGroupsToPickQuickly } from './carGroupsToPickQuickly';

/** The team card as the server registers it. */
function buildTeamCardGraphic(): Graphic {
  return {
    id: 'team-card',
    manifest: structuredClone(teamCardManifest),
    defaultLayerId: 'lower-third',
    category: 'teams',
    thumbnailUrl: null,
    defaultFields: {},
  };
}

/** "Equipe 47 — Carnaúba Baja": a team card item, its fields not filled yet. */
function buildTeamCardItemOfCar47(): Item {
  return {
    ...buildBattleCardOfTheLeadersItem(),
    id: 'item-cartao-equipe-47',
    graphicId: 'team-card',
    label: 'Equipe 47 — Carnaúba Baja',
    fields: {},
  };
}

/** "Volta mais rápida — 47": a notice typed by hand, no event behind it. */
function buildNoticeItemTypedByHand(): Item {
  return {
    ...buildSeededPenaltyTemplate(),
    id: 'item-aviso-volta-47',
    home: { kind: 'quickFire', panelId: 'atalhos' },
    label: 'Volta mais rápida — 47',
    fields: { variant: { kind: 'literal', value: 'fastestLap' } },
  };
}

describe('findCarGroupsToPickQuickly', () => {
  it('offers the battle card’s two cars and the battle between them', () => {
    // Arrange: the battle card of the leaders, and the graphics the server lists.
    const item = buildBattleCardOfTheLeadersItem();
    const graphics = [buildBattleCardGraphic()];

    // Act: ask what "Escolher carros" offers for it.
    const offer = findCarGroupsToPickQuickly(item, graphics);

    // Assert: two boxes, ahead then behind, and the behind car runs right behind the ahead one.
    expect(
      offer?.carGroups.map((carGroup) => carGroup.label),
      'the battle card must offer one box per car, in the manifest’s order',
    ).toEqual(['Carro da frente', 'Carro de trás']);
    expect(
      [offer?.battle?.carGroupAhead.id, offer?.battle?.carGroupBehind.id],
      'the battle for a place must set the car ahead and the car right behind it',
    ).toEqual(['ahead', 'behind']);
  });

  it('offers a notice typed by hand its one car, with no battle', () => {
    // Arrange: a notice item that no event fills.
    const item = buildNoticeItemTypedByHand();
    const graphics = [buildNoticeGraphic()];

    // Act: ask what "Escolher carros" offers for it.
    const offer = findCarGroupsToPickQuickly(item, graphics);

    // Assert: one box for its car, and no "Pela posição".
    expect(
      offer?.carGroups.map((carGroup) => carGroup.label),
      'a notice must offer its one car',
    ).toEqual(['Carro']);
    expect(offer?.battle, 'one car is no battle').toBeUndefined();
  });

  it('offers nothing for the team card, which a team of Cadastros fills', () => {
    // Arrange: a team card item.
    const item = buildTeamCardItemOfCar47();
    const graphics = [buildTeamCardGraphic()];

    // Act: ask what "Escolher carros" offers for it.
    const offer = findCarGroupsToPickQuickly(item, graphics);

    // Assert: nothing, since its city and logo are in no car of the positions.
    expect(offer, 'the team card must not offer cars of the positions').toBeUndefined();
  });

  it('offers nothing for an event template, whose car comes from the event', () => {
    // Arrange: the seeded penalty notice, filled by the event it shows.
    const item = buildSeededPenaltyTemplate();
    const graphics = [buildNoticeGraphic()];

    // Act: ask what "Escolher carros" offers for it.
    const offer = findCarGroupsToPickQuickly(item, graphics);

    // Assert: nothing.
    expect(offer, 'a template must never be given cars by hand').toBeUndefined();
  });

  it('offers nothing when the server does not list the item’s graphic', () => {
    // Arrange: the battle card item, but no graphic listed.
    const item = buildBattleCardOfTheLeadersItem();

    // Act: ask what "Escolher carros" offers for it.
    const offer = findCarGroupsToPickQuickly(item, []);

    // Assert: nothing to offer without the graphic’s manifest.
    expect(offer, 'an unknown graphic has no cars to pick').toBeUndefined();
  });
});
