// Test support: quick-fire panels with buttons in them, and macros, as the server sends
// them once an operator has prepared a show. Like the other *LikeTheServerSends files,
// every function builds new objects on every call, so no test can change what another
// test sees.
import type { Item, ItemColor, Macro, MacroRun, Slices } from '@bajaovrlay/shared';

import {
  buildRaceClockItem,
  buildSlicesWithTheEnduranceRundown,
} from './rundownLikeTheServerSends.testSupport';

/** The seeded panel's id, and the id of a second panel the operator made. */
export const shortcutsPanelId = 'atalhos';
export const pitBoxPanelId = 'painel-box';

/** The ids of the three buttons of "Atalhos", in button order. */
export const bajaLogoItemId = 'item-logo-baja';
export const enduranceClockItemId = 'item-relogio-enduro';
export const redFlagItemId = 'item-bandeira-vermelha';

/** The ids of the two macros, in the order the server lists them. */
export const openTheSessionMacroId = 'macro-abrir-sessao';
export const closeTheSessionMacroId = 'macro-fechar-sessao';

/** One button of the "Atalhos" panel: a race clock item on the clock layer. */
function buildShortcutButton(id: string, order: number, label: string, color: ItemColor): Item {
  return {
    ...buildRaceClockItem({ id, order, label, color, flagState: 'green' }),
    home: { kind: 'quickFire', panelId: shortcutsPanelId },
  };
}

/**
 * The three buttons of "Atalhos", listed out of button order on purpose (the slice is in
 * creation order): "Logo Baja", "Relógio do enduro", "Bandeira vermelha".
 */
export function buildThreeShortcutButtons(): Item[] {
  return [
    buildShortcutButton(redFlagItemId, 2, 'Bandeira vermelha', 'danger'),
    buildShortcutButton(bajaLogoItemId, 0, 'Logo Baja', 'neutral'),
    buildShortcutButton(enduranceClockItemId, 1, 'Relógio do enduro', 'info'),
  ];
}

/** "Abrir a sessão" (clock, half a second, logo) and "Fechar a sessão" (clear all). */
export function buildTwoMacros(): Macro[] {
  return [
    {
      id: openTheSessionMacroId,
      label: 'Abrir a sessão',
      color: 'success',
      steps: [
        { kind: 'takeItem', itemId: enduranceClockItemId },
        { kind: 'wait', ms: 500 },
        { kind: 'takeItem', itemId: bajaLogoItemId },
      ],
    },
    {
      id: closeTheSessionMacroId,
      label: 'Fechar a sessão',
      color: 'danger',
      steps: [{ kind: 'clearAll' }],
    },
  ];
}

/**
 * Nothing on air; the endurance rundown with its cursor on the start; the panels
 * "Atalhos" (three buttons) and "Box" (empty), listed out of tab order; the two macros;
 * nothing running.
 */
export function buildSlicesWithShortcutsAndMacros(): Slices {
  const slicesWithTheRundown = buildSlicesWithTheEnduranceRundown('item-largada-do-enduro');
  return {
    ...slicesWithTheRundown,
    items: [...slicesWithTheRundown.items, ...buildThreeShortcutButtons()],
    quickFirePanels: [
      { id: pitBoxPanelId, name: 'Box', order: 1 },
      { id: shortcutsPanelId, name: 'Atalhos', order: 0 },
    ],
    macros: buildTwoMacros(),
    macroRuns: [],
    dataSources: [],
    dataSnapshots: [],
    recordings: [],
  };
}

/** "Abrir a sessão" running, at its second step (the wait), since `startedAt`. */
export function buildOpenTheSessionRunningAtTheWait(startedAt: string): MacroRun {
  return { macroId: openTheSessionMacroId, startedAt, currentStep: 1, isStopRequested: false };
}

/** "Abrir a sessão" at the wait after an operator pressed "Parar", before the end arrives. */
export function buildOpenTheSessionBeingStopped(startedAt: string): MacroRun {
  return { macroId: openTheSessionMacroId, startedAt, currentStep: 1, isStopRequested: true };
}
