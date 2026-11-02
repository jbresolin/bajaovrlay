// The `macroStops` slice's one rule (BAJAOVRLAY-27): at most one entry per macro, the
// stop of its last run. Shared by endMacroRun (which sets it), runMacro, deleteMacro
// and updateMacro when it changes the steps (which drop it).
import type { MacroStop } from '@bajaovrlay/shared';

/**
 * The stops without this macro's. Hands back the very same list when the macro has none,
 * so the store does not count an unchanged slice as a change.
 */
export function dropTheStopOfMacro(macroStops: MacroStop[], macroId: string): MacroStop[] {
  const hasAStop = macroStops.some((macroStop) => macroStop.macroId === macroId);
  if (!hasAStop) {
    return macroStops;
  }
  return macroStops.filter((macroStop) => macroStop.macroId !== macroId);
}
