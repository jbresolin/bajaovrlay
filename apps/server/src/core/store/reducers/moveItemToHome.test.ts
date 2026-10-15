/**
 * The moveItemToHome reducer (apps/server)
 *
 * What this module is for:
 *   moveItemToHome moves an item to a rundown or a quick-fire panel, at a position
 *   there: "Mover para rundown" on a panel button, or a rundown row sent to a panel.
 *   Both homes stay numbered 0, 1, 2, ... with no gaps: the one the item leaves closes
 *   up, the one it joins makes room. Naming the item's own home moves it within that
 *   home, which is how panel buttons are put in a new order.
 *
 * What these tests prove:
 *   - A panel button moved into the rundown at position 1: the panel closes up, the
 *     rundown makes room, and the item now has a rundown home.
 *   - A rundown row moved into a panel: the rundown closes up, the panel makes room.
 *   - Moving the item the cursor is on out of its rundown moves the cursor as deleteItem
 *     does: to the item that followed it, or to nothing when it was the last.
 *   - Moving another item leaves the cursor where it was (the very same rundowns).
 *   - The first item moved into an empty rundown gets its cursor, as createItem's does.
 *   - Within one home the item changes place and the cursor stays on the same item; a
 *     move to where the item already is hands back the same slices; a position past
 *     the end means the end.
 *   - An unknown item, rundown or panel is refused, with its code and pt-BR message.
 *
 * What these tests deliberately do not cover:
 *   - Instances on air from the moved item: they keep their itemId, as after any edit.
 *   - Who may send it; authorizeQuickFireAndMacroCommands.test.ts covers it.
 */
import type { Item, ItemHome } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { reduceCommand } from './reduceCommand.js';
import {
  buildEnduroFinishItem,
  buildEnduroStartItem,
  buildMainSessionRundown,
  buildPodiumRundown,
  buildRaceDaySlicesWithRundown,
  buildRedFlagShortcutItem,
  buildTeam42ShortcutItem,
  buildYellowFlagItem,
  contextOfTheRundownCommand,
  mainSessionRundownId,
  podiumRundownId,
  readLabelsAndOrdersOfQuickFirePanel,
  readLabelsAndOrdersOfRundown,
  shortcutsPanelId,
} from './rundownSlices.testSupport.js';

const homeInTheMainSession: ItemHome = { kind: 'rundown', rundownId: mainSessionRundownId };
const homeInTheShortcutsPanel: ItemHome = { kind: 'quickFire', panelId: shortcutsPanelId };

/** Builds the main session's three items (start, yellow, finish) and two "Atalhos" buttons. */
function buildThreeRundownItemsAndTwoButtons(): Item[] {
  return [
    buildEnduroStartItem(0),
    buildYellowFlagItem(1),
    buildEnduroFinishItem(2),
    buildTeam42ShortcutItem(0),
    buildRedFlagShortcutItem(1),
  ];
}

describe('moveItemToHome between a panel and a rundown', () => {
  it('moves a panel button into the rundown at position 1, renumbering both', () => {
    // Arrange: three rundown items, two buttons, the cursor on the start.
    const slicesBefore = buildRaceDaySlicesWithRundown({
      rundowns: [buildMainSessionRundown('item-largada-do-enduro'), buildPodiumRundown(null)],
      items: buildThreeRundownItemsAndTwoButtons(),
    });

    // Act: move the team 42 button into the main session, second place.
    const outcome = reduceCommand(
      slicesBefore,
      {
        type: 'moveItemToHome',
        itemId: 'item-atalho-tarja-baja-ufpr',
        home: homeInTheMainSession,
        order: 1,
      },
      contextOfTheRundownCommand,
    );

    // Assert: the rundown made room at 1, the panel closed up, the item lives in the
    // rundown, and the cursor did not move.
    const slicesAfter = outcome.status === 'applied' ? outcome.slices : undefined;
    expect(
      readLabelsAndOrdersOfRundown(slicesAfter?.items, mainSessionRundownId),
      'the rundown must hold four items numbered 0 to 3, the button second',
    ).toEqual([
      ['Largada do enduro', 0],
      ['Tarja — Baja UFPR', 1],
      ['Bandeira amarela', 2],
      ['Chegada do enduro', 3],
    ]);
    expect(
      readLabelsAndOrdersOfQuickFirePanel(slicesAfter?.items, shortcutsPanelId),
      'the panel must close up behind the button that left',
    ).toEqual([['Relógio — bandeira vermelha', 0]]);
    expect(
      slicesAfter?.items.find((item) => item.id === 'item-atalho-tarja-baja-ufpr')?.home,
      'the moved item must now say it lives in the main session',
    ).toEqual(homeInTheMainSession);
    expect(slicesAfter?.rundowns, 'a move into the rundown must not move the cursor').toBe(
      slicesBefore.rundowns,
    );
  });

  it('moves a rundown row into the panel at the front, renumbering both', () => {
    // Arrange: three rundown items, two buttons, the cursor on the finish.
    const slicesBefore = buildRaceDaySlicesWithRundown({
      rundowns: [buildMainSessionRundown('item-chegada-do-enduro'), buildPodiumRundown(null)],
      items: buildThreeRundownItemsAndTwoButtons(),
    });

    // Act: send the yellow flag to "Atalhos", first button.
    const outcome = reduceCommand(
      slicesBefore,
      {
        type: 'moveItemToHome',
        itemId: 'item-bandeira-amarela',
        home: homeInTheShortcutsPanel,
        order: 0,
      },
      contextOfTheRundownCommand,
    );

    // Assert: the rundown closed up and the panel made room at the front.
    const slicesAfter = outcome.status === 'applied' ? outcome.slices : undefined;
    expect(
      readLabelsAndOrdersOfRundown(slicesAfter?.items, mainSessionRundownId),
      'the rundown must close up behind the row that left',
    ).toEqual([
      ['Largada do enduro', 0],
      ['Chegada do enduro', 1],
    ]);
    expect(
      readLabelsAndOrdersOfQuickFirePanel(slicesAfter?.items, shortcutsPanelId),
      'the panel must hold three buttons numbered 0 to 2, the yellow flag first',
    ).toEqual([
      ['Bandeira amarela', 0],
      ['Tarja — Baja UFPR', 1],
      ['Relógio — bandeira vermelha', 2],
    ]);
  });
});

const cursorAfterMoveOutScenarios = [
  // The plan loses its next item: "next" becomes the item that followed, as deleteItem does.
  {
    name: 'moves the cursor to the following item when the cursor item leaves the rundown',
    cursorBefore: 'item-bandeira-amarela',
    movedItemId: 'item-bandeira-amarela',
    expectedCursorAfter: 'item-chegada-do-enduro',
  },
  // Nothing follows the last item, so the cursor is left on nothing.
  {
    name: 'leaves the cursor on nothing when the last item was the cursor item',
    cursorBefore: 'item-chegada-do-enduro',
    movedItemId: 'item-chegada-do-enduro',
    expectedCursorAfter: null,
  },
  // Another row leaving does not change the plan.
  {
    name: 'leaves the cursor where it was when another item leaves the rundown',
    cursorBefore: 'item-largada-do-enduro',
    movedItemId: 'item-bandeira-amarela',
    expectedCursorAfter: 'item-largada-do-enduro',
  },
];

describe('moveItemToHome and the cursor', () => {
  it.each(cursorAfterMoveOutScenarios)(
    '$name',
    ({ cursorBefore, movedItemId, expectedCursorAfter }) => {
      // Arrange: the main session with three items and this row's cursor.
      const slicesBefore = buildRaceDaySlicesWithRundown({
        rundowns: [buildMainSessionRundown(cursorBefore), buildPodiumRundown(null)],
        items: buildThreeRundownItemsAndTwoButtons(),
      });

      // Act: send this row's item to the end of "Atalhos".
      const outcome = reduceCommand(
        slicesBefore,
        { type: 'moveItemToHome', itemId: movedItemId, home: homeInTheShortcutsPanel, order: 2 },
        contextOfTheRundownCommand,
      );

      // Assert: the cursor is where this row says; the podium rundown untouched.
      const rundownsAfter = outcome.status === 'applied' ? outcome.slices.rundowns : undefined;
      expect(rundownsAfter, 'the cursor must follow the deleteItem rule').toEqual([
        buildMainSessionRundown(expectedCursorAfter),
        buildPodiumRundown(null),
      ]);
    },
  );

  it('gives the cursor to the first item moved into an empty rundown', () => {
    // Arrange: the podium rundown is empty, its cursor on nothing.
    const slicesBefore = buildRaceDaySlicesWithRundown({
      rundowns: [buildMainSessionRundown(null), buildPodiumRundown(null)],
      items: buildThreeRundownItemsAndTwoButtons(),
    });

    // Act: move the team 42 button into the podium rundown.
    const outcome = reduceCommand(
      slicesBefore,
      {
        type: 'moveItemToHome',
        itemId: 'item-atalho-tarja-baja-ufpr',
        home: { kind: 'rundown', rundownId: podiumRundownId },
        order: 0,
      },
      contextOfTheRundownCommand,
    );

    // Assert: the podium cursor is on it, so Space works at once, as after createItem.
    const rundownsAfter = outcome.status === 'applied' ? outcome.slices.rundowns : undefined;
    expect(rundownsAfter, 'the first item of an empty rundown must get the cursor').toEqual([
      buildMainSessionRundown(null),
      buildPodiumRundown('item-atalho-tarja-baja-ufpr'),
    ]);
  });
});

describe('moveItemToHome within the same home', () => {
  it('moves a rundown row up and keeps the cursor on the same item', () => {
    // Arrange: the cursor on the yellow flag, second of three.
    const slicesBefore = buildRaceDaySlicesWithRundown({
      rundowns: [buildMainSessionRundown('item-bandeira-amarela'), buildPodiumRundown(null)],
      items: buildThreeRundownItemsAndTwoButtons(),
    });

    // Act: move the finish to the top of the same rundown.
    const outcome = reduceCommand(
      slicesBefore,
      {
        type: 'moveItemToHome',
        itemId: 'item-chegada-do-enduro',
        home: homeInTheMainSession,
        order: 0,
      },
      contextOfTheRundownCommand,
    );

    // Assert: new order, cursor unchanged.
    const slicesAfter = outcome.status === 'applied' ? outcome.slices : undefined;
    expect(
      readLabelsAndOrdersOfRundown(slicesAfter?.items, mainSessionRundownId),
      'the finish must now be first',
    ).toEqual([
      ['Chegada do enduro', 0],
      ['Largada do enduro', 1],
      ['Bandeira amarela', 2],
    ]);
    expect(slicesAfter?.rundowns, 'moving within the rundown must not move the cursor').toBe(
      slicesBefore.rundowns,
    );
  });

  it('puts a button at the end when the position is past the end of the panel', () => {
    // Arrange: two buttons in "Atalhos".
    const slicesBefore = buildRaceDaySlicesWithRundown({
      items: buildThreeRundownItemsAndTwoButtons(),
    });

    // Act: move the first button to position 9.
    const outcome = reduceCommand(
      slicesBefore,
      {
        type: 'moveItemToHome',
        itemId: 'item-atalho-tarja-baja-ufpr',
        home: homeInTheShortcutsPanel,
        order: 9,
      },
      contextOfTheRundownCommand,
    );

    // Assert: it is last, at 1, with no gap.
    const itemsAfter = outcome.status === 'applied' ? outcome.slices.items : undefined;
    expect(
      readLabelsAndOrdersOfQuickFirePanel(itemsAfter, shortcutsPanelId),
      'a position past the end must mean the end',
    ).toEqual([
      ['Relógio — bandeira vermelha', 0],
      ['Tarja — Baja UFPR', 1],
    ]);
  });

  it('hands back the very same slices when the item is already there', () => {
    // Arrange: two buttons in "Atalhos".
    const slicesBefore = buildRaceDaySlicesWithRundown({
      items: buildThreeRundownItemsAndTwoButtons(),
    });

    // Act: move the second button to the second place.
    const outcome = reduceCommand(
      slicesBefore,
      {
        type: 'moveItemToHome',
        itemId: 'item-atalho-bandeira-vermelha',
        home: homeInTheShortcutsPanel,
        order: 1,
      },
      contextOfTheRundownCommand,
    );

    // Assert: the same slices object, so the store saves, logs and sends nothing.
    const slicesAfter = outcome.status === 'applied' ? outcome.slices : undefined;
    expect(slicesAfter, 'a move that changes nothing must leave no trace').toBe(slicesBefore);
  });
});

const refusedMoveScenarios: Array<{
  name: string;
  itemId: string;
  home: ItemHome;
  expectedError: { code: string; message: string };
}> = [
  // An item deleted from another device a moment ago.
  {
    name: 'refuses an item that does not exist',
    itemId: 'item-apagado',
    home: homeInTheShortcutsPanel,
    expectedError: {
      code: 'ITEM_NOT_FOUND',
      message: 'O item "item-apagado" não existe; ele pode ter sido excluído.',
    },
  },
  // An item moved to a rundown nobody can open would be lost.
  {
    name: 'refuses a rundown that does not exist',
    itemId: 'item-atalho-tarja-baja-ufpr',
    home: { kind: 'rundown', rundownId: 'treino-livre' },
    expectedError: { code: 'RUNDOWN_NOT_FOUND', message: 'O rundown "treino-livre" não existe.' },
  },
  // The same for a panel.
  {
    name: 'refuses a panel that does not exist',
    itemId: 'item-bandeira-amarela',
    home: { kind: 'quickFire', panelId: 'painel-apagado' },
    expectedError: {
      code: 'QUICK_FIRE_PANEL_NOT_FOUND',
      message: 'O painel de atalhos "painel-apagado" não existe.',
    },
  },
];

describe('moveItemToHome, when it must be refused', () => {
  it.each(refusedMoveScenarios)('$name', ({ itemId, home, expectedError }) => {
    // Arrange: three rundown items and two buttons.
    const slicesBefore = buildRaceDaySlicesWithRundown({
      items: buildThreeRundownItemsAndTwoButtons(),
    });

    // Act: try this row's move.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'moveItemToHome', itemId, home, order: 0 },
      contextOfTheRundownCommand,
    );

    // Assert: refused with this row's code and pt-BR message.
    expect(outcome, 'this move must be refused with its reason').toEqual({
      status: 'refused',
      error: expectedError,
    });
  });
});
