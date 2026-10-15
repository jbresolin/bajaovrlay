/**
 * The authorisation hook for quick-fire panels and macros (apps/server)
 *
 * What this module is for:
 *   `allowCommandForActorRole` decides by the role at the start of the actor name.
 *   BAJAOVRLAY-16 adds the panel and macro commands, and a second job for the server
 *   itself: the macro runner, which signs every command it sends
 *   `sistema:macro:<macroId>`. A running macro may only do what a macro step does
 *   (takeItem, clearLayer, clearAll) and its own bookkeeping (advanceMacroRun,
 *   endMacroRun, for its own macro only). The auto-out keeps clearLayer only.
 *
 * What these tests prove:
 *   - An operator may send each panel and macro command an operator page sends, and may
 *     not send the runner's bookkeeping.
 *   - A renderer and the auto-out are refused every panel and macro command.
 *   - The macro actor may send takeItem, clearLayer, clearAll and the bookkeeping of its
 *     own macro, and is refused the bookkeeping of another macro, createItem, runMacro
 *     (a macro cannot start a macro), takeGraphic, takeNext, previewItem and
 *     reportInstanceStatus.
 *   - The auto-out may still send clearLayer and nothing a macro may send besides.
 *
 * What these tests deliberately do not cover:
 *   - The rows of the older commands; authorizeCommand.test.ts covers them.
 *   - The NOT_ALLOWED refusal a store gives; macroRunner.test.ts shows one end to end.
 */
import type { Command } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { allowCommandForActorRole } from './authorizeCommand.js';

const operatorActor = 'operador:3f2a9c1e-8b47-4d06-9e15-7c0d2b6a4f81';
const rendererActor = 'renderer:b8d4e6f0-1a2c-4e3b-9d5f-6a7c8e9f0b12';
const autoOutActor = 'sistema:auto-out';
// The runner of "Abrir a sessão"; no connection has this role.
const openTheSessionMacroActor = 'sistema:macro:macro-abrir-sessao';

const createSponsorsPanel: Command = { type: 'createQuickFirePanel', name: 'Patrocinadores' };
const renameShortcutsPanel: Command = {
  type: 'renameQuickFirePanel',
  panelId: 'atalhos',
  name: 'Atalhos do enduro',
};
const deleteSponsorsPanel: Command = { type: 'deleteQuickFirePanel', panelId: 'patrocinadores' };
const moveButtonIntoRundown: Command = {
  type: 'moveItemToHome',
  itemId: 'item-atalho-tarja-baja-ufpr',
  home: { kind: 'rundown', rundownId: 'sessao-principal' },
  order: 0,
};
const createCloseTheSessionMacro: Command = {
  type: 'createMacro',
  label: 'Fechar a sessão',
  color: 'danger',
  steps: [{ kind: 'clearAll' }],
};
const renameOpenTheSessionMacro: Command = {
  type: 'updateMacro',
  macroId: 'macro-abrir-sessao',
  label: 'Abrir o enduro',
};
const deleteOpenTheSessionMacro: Command = { type: 'deleteMacro', macroId: 'macro-abrir-sessao' };
const runOpenTheSessionMacro: Command = { type: 'runMacro', macroId: 'macro-abrir-sessao' };
const advanceOpenTheSessionRun: Command = {
  type: 'advanceMacroRun',
  macroId: 'macro-abrir-sessao',
  currentStep: 1,
};
const endOpenTheSessionRun: Command = { type: 'endMacroRun', macroId: 'macro-abrir-sessao' };
const endCloseTheSessionRun: Command = { type: 'endMacroRun', macroId: 'macro-fechar-sessao' };
const takeRaceClockByHand: Command = {
  type: 'takeGraphic',
  graphicId: 'race-clock',
  layerId: 'clock',
  data: { sessionName: 'Enduro de Resistência' },
  target: 'program',
  takeTimeFieldKeys: [],
};
const createYellowFlagItem: Command = {
  type: 'createItem',
  home: { kind: 'quickFire', panelId: 'atalhos' },
  graphicId: 'race-clock',
  layerId: 'clock',
  fields: {},
  label: 'Bandeira amarela',
  color: 'warning',
  notes: '',
};

/** The commands an operator page sends for panels and macros, each with its name. */
const operatorPanelAndMacroCommands: Array<{ commandName: string; command: Command }> = [
  { commandName: 'createQuickFirePanel', command: createSponsorsPanel },
  { commandName: 'renameQuickFirePanel', command: renameShortcutsPanel },
  { commandName: 'deleteQuickFirePanel', command: deleteSponsorsPanel },
  { commandName: 'moveItemToHome', command: moveButtonIntoRundown },
  { commandName: 'createMacro', command: createCloseTheSessionMacro },
  { commandName: 'updateMacro', command: renameOpenTheSessionMacro },
  { commandName: 'deleteMacro', command: deleteOpenTheSessionMacro },
  { commandName: 'runMacro', command: runOpenTheSessionMacro },
];

describe('the panel and macro commands an operator page sends', () => {
  it.each(operatorPanelAndMacroCommands)('allows $commandName from an operator', ({ command }) => {
    // Arrange: the command of this row, sent from an operator's connection.

    // Act: ask the hook.
    const isAllowed = allowCommandForActorRole(command, operatorActor);

    // Assert: preparing panels and macros, and pressing a macro, is the operator's job.
    expect(isAllowed, 'an operator must be allowed this command').toBe(true);
  });

  it.each(operatorPanelAndMacroCommands)('refuses $commandName from a renderer', ({ command }) => {
    // Arrange: the command of this row, sent from a page that only draws.

    // Act: ask the hook.
    const isAllowed = allowCommandForActorRole(command, rendererActor);

    // Assert: a renderer may only report what is on screen.
    expect(isAllowed, 'a renderer must be refused this command').toBe(false);
  });

  it.each(operatorPanelAndMacroCommands)(
    'refuses $commandName from the auto-out',
    ({ command }) => {
      // Arrange: the command of this row, signed by the auto-out.

      // Act: ask the hook.
      const isAllowed = allowCommandForActorRole(command, autoOutActor);

      // Assert: the auto-out may only clear one layer.
      expect(isAllowed, 'the auto-out must be refused this command').toBe(false);
    },
  );

  it.each(operatorPanelAndMacroCommands)(
    'refuses $commandName from a running macro',
    ({ command }) => {
      // Arrange: the command of this row, signed by the runner of "Abrir a sessão".

      // Act: ask the hook.
      const isAllowed = allowCommandForActorRole(command, openTheSessionMacroActor);

      // Assert: a macro may not edit panels or macros, nor start a macro.
      expect(isAllowed, 'a running macro must be refused this command').toBe(false);
    },
  );
});

const macroActorScenarios: Array<{
  name: string;
  command: Command;
  actor: string;
  expectedIsAllowed: boolean;
}> = [
  // The take step: put a prepared item on air, as its button would.
  {
    name: 'allows takeItem from a running macro',
    command: { type: 'takeItem', itemId: 'item-largada-do-enduro' },
    actor: openTheSessionMacroActor,
    expectedIsAllowed: true,
  },
  // The clearLayer step: empty one layer.
  {
    name: 'allows clearLayer from a running macro',
    command: { type: 'clearLayer', layerId: 'lower-third' },
    actor: openTheSessionMacroActor,
    expectedIsAllowed: true,
  },
  // The clearAll step: empty every layer ("Fechar a sessão").
  {
    name: 'allows clearAll from a running macro',
    command: { type: 'clearAll' },
    actor: openTheSessionMacroActor,
    expectedIsAllowed: true,
  },
  // The runner says which step its own run is at.
  {
    name: 'allows advanceMacroRun of its own macro from a running macro',
    command: advanceOpenTheSessionRun,
    actor: openTheSessionMacroActor,
    expectedIsAllowed: true,
  },
  // The runner closes its own run.
  {
    name: 'allows endMacroRun of its own macro from a running macro',
    command: endOpenTheSessionRun,
    actor: openTheSessionMacroActor,
    expectedIsAllowed: true,
  },
  // A runner must never end the run of another macro.
  {
    name: 'refuses endMacroRun of another macro from a running macro',
    command: endCloseTheSessionRun,
    actor: openTheSessionMacroActor,
    expectedIsAllowed: false,
  },
  // Nothing a step cannot be: preparing items is the operator's job.
  {
    name: 'refuses createItem from a running macro',
    command: createYellowFlagItem,
    actor: openTheSessionMacroActor,
    expectedIsAllowed: false,
  },
  // A take by hand is not a step; steps take prepared items only.
  {
    name: 'refuses takeGraphic from a running macro',
    command: takeRaceClockByHand,
    actor: openTheSessionMacroActor,
    expectedIsAllowed: false,
  },
  // A macro must not advance the rundown's plan with Space.
  {
    name: 'refuses takeNext from a running macro',
    command: { type: 'takeNext', rundownId: 'sessao-principal' },
    actor: openTheSessionMacroActor,
    expectedIsAllowed: false,
  },
  // Previews are the operator's looking, not a step.
  {
    name: 'refuses previewItem from a running macro',
    command: { type: 'previewItem', itemId: 'item-largada-do-enduro', origin: 'manual' },
    actor: openTheSessionMacroActor,
    expectedIsAllowed: false,
  },
  // Only a renderer knows what is on screen.
  {
    name: 'refuses reportInstanceStatus from a running macro',
    command: {
      type: 'reportInstanceStatus',
      instanceId: '7d3c1a52-4f0e-4b8e-9a51-2f6f1e0c9b11',
      status: 'on-air',
    },
    actor: openTheSessionMacroActor,
    expectedIsAllowed: false,
  },
  // The bookkeeping is the runner's alone: an operator page cannot fake a run's step.
  {
    name: 'refuses advanceMacroRun from an operator',
    command: advanceOpenTheSessionRun,
    actor: operatorActor,
    expectedIsAllowed: false,
  },
  // Nor end a run the runner is still carrying out.
  {
    name: 'refuses endMacroRun from an operator',
    command: endOpenTheSessionRun,
    actor: operatorActor,
    expectedIsAllowed: false,
  },
  // Nor a renderer.
  {
    name: 'refuses endMacroRun from a renderer',
    command: endOpenTheSessionRun,
    actor: rendererActor,
    expectedIsAllowed: false,
  },
  // The auto-out is unchanged: it still clears its layer.
  {
    name: 'still allows clearLayer from the auto-out',
    command: { type: 'clearLayer', layerId: 'lower-third' },
    actor: autoOutActor,
    expectedIsAllowed: true,
  },
  // A macro's take is not the auto-out's to send.
  {
    name: 'refuses takeItem from the auto-out',
    command: { type: 'takeItem', itemId: 'item-largada-do-enduro' },
    actor: autoOutActor,
    expectedIsAllowed: false,
  },
  // Nor a macro's clearAll: a timer bug must never empty the whole screen.
  {
    name: 'refuses clearAll from the auto-out',
    command: { type: 'clearAll' },
    actor: autoOutActor,
    expectedIsAllowed: false,
  },
  // Nor a macro's bookkeeping: `sistema:` alone does not make a runner.
  {
    name: 'refuses endMacroRun from the auto-out',
    command: endOpenTheSessionRun,
    actor: autoOutActor,
    expectedIsAllowed: false,
  },
];

describe('the macro actor and the auto-out', () => {
  it.each(macroActorScenarios)('$name', ({ command, actor, expectedIsAllowed }) => {
    // Arrange: the command and actor of this row.

    // Act: ask the hook.
    const isAllowed = allowCommandForActorRole(command, actor);

    // Assert: the answer this row expects.
    expect(isAllowed, 'the hook must answer as this row says').toBe(expectedIsAllowed);
  });
});
