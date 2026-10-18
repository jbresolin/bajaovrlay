/**
 * The tabs of the quick-fire strip, and what the number and function keys reach
 * (apps/control)
 *
 * What this module is for:
 *   The strip in the right column has one tab per quick-fire panel, in the panels'
 *   order, and a last tab "Macros". quickFireTabs.ts lists those tabs, says which one is
 *   shown when the one the operator chose has gone, which tab F1 to F4 open, and what
 *   the digits 1 to 9 fire on the tab shown. Pure functions: the strip draws and listens,
 *   these decide.
 *
 * What these tests prove:
 *   - The tabs follow the panels' `order`, not the order of the slice, and Macros is last.
 *   - A chosen tab that has gone (its panel deleted) falls back to the first tab.
 *   - F1 to F4 reach the first four tabs, Macros included when it is among them, and an
 *     F-key past the last tab reaches nothing.
 *   - The tab a function key opens, and the key each tab shows, follow the order of
 *     keyboardMap.switchQuickFireTab.keys: the map is the one place the keys are listed.
 *   - On a panel tab, 1 to 9 fire the panel's buttons in their order with `takeItem`; on
 *     the Macros tab they run the macros in the order the server lists them; a digit past
 *     the last button fires nothing.
 *   - "Novo gráfico…" of "Edição rápida" puts its item in the panel shown, in the first
 *     panel while "Macros" is shown, and nowhere when the server lists no panel.
 *
 * What these tests deliberately do not cover:
 *   - The keys being listened to (typing, held keys, connection): QuickFireStripKeys.test.tsx.
 *   - Drawing the tabs: QuickFireStrip.test.tsx.
 */
import type { Item, Macro, QuickFirePanel } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { keyboardMap } from '@/keyboard/keyboardMap';

import {
  chooseCommandForDigitKey,
  chooseTabShown,
  findFunctionKeyForTabPosition,
  findPanelIdForNewShortcut,
  findTabForFunctionKey,
  listQuickFireTabsInOrder,
} from './quickFireTabs';

/** The seeded panel and two panels the operator made, listed out of tab order on purpose. */
function buildPanelsListedOutOfOrder(): QuickFirePanel[] {
  return [
    { id: 'painel-patrocinadores', name: 'Patrocinadores', order: 2 },
    { id: 'atalhos', name: 'Atalhos', order: 0 },
    { id: 'painel-box', name: 'Box', order: 1 },
  ];
}

/** One button of the "Atalhos" panel, at `order`. */
function buildAtalhosButton(id: string, label: string, order: number): Item {
  return {
    id,
    home: { kind: 'quickFire', panelId: 'atalhos' },
    order,
    graphicId: 'race-clock',
    layerId: 'clock',
    fields: {},
    label,
    color: 'info',
    notes: '',
  };
}

/** Three buttons of "Atalhos", listed out of order, and one row of the rundown. */
function buildItemsOfAtalhosAndTheRundown(): Item[] {
  return [
    buildAtalhosButton('item-bandeira-vermelha', 'Bandeira vermelha', 2),
    buildAtalhosButton('item-logo-baja', 'Logo Baja', 0),
    buildAtalhosButton('item-relogio-enduro', 'Relógio do enduro', 1),
    {
      ...buildAtalhosButton('item-largada', 'Largada do enduro', 0),
      home: { kind: 'rundown', rundownId: 'sessao-principal' },
    },
  ];
}

/** Two macros, in the order the server lists them. */
function buildTwoMacros(): Macro[] {
  return [
    { id: 'macro-abrir-sessao', label: 'Abrir a sessão', color: 'success', steps: [] },
    { id: 'macro-fechar-sessao', label: 'Fechar a sessão', color: 'danger', steps: [] },
  ];
}

describe('listQuickFireTabsInOrder', () => {
  it('lists one tab per panel in the panels’ order, then Macros', () => {
    // Arrange: three panels listed out of tab order.
    const panels = buildPanelsListedOutOfOrder();

    // Act: list the tabs.
    const tabs = listQuickFireTabsInOrder(panels);

    // Assert: Atalhos, Box, Patrocinadores, then Macros.
    expect(tabs, 'the tabs must follow `order` and end with Macros').toEqual([
      { kind: 'panel', panelId: 'atalhos' },
      { kind: 'panel', panelId: 'painel-box' },
      { kind: 'panel', panelId: 'painel-patrocinadores' },
      { kind: 'macros' },
    ]);
  });
});

describe('chooseTabShown', () => {
  const scenarios = [
    // The usual case: the operator's choice is still there and stays shown.
    {
      name: 'keeps the chosen panel while it exists',
      chosenTab: { kind: 'panel', panelId: 'painel-box' } as const,
      expected: { kind: 'panel', panelId: 'painel-box' },
    },
    // Another operator deleted the panel on screen: show something that exists.
    {
      name: 'falls back to the first tab when the chosen panel was deleted',
      chosenTab: { kind: 'panel', panelId: 'painel-apagado' } as const,
      expected: { kind: 'panel', panelId: 'atalhos' },
    },
    // A page that has chosen nothing yet opens on the first tab.
    {
      name: 'shows the first tab when nothing was chosen',
      chosenTab: null,
      expected: { kind: 'panel', panelId: 'atalhos' },
    },
    // Macros never goes away.
    {
      name: 'keeps Macros',
      chosenTab: { kind: 'macros' } as const,
      expected: { kind: 'macros' },
    },
  ];

  it.each(scenarios)('$name', ({ chosenTab, expected }) => {
    // Arrange: the tabs of three panels.
    const tabs = listQuickFireTabsInOrder(buildPanelsListedOutOfOrder());

    // Act: decide which tab is shown.
    const tabShown = chooseTabShown(tabs, chosenTab);

    // Assert: the expected tab.
    expect(tabShown, 'the tab shown must exist on the page').toEqual(expected);
  });
});

describe('findTabForFunctionKey', () => {
  const scenarios = [
    // F1 is the first tab.
    {
      name: 'F1 opens the first panel',
      key: 'F1',
      panelCount: 3,
      expected: { kind: 'panel', panelId: 'atalhos' },
    },
    // F3 is the third tab.
    {
      name: 'F3 opens the third panel',
      key: 'F3',
      panelCount: 3,
      expected: { kind: 'panel', panelId: 'painel-patrocinadores' },
    },
    // With three panels Macros is the fourth tab, so F4 reaches it.
    {
      name: 'F4 opens Macros when it is the fourth tab',
      key: 'F4',
      panelCount: 3,
      expected: { kind: 'macros' },
    },
    // With only the seeded panel there are two tabs; F3 reaches nothing.
    {
      name: 'F3 opens nothing when there are two tabs',
      key: 'F3',
      panelCount: 1,
      expected: undefined,
    },
  ];

  it.each(scenarios)('$name', ({ key, panelCount, expected }) => {
    // Arrange: the tabs of the first `panelCount` panels in tab order.
    const panelsInOrder = [...buildPanelsListedOutOfOrder()].sort(
      (onePanel, otherPanel) => onePanel.order - otherPanel.order,
    );
    const tabs = listQuickFireTabsInOrder(panelsInOrder.slice(0, panelCount));

    // Act: find the tab of the key.
    const tab = findTabForFunctionKey(tabs, key);

    // Assert: the expected tab, or none.
    expect(tab, `${key} must open the expected tab`).toEqual(expected);
  });

  it('opens, for each key of the keyboard map in turn, the tab at that key’s place in the list', () => {
    // Arrange: five tabs (four panels and Macros), one more than there are function keys,
    // and the keys as the keyboard map lists them.
    const tabs = listQuickFireTabsInOrder([
      ...buildPanelsListedOutOfOrder(),
      { id: 'painel-premiacao', name: 'Premiação', order: 3 },
    ]);
    const functionKeysOfTheMap = keyboardMap.switchQuickFireTab.keys;

    // Act: for each key of the map, the tab it opens and the key the tab at its place shows.
    const tabOpenedByEachKey = functionKeysOfTheMap.map((key) => findTabForFunctionKey(tabs, key));
    const keyShownOnEachTab = tabs.map((_tab, tabPosition) =>
      findFunctionKeyForTabPosition(tabPosition),
    );

    // Assert: the n-th key of the map opens the n-th tab and is the key that tab shows;
    // the tab past the map's last key has no key.
    expect(
      tabOpenedByEachKey,
      'the tab a key opens must be the one at the key’s place in the keyboard map',
    ).toEqual(tabs.slice(0, functionKeysOfTheMap.length));
    expect(
      keyShownOnEachTab,
      'each tab must show the key the keyboard map lists at its place, and none past the list',
    ).toEqual([...functionKeysOfTheMap, undefined]);
  });
});

describe('chooseCommandForDigitKey', () => {
  const scenarios = [
    // 1 is the first button by order, not the first in the slice.
    {
      name: '1 takes the first button of the panel',
      tabShown: { kind: 'panel', panelId: 'atalhos' } as const,
      digit: '1',
      expected: { type: 'takeItem', itemId: 'item-logo-baja' },
    },
    // 3 is the third button.
    {
      name: '3 takes the third button of the panel',
      tabShown: { kind: 'panel', panelId: 'atalhos' } as const,
      digit: '3',
      expected: { type: 'takeItem', itemId: 'item-bandeira-vermelha' },
    },
    // The panel has three buttons; 4 has nothing to fire, and the rundown row is not one.
    {
      name: '4 fires nothing on a panel of three buttons',
      tabShown: { kind: 'panel', panelId: 'atalhos' } as const,
      digit: '4',
      expected: null,
    },
    // An empty panel fires nothing.
    {
      name: '1 fires nothing on an empty panel',
      tabShown: { kind: 'panel', panelId: 'painel-box' } as const,
      digit: '1',
      expected: null,
    },
    // On the Macros tab the digits run macros.
    {
      name: '2 runs the second macro on the Macros tab',
      tabShown: { kind: 'macros' } as const,
      digit: '2',
      expected: { type: 'runMacro', macroId: 'macro-fechar-sessao' },
    },
    // Two macros: 3 runs nothing.
    {
      name: '3 runs nothing when there are two macros',
      tabShown: { kind: 'macros' } as const,
      digit: '3',
      expected: null,
    },
  ];

  it.each(scenarios)('$name', ({ tabShown, digit, expected }) => {
    // Arrange: three buttons in "Atalhos", an empty "Box", one rundown row, two macros.
    const items = buildItemsOfAtalhosAndTheRundown();
    const macros = buildTwoMacros();

    // Act: decide what the digit sends.
    const command = chooseCommandForDigitKey({ tabShown, digit, items, macros });

    // Assert: the expected command, or nothing.
    expect(command, `the digit ${digit} must send the expected command`).toEqual(expected);
  });
});

describe('findPanelIdForNewShortcut', () => {
  const scenarios = [
    // The operator is on "Box": a graphic made on the spot becomes a button there.
    {
      name: 'answers the panel of the tab shown',
      panels: buildPanelsListedOutOfOrder(),
      tabShown: { kind: 'panel', panelId: 'painel-box' } as const,
      expectedPanelId: 'painel-box',
    },
    // A macro tab holds no items, so the first panel in tab order stands in for it.
    {
      name: 'answers the first panel in tab order while the Macros tab is shown',
      panels: buildPanelsListedOutOfOrder(),
      tabShown: { kind: 'macros' } as const,
      expectedPanelId: 'atalhos',
    },
    // No panel at all (the server always seeds one): no panel is named, so the page
    // never sends one the server does not know, and "Novo gráfico…" is off.
    {
      name: 'answers nothing when the server lists no panel',
      panels: [],
      tabShown: { kind: 'macros' } as const,
      expectedPanelId: undefined,
    },
  ];

  it.each(scenarios)('$name', ({ panels, tabShown, expectedPanelId }) => {
    // Arrange: the tabs of this row's panels.
    const tabs = listQuickFireTabsInOrder(panels);

    // Act: ask where a new shortcut goes with this row's tab shown.
    const panelId = findPanelIdForNewShortcut(tabs, tabShown);

    // Assert: the panel this row expects, or none.
    expect(panelId, 'a new shortcut must go to the panel the operator is looking at').toBe(
      expectedPanelId,
    );
  });
});
