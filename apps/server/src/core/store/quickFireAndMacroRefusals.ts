// The refusals of the quick-fire panel and macro commands, each with its stable code and
// pt-BR message, beside commandRefusals.ts and rundownCommandRefusals.ts.
import type { CommandError } from '@bajaovrlay/shared';

import { ptBR } from '../messages/ptBR.js';

/** The refusal for a command naming a quick-fire panel that does not exist. */
export function refuseUnknownQuickFirePanel(panelId: string): CommandError {
  return {
    code: 'QUICK_FIRE_PANEL_NOT_FOUND',
    message: ptBR.quickFirePanelErrors.panelNotFound(panelId),
  };
}

/** The refusal for deleting a panel that still has items (buttons). */
export function refuseDeleteOfPanelWithItems(
  panelName: string,
  numberOfItems: number,
): CommandError {
  return {
    code: 'QUICK_FIRE_PANEL_NOT_EMPTY',
    message: ptBR.quickFirePanelErrors.panelNotEmpty(panelName, numberOfItems),
  };
}

/** The refusal for deleting the only panel left. */
export function refuseDeleteOfLastPanel(panelName: string): CommandError {
  return { code: 'LAST_QUICK_FIRE_PANEL', message: ptBR.quickFirePanelErrors.lastPanel(panelName) };
}

/** The refusal for a command naming a macro that does not exist. */
export function refuseUnknownMacro(macroId: string): CommandError {
  return { code: 'MACRO_NOT_FOUND', message: ptBR.macroErrors.macroNotFound(macroId) };
}

/** The refusal for pressing a macro while a macro (any, this one included) is running. */
export function refuseRunWhileAnotherMacroRuns(
  macroLabel: string,
  runningMacroLabel: string,
): CommandError {
  return {
    code: 'MACRO_RUNNING',
    message: ptBR.macroErrors.anotherMacroRunning(macroLabel, runningMacroLabel),
  };
}

/** The refusal for editing or deleting the macro that is running. */
export function refuseEditOfRunningMacro(macroLabel: string): CommandError {
  return { code: 'MACRO_RUNNING', message: ptBR.macroErrors.macroIsRunning(macroLabel) };
}
