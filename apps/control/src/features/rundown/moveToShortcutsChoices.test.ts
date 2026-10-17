/**
 * The "Mover para atalhos" entries of a rundown row's menu (apps/control)
 *
 * What this module is for:
 *   A rundown row's "⋯" menu can move the item to a quick-fire panel. With one panel the
 *   menu has the single entry "Mover para atalhos"; with several, one entry per panel,
 *   named with it, in the order of the quick-fire tabs. listMoveToShortcutsChoices
 *   decides those entries from the server's panels, without drawing.
 *
 * What these tests prove:
 *   - One panel gives one plain entry; several give one named entry each, in tab order
 *     (the panels' `order`, not the order the server lists them in); none gives none.
 *
 * What these tests deliberately do not cover:
 *   - The menu itself and the moveItemToHome it sends: RundownPanelMoveToShortcuts.test.tsx.
 */
import type { QuickFirePanel } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { listMoveToShortcutsChoices, type MoveToShortcutsChoice } from './moveToShortcutsChoices';

type ChoicesScenario = {
  name: string;
  panels: QuickFirePanel[];
  expectedChoices: MoveToShortcutsChoice[];
};

const choicesScenarios: ChoicesScenario[] = [
  // The seeded show: one panel, so naming it would only add words.
  {
    name: 'one panel gives the single entry "Mover para atalhos"',
    panels: [{ id: 'atalhos', name: 'Atalhos', order: 0 }],
    expectedChoices: [{ panelId: 'atalhos', menuText: 'Mover para atalhos' }],
  },
  // Listed by the server out of order on purpose: the entries follow the tabs.
  {
    name: 'several panels give one named entry each, in tab order',
    panels: [
      { id: 'painel-box', name: 'Box', order: 1 },
      { id: 'atalhos', name: 'Atalhos', order: 0 },
    ],
    expectedChoices: [
      { panelId: 'atalhos', menuText: 'Mover para atalhos: Atalhos' },
      { panelId: 'painel-box', menuText: 'Mover para atalhos: Box' },
    ],
  },
  // A page that has not heard from the server yet has no panel to offer.
  {
    name: 'no panel gives no entry',
    panels: [],
    expectedChoices: [],
  },
];

describe('listMoveToShortcutsChoices', () => {
  it.each(choicesScenarios)('$name', ({ panels, expectedChoices }) => {
    // Arrange: the panels of this row.

    // Act: list the entries of the menu.
    const choices = listMoveToShortcutsChoices(panels);

    // Assert: the entries of this row, in this order.
    expect(choices, 'the menu must offer one entry per panel, in tab order').toEqual(
      expectedChoices,
    );
  });
});
