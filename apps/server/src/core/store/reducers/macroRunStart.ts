import { isItemFilledByAnEvent, type MacroRun } from '@bajaovrlay/shared';

import { ptBR } from '../../messages/ptBR.js';
import {
  refuseRunWhileAnotherMacroRuns,
  refuseUnknownMacro,
} from '../quickFireAndMacroRefusals.js';
import { dropTheStopOfMacro } from './macroStops.js';
import { discardEveryPreviewAndMarker } from './previewMarkersAndDiscards.js';
import type { ReducerContext, ReducerOutcome, SlicesChangedByCommands } from './reducerTypes.js';

/**
 * Starts a macro's run: the one path runMacro (a press of its button) and a trigger's
 * firing (BAJAOVRLAY-48, by itself or through "Rodar") share, so every start obeys the
 * same rules. It records the run at step 0, since this command's moment, with the
 * trigger that started it when one did (`trigger`, whose data the take steps read); the
 * macro runner (../macroRunner.ts) then sends the steps.
 * Refused if the macro does not exist, or while any macro is running, this one included:
 * two runs at once would interleave their steps on the same layers. Refused too when a
 * step takes an item filled by an event (ITEM_FILLED_BY_EVENT): such an item goes on air
 * only through its event, and the run would stop at that step half done (gate 2 of PR #22).
 *
 * Starting a run also throws away every preview instance and "will be cleared" marker,
 * in this same state change. Two behaviours sit side by side and never mix:
 * - "Executar" plays the macro on program WITH its timing, one step at a time; a preview
 *   left beside it would no longer show what the screen will be;
 * - "Prévia" (previewMacro, previewMacro.ts) shows the macro's END STATE on the preview
 *   output at once, and "Tomar tudo" then applies it in one cut, WITHOUT the waits.
 * Program is not touched here.
 */
export function startMacroRun(
  slices: SlicesChangedByCommands,
  macroId: string,
  context: ReducerContext,
  trigger?: MacroRun['trigger'],
): ReducerOutcome {
  const macro = slices.macros.find((candidate) => candidate.id === macroId);
  if (macro === undefined) {
    return { status: 'refused', error: refuseUnknownMacro(macroId) };
  }
  const takesAnItemFilledByAnEvent = macro.steps.some((step) => {
    if (step.kind !== 'takeItem') {
      return false;
    }
    const item = slices.items.find((candidate) => candidate.id === step.itemId);
    return item !== undefined && isItemFilledByAnEvent(item.fields);
  });
  if (takesAnItemFilledByAnEvent) {
    return {
      status: 'refused',
      error: { code: 'ITEM_FILLED_BY_EVENT', message: ptBR.eventErrors.itemFilledByAnEvent },
    };
  }
  const runInProgress = slices.macroRuns[0];
  if (runInProgress !== undefined) {
    // The running macro is named by its label; by its id if it was deleted meanwhile,
    // which deleteMacro refuses, so only a bug could get there.
    const runningMacro = slices.macros.find((candidate) => candidate.id === runInProgress.macroId);
    const runningMacroLabel = runningMacro?.label ?? runInProgress.macroId;
    return {
      status: 'refused',
      error: refuseRunWhileAnotherMacroRuns(macro.label, runningMacroLabel),
    };
  }

  const newRun: MacroRun = {
    macroId: macro.id,
    startedAt: context.now,
    currentStep: 0,
    isStopRequested: false,
  };
  if (trigger !== undefined) {
    newRun.trigger = trigger;
  }
  // Prévia is emptied in this same change (see the doc comment above), and a stop its
  // last run left on the button goes: this run says how far it gets.
  const slicesWithPreviewEmptied = discardEveryPreviewAndMarker(slices);
  const macroStops = dropTheStopOfMacro(slices.macroStops, macro.id);
  return {
    status: 'applied',
    slices: { ...slicesWithPreviewEmptied, macroRuns: [newRun], macroStops },
  };
}
