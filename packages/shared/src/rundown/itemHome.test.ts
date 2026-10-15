/**
 * Where an item lives: a rundown or a quick-fire panel (packages/shared)
 *
 * What this module is for:
 *   Every item lives in exactly one place, its `home`: a rundown (the scripted parts of
 *   the show, fired with Space at the cursor) or a quick-fire panel (the buttons for
 *   "the ten things we do every hour", fired ad hoc). `home` is a union told apart by
 *   `kind`, so an item can never be in both, or in neither. createItem names the home
 *   of the new item, and moveItemToHome moves an item to another home, at a position.
 *
 * What these tests prove:
 *   - An item whose home is a rundown, and one whose home is a quick-fire panel, are
 *     both accepted unchanged.
 *   - An item written in the older shape, with `rundownId` and no `home`, is refused
 *     (the server converts stored rows before it checks them; clients never see that
 *     shape), and so are a home of an unknown kind and a quick-fire home naming a
 *     rundown instead of a panel.
 *   - createItem takes `home` and refuses the older `rundownId` alone, naming `home`.
 *   - moveItemToHome needs the item, the home and a whole position from 0.
 *   - The two lists in order (a rundown's items, a panel's items) never mix the homes.
 *
 * What these tests deliberately do not cover:
 *   - Whether the rundown or panel named exists, and the renumbering of both homes;
 *     the reducers in apps/server check that against the state.
 *   - The conversion of stored rows at boot; apps/server's itemHomeMigration tests.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { CommandSchema } from '../commands/command.js';
import { ItemSchema } from './item.js';
import {
  listItemsOfQuickFirePanelInOrder,
  listItemsOfRundownInOrder,
} from './itemsOfHomeInOrder.js';

/** Builds the race clock item "Largada do enduro" at the given home and position. */
function buildEnduroStartItemAtHome(home: unknown, order: number) {
  return {
    id: 'item-largada-do-enduro',
    home,
    order,
    graphicId: 'race-clock',
    layerId: 'clock',
    fields: { state: { kind: 'literal', value: 'green' } },
    label: 'Largada do enduro',
    color: 'success',
    notes: '',
  };
}

/** Builds a lower third item for one team, sitting in the quick-fire panel "Atalhos". */
function buildTeamLowerThirdInShortcuts(itemId: string, teamName: string, order: number) {
  return ItemSchema.parse({
    id: itemId,
    home: { kind: 'quickFire', panelId: 'atalhos' },
    order,
    graphicId: 'team-lower-third',
    layerId: 'lower-third',
    fields: { teamName: { kind: 'literal', value: teamName } },
    label: `Tarja — ${teamName}`,
    color: 'info',
    notes: '',
  });
}

describe('ItemSchema with a home', () => {
  it('accepts an item whose home is the main session rundown, unchanged', () => {
    // Arrange: the start of the enduro, first in the main session rundown.
    const itemInRundown = buildEnduroStartItemAtHome(
      { kind: 'rundown', rundownId: 'sessao-principal' },
      0,
    );

    // Act: check it against the item schema.
    const result = ItemSchema.safeParse(itemInRundown);

    // Assert: accepted exactly as written.
    expect(result.success, 'an item living in a rundown must be accepted').toBe(true);
    expect(result.data, 'the accepted item must not be altered').toEqual(itemInRundown);
  });

  it('accepts an item whose home is the quick-fire panel "Atalhos", unchanged', () => {
    // Arrange: the same item, third button of the panel "Atalhos".
    const itemInPanel = buildEnduroStartItemAtHome({ kind: 'quickFire', panelId: 'atalhos' }, 2);

    // Act: check it against the item schema.
    const result = ItemSchema.safeParse(itemInPanel);

    // Assert: accepted exactly as written.
    expect(result.success, 'an item living in a quick-fire panel must be accepted').toBe(true);
    expect(result.data, 'the accepted item must not be altered').toEqual(itemInPanel);
  });

  const refusedHomeScenarios = [
    // The shape M1 stored before quick-fire panels existed: clients must never see it.
    {
      name: 'refuses the older shape with rundownId and no home',
      item: {
        ...buildEnduroStartItemAtHome(undefined, 0),
        home: undefined,
        rundownId: 'sessao-principal',
      },
    },
    // A kind nobody built: a third place for items must be a decision, not an accident.
    {
      name: 'refuses a home of a kind that does not exist',
      item: buildEnduroStartItemAtHome({ kind: 'playlist', playlistId: 'abertura' }, 0),
    },
    // A quick-fire home must name a panel; a rundown id there would point at nothing.
    {
      name: 'refuses a quick-fire home that names a rundown instead of a panel',
      item: buildEnduroStartItemAtHome({ kind: 'quickFire', rundownId: 'sessao-principal' }, 0),
    },
    // An empty panel id is as good as none.
    {
      name: 'refuses a quick-fire home with an empty panel id',
      item: buildEnduroStartItemAtHome({ kind: 'quickFire', panelId: '' }, 0),
    },
  ];

  it.each(refusedHomeScenarios)('$name', ({ item }) => {
    // Arrange: the item of this row (built above).

    // Act: check it and turn the failure into readable text.
    const result = ItemSchema.safeParse(item);
    const failureMessage = result.error ? z.prettifyError(result.error) : '';

    // Assert: refused, and the failure points at the home.
    expect(result.success, 'an item without a proper home must be refused').toBe(false);
    expect(failureMessage, 'the failure must name the home').toContain('home');
  });
});

describe('createItem with a home', () => {
  it('accepts a createItem whose home is the quick-fire panel "Atalhos"', () => {
    // Arrange: the item editor's "Onde" selector set to the panel "Atalhos".
    const createItemInPanel = {
      type: 'createItem',
      home: { kind: 'quickFire', panelId: 'atalhos' },
      graphicId: 'team-lower-third',
      layerId: 'lower-third',
      fields: { teamName: { kind: 'literal', value: 'Baja UFPR' } },
      label: 'Tarja — Baja UFPR',
    };

    // Act: check the command.
    const result = CommandSchema.safeParse(createItemInPanel);

    // Assert: accepted, with only the colour and the notes filled in.
    expect(result.success, 'a createItem into a panel must be accepted').toBe(true);
    expect(result.data, 'the home must come through as sent').toEqual({
      ...createItemInPanel,
      color: 'neutral',
      notes: '',
    });
  });

  it('refuses a createItem that names only a rundownId, the older shape, naming home', () => {
    // Arrange: a client still sending the shape of BAJAOVRLAY-13.
    const createItemInOlderShape = {
      type: 'createItem',
      rundownId: 'sessao-principal',
      graphicId: 'race-clock',
      layerId: 'clock',
      fields: {},
      label: 'Largada do enduro',
    };

    // Act: check it and turn the failure into readable text.
    const result = CommandSchema.safeParse(createItemInOlderShape);
    const failureMessage = result.error ? z.prettifyError(result.error) : '';

    // Assert: refused, and the failure names the field to send instead.
    expect(result.success, 'createItem has one shape: rundownId alone is refused').toBe(false);
    expect(failureMessage, 'the failure must name the home').toContain('home');
  });
});

describe('moveItemToHome', () => {
  it('accepts moving an item into the main session rundown at the third position', () => {
    // Arrange: "Mover para rundown" on a button of the panel "Atalhos".
    const moveIntoRundown = {
      type: 'moveItemToHome',
      itemId: 'item-tarja-baja-ufpr',
      home: { kind: 'rundown', rundownId: 'sessao-principal' },
      order: 2,
    };

    // Act: check the command.
    const result = CommandSchema.safeParse(moveIntoRundown);

    // Assert: accepted unchanged.
    expect(result.success, 'a move into a rundown must be accepted').toBe(true);
    expect(result.data, 'nothing may be added to the move').toEqual(moveIntoRundown);
  });

  const refusedMoveScenarios = [
    // The position is where the item lands; leaving it out would make the server guess.
    {
      name: 'refuses a move without a position',
      move: {
        type: 'moveItemToHome',
        itemId: 'item-tarja-baja-ufpr',
        home: { kind: 'quickFire', panelId: 'atalhos' },
      },
      fieldNamed: 'order',
    },
    // Positions count from 0; a negative one is a client bug.
    {
      name: 'refuses a negative position',
      move: {
        type: 'moveItemToHome',
        itemId: 'item-tarja-baja-ufpr',
        home: { kind: 'quickFire', panelId: 'atalhos' },
        order: -1,
      },
      fieldNamed: 'order',
    },
    // A move must say where to; an item is never homeless.
    {
      name: 'refuses a move without a home',
      move: { type: 'moveItemToHome', itemId: 'item-tarja-baja-ufpr', order: 0 },
      fieldNamed: 'home',
    },
  ];

  it.each(refusedMoveScenarios)('$name', ({ move, fieldNamed }) => {
    // Arrange: the move of this row (built above).

    // Act: check it and turn the failure into readable text.
    const result = CommandSchema.safeParse(move);
    const failureMessage = result.error ? z.prettifyError(result.error) : '';

    // Assert: refused, naming the field that is wrong.
    expect(result.success, 'this move must be refused').toBe(false);
    expect(failureMessage, 'the failure must name the bad field').toContain(fieldNamed);
  });
});

describe('the items of one home, in order', () => {
  it("lists a panel's buttons by order and leaves out the rundown's items", () => {
    // Arrange: two buttons of "Atalhos", held second one first, and a rundown item.
    const itemsAsHeld = [
      buildTeamLowerThirdInShortcuts('item-tarja-ufsc', 'Baja UFSC', 1),
      ItemSchema.parse(
        buildEnduroStartItemAtHome({ kind: 'rundown', rundownId: 'sessao-principal' }, 0),
      ),
      buildTeamLowerThirdInShortcuts('item-tarja-ufpr', 'Baja UFPR', 0),
    ];

    // Act: list the panel's items and the rundown's items.
    const panelItems = listItemsOfQuickFirePanelInOrder(itemsAsHeld, 'atalhos');
    const rundownItems = listItemsOfRundownInOrder(itemsAsHeld, 'sessao-principal');

    // Assert: each list holds only its own home's items, first to last.
    expect(
      panelItems.map((item) => item.label),
      'the panel must list its two buttons by order and nothing else',
    ).toEqual(['Tarja — Baja UFPR', 'Tarja — Baja UFSC']);
    expect(
      rundownItems.map((item) => item.label),
      'the rundown must not list a button of a panel',
    ).toEqual(['Largada do enduro']);
  });
});
