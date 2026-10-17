/**
 * The authorisation hook for the commands of "Prévia shows the result" (apps/server)
 *
 * What this module is for:
 *   BAJAOVRLAY-36 adds three commands an operator page sends: previewClearLayer ("Prévia:
 *   limpar"), takeAllPreviews ("Tomar tudo") and previewMacro (a macro's "Prévia"). They
 *   are the operator's looking and deciding, so only an operator may send them: a page
 *   that only draws, a running macro, the macro watchdog and the auto-out may not.
 *
 * What these tests prove:
 *   - Each of the three is allowed from an operator.
 *   - Each of the three is refused from a renderer, from the runner of a macro
 *     (`sistema:macro:<macroId>`), from `sistema:macro-watchdog` and from
 *     `sistema:auto-out`.
 *
 * What these tests deliberately do not cover:
 *   - The older commands; authorizeCommand.test.ts and
 *     authorizeQuickFireAndMacroCommands.test.ts cover them.
 *   - These answers were already right before the commands existed, because the hook
 *     allows an operator everything but the screen's report and the runner's bookkeeping,
 *     and every other actor a fixed list; these rows keep it so.
 */
import type { Command } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { allowCommandForActorRole } from './authorizeCommand.js';

const operatorActor = 'operador:3f2a9c1e-8b47-4d06-9e15-7c0d2b6a4f81';
const rendererActor = 'renderer:b8d4e6f0-1a2c-4e3b-9d5f-6a7c8e9f0b12';
// The runner of "Abrir a sessão"; no connection has this role.
const openTheSessionMacroActor = 'sistema:macro:macro-abrir-sessao';
const macroWatchdogActor = 'sistema:macro-watchdog';
const autoOutActor = 'sistema:auto-out';

/** The three new commands, each with its name. */
const previewResultCommands: Array<{ commandName: string; command: Command }> = [
  // "Prévia: limpar" on the clock row.
  { commandName: 'previewClearLayer', command: { type: 'previewClearLayer', layerId: 'clock' } },
  // "Tomar tudo" under the Prévia monitor.
  { commandName: 'takeAllPreviews', command: { type: 'takeAllPreviews' } },
  // "Prévia" in the ⋯ menu of "Abrir a sessão".
  { commandName: 'previewMacro', command: { type: 'previewMacro', macroId: 'macro-abrir-sessao' } },
];

describe('the commands of "Prévia shows the result"', () => {
  it.each(previewResultCommands)('allows $commandName from an operator', ({ command }) => {
    // Arrange: the command of this row, sent from an operator's connection.

    // Act: ask the hook.
    const isAllowed = allowCommandForActorRole(command, operatorActor);

    // Assert: looking at the result and taking it is the operator's job.
    expect(isAllowed, 'an operator must be allowed this command').toBe(true);
  });

  it.each(previewResultCommands)('refuses $commandName from a renderer', ({ command }) => {
    // Arrange: the command of this row, sent from a page that only draws.

    // Act: ask the hook.
    const isAllowed = allowCommandForActorRole(command, rendererActor);

    // Assert: a renderer may only report what is on screen.
    expect(isAllowed, 'a renderer must be refused this command').toBe(false);
  });

  it.each(previewResultCommands)('refuses $commandName from a running macro', ({ command }) => {
    // Arrange: the command of this row, signed by the runner of "Abrir a sessão".

    // Act: ask the hook.
    const isAllowed = allowCommandForActorRole(command, openTheSessionMacroActor);

    // Assert: a macro step is takeItem, clearLayer or clearAll, never a preview.
    expect(isAllowed, 'a running macro must be refused this command').toBe(false);
  });

  it.each(previewResultCommands)('refuses $commandName from the macro watchdog', ({ command }) => {
    // Arrange: the command of this row, signed by the watchdog.

    // Act: ask the hook.
    const isAllowed = allowCommandForActorRole(command, macroWatchdogActor);

    // Assert: the watchdog may only end a run.
    expect(isAllowed, 'the watchdog must be refused this command').toBe(false);
  });

  it.each(previewResultCommands)('refuses $commandName from the auto-out', ({ command }) => {
    // Arrange: the command of this row, signed by the auto-out.

    // Act: ask the hook.
    const isAllowed = allowCommandForActorRole(command, autoOutActor);

    // Assert: the auto-out may only clear one layer; "Tomar tudo" could put a set on air.
    expect(isAllowed, 'the auto-out must be refused this command').toBe(false);
  });
});
