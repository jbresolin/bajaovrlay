import type { CreateMacroCommand, Macro } from '@bajaovrlay/shared';

import type { ReducerContext, ReducerOutcome, SlicesChangedByCommands } from './reducerTypes.js';

/**
 * createMacro: adds a macro after the others, with the id the store made. Never refused.
 * Deliberate: the items and layers its steps name are not checked here (as createItem
 * does not check field values); a step naming one that does not exist is refused when
 * it runs, and stops the macro there. A macro can so be written before its items.
 */
export function reduceCreateMacro(
  slices: SlicesChangedByCommands,
  command: CreateMacroCommand,
  context: ReducerContext,
): ReducerOutcome {
  const newMacro: Macro = {
    id: context.newMacroId,
    label: command.label,
    color: command.color,
    steps: command.steps,
  };
  return { status: 'applied', slices: { ...slices, macros: [...slices.macros, newMacro] } };
}
