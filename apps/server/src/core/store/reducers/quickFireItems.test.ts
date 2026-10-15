/**
 * Items in a quick-fire panel, under the older item commands (apps/server)
 *
 * What this module is for:
 *   An item now lives in a rundown or in a quick-fire panel (its `home`). The item and
 *   rundown commands built before panels existed must treat a panel item the way its
 *   home asks: a panel button is fired ad hoc, so it has no cursor and is never "next".
 *   This file checks each older command against a panel item.
 *
 * What these tests prove:
 *   - createItem into a panel puts the item at the end of that panel (or at the position
 *     asked), numbered within the panel, and never gives any rundown cursor to it, even
 *     when a rundown is empty; an unknown panel is refused.
 *   - takeItem and takePreview of a panel item put it on air and leave every rundown
 *     cursor exactly where it was (the very same rundowns).
 *   - deleteItem of a panel button closes the panel up and leaves the rundowns alone.
 *   - moveCursor to a panel item is refused with ITEM_NOT_IN_RUNDOWN and a pt-BR message
 *     saying it is a panel button; reorderItems naming a panel item is refused with
 *     ITEMS_NOT_A_PERMUTATION, because the list must be the rundown's items.
 *
 * What these tests deliberately do not cover:
 *   - takeNext: the cursor can never be on a panel item, since moveCursor refuses it and
 *     moveItemToHome takes the cursor off an item that leaves its rundown.
 *   - The rules of each command for rundown items; their own test files cover them.
 */
import type { Item } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { reduceCommand } from './reduceCommand.js';
import {
  buildEnduroClockFields,
  buildEnduroStartItem,
  buildMainSessionRundown,
  buildPodiumRundown,
  buildRaceDaySlicesWithRundown,
  buildRedFlagShortcutItem,
  buildTeam42ShortcutItem,
  buildYellowFlagItem,
  contextOfTheRundownCommand,
  mainSessionRundownId,
  readLabelsAndOrdersOfQuickFirePanel,
  shortcutsPanelId,
} from './rundownSlices.testSupport.js';

/** Builds the main session's two items (start, yellow) and two "Atalhos" buttons. */
function buildTwoRundownItemsAndTwoButtons(): Item[] {
  return [
    buildEnduroStartItem(0),
    buildYellowFlagItem(1),
    buildTeam42ShortcutItem(0),
    buildRedFlagShortcutItem(1),
  ];
}

describe('createItem into a quick-fire panel', () => {
  it('puts the item at the front of the panel when asked, numbered within the panel', () => {
    // Arrange: two rundown items and two buttons.
    const slicesBefore = buildRaceDaySlicesWithRundown({
      rundowns: [buildMainSessionRundown('item-largada-do-enduro'), buildPodiumRundown(null)],
      items: buildTwoRundownItemsAndTwoButtons(),
    });

    // Act: create "Bandeira verde" as the first button of "Atalhos".
    const outcome = reduceCommand(
      slicesBefore,
      {
        type: 'createItem',
        home: { kind: 'quickFire', panelId: shortcutsPanelId },
        graphicId: 'race-clock',
        layerId: 'clock',
        fields: buildEnduroClockFields('green'),
        label: 'Bandeira verde',
        order: 0,
        color: 'success',
        notes: '',
      },
      contextOfTheRundownCommand,
    );

    // Assert: three buttons numbered 0 to 2, the new one first, and no cursor moved.
    const slicesAfter = outcome.status === 'applied' ? outcome.slices : undefined;
    expect(
      readLabelsAndOrdersOfQuickFirePanel(slicesAfter?.items, shortcutsPanelId),
      'the panel must make room at the front for the new button',
    ).toEqual([
      ['Bandeira verde', 0],
      ['Tarja — Baja UFPR', 1],
      ['Relógio — bandeira vermelha', 2],
    ]);
    expect(slicesAfter?.rundowns, 'a new button must not touch any rundown').toBe(
      slicesBefore.rundowns,
    );
  });

  it('never gives a rundown cursor to a button, even with every rundown empty', () => {
    // Arrange: no item anywhere, both cursors on nothing.
    const slicesBefore = buildRaceDaySlicesWithRundown({ items: [] });

    // Act: create the first button of "Atalhos".
    const outcome = reduceCommand(
      slicesBefore,
      {
        type: 'createItem',
        home: { kind: 'quickFire', panelId: shortcutsPanelId },
        graphicId: 'team-lower-third',
        layerId: 'lower-third',
        fields: {},
        label: 'Tarja — Baja UFPR',
        color: 'info',
        notes: '',
      },
      contextOfTheRundownCommand,
    );

    // Assert: at position 0 of the panel, and the rundowns untouched.
    const slicesAfter = outcome.status === 'applied' ? outcome.slices : undefined;
    expect(
      slicesAfter?.items.map((item) => [item.home, item.order]),
      'the button must be first in its panel',
    ).toEqual([[{ kind: 'quickFire', panelId: shortcutsPanelId }, 0]]);
    expect(slicesAfter?.rundowns, 'a button is never "next" in a rundown').toBe(
      slicesBefore.rundowns,
    );
  });

  it('refuses a panel that does not exist', () => {
    // Arrange: the race day with "Atalhos" only.
    const slicesBefore = buildRaceDaySlicesWithRundown({ items: [] });

    // Act: create a button in a panel nobody created.
    const outcome = reduceCommand(
      slicesBefore,
      {
        type: 'createItem',
        home: { kind: 'quickFire', panelId: 'patrocinadores' },
        graphicId: 'team-lower-third',
        layerId: 'lower-third',
        fields: {},
        label: 'Tarja — Baja UFPR',
        color: 'info',
        notes: '',
      },
      contextOfTheRundownCommand,
    );

    // Assert: refused, naming the panel id.
    expect(outcome, 'an item in an unknown panel would be lost').toEqual({
      status: 'refused',
      error: {
        code: 'QUICK_FIRE_PANEL_NOT_FOUND',
        message: 'O painel de atalhos "patrocinadores" não existe.',
      },
    });
  });
});

describe('taking a panel button', () => {
  it('puts it on air and leaves every rundown cursor exactly where it was', () => {
    // Arrange: the main session's cursor on the start, the podium's on nothing.
    const slicesBefore = buildRaceDaySlicesWithRundown({
      rundowns: [buildMainSessionRundown('item-largada-do-enduro'), buildPodiumRundown(null)],
      items: buildTwoRundownItemsAndTwoButtons(),
    });

    // Act: fire the team 42 button.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'takeItem', itemId: 'item-atalho-tarja-baja-ufpr' },
      contextOfTheRundownCommand,
    );

    // Assert: on air, and the rundowns are the very same array.
    const slicesAfter = outcome.status === 'applied' ? outcome.slices : undefined;
    expect(
      slicesAfter?.instances.map((instance) => instance.itemId),
      'the button must be on air',
    ).toEqual(['item-atalho-tarja-baja-ufpr']);
    expect(slicesAfter?.rundowns, 'a panel button must never move a cursor').toBe(
      slicesBefore.rundowns,
    );
  });

  it('sends its preview to air with takePreview and leaves every cursor alone', () => {
    // Arrange: the red flag button previewed on the clock layer, the cursor on the start.
    const slicesWithoutPreview = buildRaceDaySlicesWithRundown({
      rundowns: [buildMainSessionRundown('item-largada-do-enduro'), buildPodiumRundown(null)],
      items: buildTwoRundownItemsAndTwoButtons(),
    });
    const previewOutcome = reduceCommand(
      slicesWithoutPreview,
      { type: 'previewItem', itemId: 'item-atalho-bandeira-vermelha', origin: 'manual' },
      contextOfTheRundownCommand,
    );
    const slicesBefore =
      previewOutcome.status === 'applied' ? previewOutcome.slices : slicesWithoutPreview;

    // Act: "Tomar" on the clock layer.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'takePreview', layerId: 'clock' },
      { ...contextOfTheRundownCommand, newInstanceId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d' },
    );

    // Assert: the button is on program, and the rundowns are the very same array.
    const slicesAfter = outcome.status === 'applied' ? outcome.slices : undefined;
    expect(
      slicesAfter?.instances.map((instance) => [instance.itemId, instance.target]),
      'the previewed button must be on program',
    ).toEqual([['item-atalho-bandeira-vermelha', 'program']]);
    expect(slicesAfter?.rundowns, 'a panel button sent from preview must not move a cursor').toBe(
      slicesBefore.rundowns,
    );
  });
});

describe('the rundown commands and a panel item', () => {
  it('closes the panel up when a button is deleted, and leaves the rundowns alone', () => {
    // Arrange: two buttons, the cursor on the start.
    const slicesBefore = buildRaceDaySlicesWithRundown({
      rundowns: [buildMainSessionRundown('item-largada-do-enduro'), buildPodiumRundown(null)],
      items: buildTwoRundownItemsAndTwoButtons(),
    });

    // Act: delete the first button.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'deleteItem', itemId: 'item-atalho-tarja-baja-ufpr' },
      contextOfTheRundownCommand,
    );

    // Assert: the red flag button moved up to 0, rundowns untouched.
    const slicesAfter = outcome.status === 'applied' ? outcome.slices : undefined;
    expect(
      readLabelsAndOrdersOfQuickFirePanel(slicesAfter?.items, shortcutsPanelId),
      'the panel must close up behind the deleted button',
    ).toEqual([['Relógio — bandeira vermelha', 0]]);
    expect(slicesAfter?.rundowns, 'deleting a button must not touch any rundown').toBe(
      slicesBefore.rundowns,
    );
  });

  it('refuses to put the cursor on a panel button, saying it is one', () => {
    // Arrange: two rundown items and two buttons.
    const slicesBefore = buildRaceDaySlicesWithRundown({
      items: buildTwoRundownItemsAndTwoButtons(),
    });

    // Act: try to make the team 42 button "next" in the main session.
    const outcome = reduceCommand(
      slicesBefore,
      {
        type: 'moveCursor',
        rundownId: mainSessionRundownId,
        itemId: 'item-atalho-tarja-baja-ufpr',
      },
      contextOfTheRundownCommand,
    );

    // Assert: refused with the code of an item from elsewhere and a pt-BR reason.
    expect(outcome, 'a panel button can never be "next"').toEqual({
      status: 'refused',
      error: {
        code: 'ITEM_NOT_IN_RUNDOWN',
        message:
          'O item "Tarja — Baja UFPR" é um botão do painel de atalhos, não um item do rundown "Sessão principal".',
      },
    });
  });

  it('refuses a new rundown order that names a panel button', () => {
    // Arrange: two rundown items and two buttons.
    const slicesBefore = buildRaceDaySlicesWithRundown({
      items: buildTwoRundownItemsAndTwoButtons(),
    });

    // Act: send an order of the start and a panel button.
    const outcome = reduceCommand(
      slicesBefore,
      {
        type: 'reorderItems',
        rundownId: mainSessionRundownId,
        orderedItemIds: ['item-largada-do-enduro', 'item-atalho-tarja-baja-ufpr'],
      },
      contextOfTheRundownCommand,
    );

    // Assert: refused as a list that is not the rundown's items.
    const errorCode = outcome.status === 'refused' ? outcome.error.code : undefined;
    expect(errorCode, 'a panel button is not one of the rundown items').toBe(
      'ITEMS_NOT_A_PERMUTATION',
    );
  });
});
