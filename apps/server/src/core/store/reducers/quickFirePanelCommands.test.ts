/**
 * The quick-fire panel reducers: create, rename, delete (apps/server)
 *
 * What this module is for:
 *   A quick-fire panel is a tab of buttons on the control page. createQuickFirePanel
 *   adds an empty panel after the last one, renameQuickFirePanel changes its name and
 *   deleteQuickFirePanel removes it. The panels' positions (`order`) stay 0, 1, 2, ...
 *   with no gaps, so the tabs and F1–F4 always line up.
 *
 * What these tests prove:
 *   - A new panel gets the id the store made, the name sent and the position after the
 *     last panel; nothing else changes.
 *   - A rename changes only the name; renaming to the same name hands back the same
 *     slices (so nothing is saved, logged or broadcast).
 *   - Deleting an empty panel renumbers the panels after it.
 *   - Each refusal, with its code and pt-BR message: an unknown panel (rename and
 *     delete), a panel that still has items, the last panel left.
 *
 * What these tests deliberately do not cover:
 *   - Moving items between panels; moveItemToHome.test.ts covers it.
 *   - Who may send these commands; authorizeQuickFireAndMacroCommands.test.ts covers it.
 */
import { describe, expect, it } from 'vitest';

import { reduceCommand } from './reduceCommand.js';
import {
  buildEnduroStartItem,
  buildRaceDaySlicesWithRundown,
  buildShortcutsPanel,
  buildSponsorsPanel,
  buildTeam42ShortcutItem,
  contextOfTheRundownCommand,
  sponsorsPanelId,
} from './rundownSlices.testSupport.js';

/** Builds a third panel, "Pódio", for the renumbering tests. */
function buildPodiumPanel() {
  return { id: 'podio', name: 'Pódio', order: 2 };
}

describe('createQuickFirePanel', () => {
  it('adds an empty panel after the last one, with the id the store made', () => {
    // Arrange: the race day with the panels "Atalhos" and "Patrocinadores".
    const slicesBefore = buildRaceDaySlicesWithRundown({
      items: [buildEnduroStartItem(0)],
      quickFirePanels: [buildShortcutsPanel(), buildSponsorsPanel()],
    });

    // Act: create the panel "Pódio".
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'createQuickFirePanel', name: 'Pódio' },
      contextOfTheRundownCommand,
    );

    // Assert: a third panel at position 2, and the items and rundowns untouched.
    const slicesAfter = outcome.status === 'applied' ? outcome.slices : undefined;
    expect(slicesAfter?.quickFirePanels, 'the new panel must come after the last one').toEqual([
      buildShortcutsPanel(),
      buildSponsorsPanel(),
      { id: contextOfTheRundownCommand.newQuickFirePanelId, name: 'Pódio', order: 2 },
    ]);
    expect(slicesAfter?.items, 'a new panel must not touch the items').toBe(slicesBefore.items);
    expect(slicesAfter?.rundowns, 'a new panel must not touch the rundowns').toBe(
      slicesBefore.rundowns,
    );
  });
});

describe('renameQuickFirePanel', () => {
  it('changes only the name of the panel', () => {
    // Arrange: the race day with two panels.
    const slicesBefore = buildRaceDaySlicesWithRundown({
      items: [],
      quickFirePanels: [buildShortcutsPanel(), buildSponsorsPanel()],
    });

    // Act: rename "Patrocinadores" to "Patrocinadores master".
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'renameQuickFirePanel', panelId: sponsorsPanelId, name: 'Patrocinadores master' },
      contextOfTheRundownCommand,
    );

    // Assert: same id and position, new name; the other panel unchanged.
    const panelsAfter = outcome.status === 'applied' ? outcome.slices.quickFirePanels : undefined;
    expect(panelsAfter, 'only the name of the renamed panel may change').toEqual([
      buildShortcutsPanel(),
      { ...buildSponsorsPanel(), name: 'Patrocinadores master' },
    ]);
  });

  it('hands back the very same slices when the name is the one the panel already has', () => {
    // Arrange: the race day with "Atalhos".
    const slicesBefore = buildRaceDaySlicesWithRundown({ items: [] });

    // Act: rename "Atalhos" to "Atalhos".
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'renameQuickFirePanel', panelId: 'atalhos', name: 'Atalhos' },
      contextOfTheRundownCommand,
    );

    // Assert: the same slices object, so the store saves, logs and sends nothing.
    const slicesAfter = outcome.status === 'applied' ? outcome.slices : undefined;
    expect(slicesAfter, 'a rename that changes nothing must leave no trace').toBe(slicesBefore);
  });
});

describe('deleteQuickFirePanel', () => {
  it('removes an empty panel and renumbers the panels after it', () => {
    // Arrange: three panels, the middle one empty.
    const slicesBefore = buildRaceDaySlicesWithRundown({
      items: [buildTeam42ShortcutItem(0)],
      quickFirePanels: [buildShortcutsPanel(), buildSponsorsPanel(), buildPodiumPanel()],
    });

    // Act: delete "Patrocinadores".
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'deleteQuickFirePanel', panelId: sponsorsPanelId },
      contextOfTheRundownCommand,
    );

    // Assert: two panels left, numbered 0 and 1 with no gap.
    const panelsAfter = outcome.status === 'applied' ? outcome.slices.quickFirePanels : undefined;
    expect(panelsAfter, '"Pódio" must move up to position 1').toEqual([
      buildShortcutsPanel(),
      { ...buildPodiumPanel(), order: 1 },
    ]);
  });

  const refusedDeleteScenarios = [
    // Deleting a panel with buttons would delete items nobody chose to delete.
    {
      name: 'refuses a panel that still has items',
      panelId: 'atalhos',
      quickFirePanels: [buildShortcutsPanel(), buildSponsorsPanel()],
      expectedError: {
        code: 'QUICK_FIRE_PANEL_NOT_EMPTY',
        message:
          'O painel "Atalhos" ainda tem 1 item. Mova ou exclua os itens dele antes de excluir o painel.',
      },
    },
    // The strip always has a tab, so a new item always has somewhere to go.
    {
      name: 'refuses the last panel left',
      panelId: sponsorsPanelId,
      quickFirePanels: [{ ...buildSponsorsPanel(), order: 0 }],
      expectedError: {
        code: 'LAST_QUICK_FIRE_PANEL',
        message:
          'O painel "Patrocinadores" é o único painel de atalhos e não pode ser excluído. Crie outro painel antes.',
      },
    },
    // A panel deleted from another device a moment ago.
    {
      name: 'refuses a panel that does not exist',
      panelId: 'painel-apagado',
      quickFirePanels: [buildShortcutsPanel(), buildSponsorsPanel()],
      expectedError: {
        code: 'QUICK_FIRE_PANEL_NOT_FOUND',
        message: 'O painel de atalhos "painel-apagado" não existe.',
      },
    },
  ];

  it.each(refusedDeleteScenarios)('$name', ({ panelId, quickFirePanels, expectedError }) => {
    // Arrange: this row's panels, and one button (team 42) in "Atalhos" when it exists.
    const isShortcutsPanelThere = quickFirePanels.some((panel) => panel.id === 'atalhos');
    const slicesBefore = buildRaceDaySlicesWithRundown({
      items: isShortcutsPanelThere ? [buildTeam42ShortcutItem(0)] : [],
      quickFirePanels,
    });

    // Act: try to delete the panel of this row.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'deleteQuickFirePanel', panelId },
      contextOfTheRundownCommand,
    );

    // Assert: refused with this row's code and pt-BR message.
    expect(outcome, 'this delete must be refused with its reason').toEqual({
      status: 'refused',
      error: expectedError,
    });
  });
});

describe('renameQuickFirePanel, when it must be refused', () => {
  it('refuses to rename a panel that does not exist', () => {
    // Arrange: the race day with "Atalhos" only.
    const slicesBefore = buildRaceDaySlicesWithRundown({ items: [] });

    // Act: rename a panel nobody created.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'renameQuickFirePanel', panelId: 'painel-apagado', name: 'Pódio' },
      contextOfTheRundownCommand,
    );

    // Assert: refused, naming the id that was not found.
    expect(outcome, 'an unknown panel cannot be renamed').toEqual({
      status: 'refused',
      error: {
        code: 'QUICK_FIRE_PANEL_NOT_FOUND',
        message: 'O painel de atalhos "painel-apagado" não existe.',
      },
    });
  });
});
