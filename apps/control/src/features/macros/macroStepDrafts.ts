/**
 * The step rows of the macro editor, and the exact `steps` they stand for. A row holds
 * every control any kind of step needs (item, layer, OBS scene, wait text), so switching a row's
 * kind back and forth loses nothing typed; only what its kind needs is sent. Pure
 * functions, no drawing.
 */
import { longestMacroWaitMs, type MacroStep, type ObsSceneTarget } from '@bajaovrlay/shared';

import { ptBR } from '@/i18n/ptBR';

/** One step row as the editor holds it while the operator edits. */
export type MacroStepDraft = {
  /** The row's own id, so a drag and React can follow it; never sent to the server. */
  draftId: string;
  kind: MacroStep['kind'];
  /** The item of a "Pôr item no ar" row; empty while none is chosen. */
  itemId: string;
  /** The layer of a "Limpar camada" row; empty while none is chosen. */
  layerId: string;
  /** The wait of an "Esperar" row, in seconds as typed: "0,5", "2". */
  waitSecondsText: string;
  /** The scene of a "Trocar cena do OBS" row, as OBS names it; empty while none is chosen. */
  sceneName: string;
  /** Which of OBS's outputs a "Trocar cena do OBS" row switches; Program for a new row. */
  obsTarget: ObsSceneTarget;
};

/** The outcome of checking the rows: the steps to send, or one message per wrong row. */
export type MacroStepsFromDrafts =
  | { isValid: true; steps: MacroStep[] }
  | { isValid: false; errorMessageByDraftId: Record<string, string> };

const fieldErrors = ptBR.quickFire.macroEditor.fieldErrors;
const millisecondsPerSecond = 1_000;

// Whole seconds, then optionally a comma or a point and one to three decimals: "0,5",
// "2", "1.25". Three decimals is one millisecond, the server's unit; a fourth decimal
// would be part of a millisecond and is refused rather than rounded behind the
// operator's back. No sign and no exponent.
const secondsWithUpToThreeDecimalsPattern = /^(\d+)(?:[.,](\d{1,3}))?$/;

/**
 * The wait typed in seconds, as whole milliseconds; undefined when the text is not such a
 * number or is outside 1 ms to 10 s (the server's limits, MacroStepSchema).
 * Worked out from the digits, never through a floating-point multiplication, so "0,001"
 * is exactly 1 and never 0.999…
 */
export function convertWaitSecondsTextToMilliseconds(text: string): number | undefined {
  const match = secondsWithUpToThreeDecimalsPattern.exec(text.trim());
  if (match === null) {
    return undefined;
  }
  const wholeSecondsText = match[1] ?? '0';
  const decimalsText = match[2] ?? '';
  const millisecondsFromDecimals = Number(decimalsText.padEnd(3, '0'));
  const milliseconds = Number(wholeSecondsText) * millisecondsPerSecond + millisecondsFromDecimals;
  const isWithinTheServerLimits = milliseconds >= 1 && milliseconds <= longestMacroWaitMs;
  return isWithinTheServerLimits ? milliseconds : undefined;
}

/** A wait in milliseconds written as an operator types it in seconds: 500 → "0,5". */
export function formatWaitMillisecondsAsSecondsText(milliseconds: number): string {
  const wholeSeconds = Math.floor(milliseconds / millisecondsPerSecond);
  const millisecondsLeft = milliseconds % millisecondsPerSecond;
  if (millisecondsLeft === 0) {
    return String(wholeSeconds);
  }
  // Three digits, then the zeros at the end dropped: 250 → "250" → "25".
  const decimalsText = String(millisecondsLeft).padStart(3, '0').replace(/0+$/, '');
  return `${wholeSeconds},${decimalsText}`;
}

/**
 * The step one row stands for, or the pt-BR message saying what is missing in it. A scene
 * row is checked against the scenes OBS lists now: with no list (OBS not connected) it
 * cannot be checked, so it is not saved (BAJAOVRLAY-27).
 */
function buildStepFromDraft(
  draft: MacroStepDraft,
  obsSceneNames: string[],
): MacroStep | { errorMessage: string } {
  switch (draft.kind) {
    case 'takeItem':
      return draft.itemId === ''
        ? { errorMessage: fieldErrors.itemMissing }
        : { kind: 'takeItem', itemId: draft.itemId };
    case 'clearLayer':
      return draft.layerId === ''
        ? { errorMessage: fieldErrors.layerMissing }
        : { kind: 'clearLayer', layerId: draft.layerId };
    case 'clearAll':
      return { kind: 'clearAll' };
    case 'obsScene':
      if (obsSceneNames.length === 0) {
        return { errorMessage: fieldErrors.obsSceneListEmpty };
      }
      if (draft.sceneName === '') {
        return { errorMessage: fieldErrors.sceneMissing };
      }
      if (!obsSceneNames.includes(draft.sceneName)) {
        return { errorMessage: fieldErrors.sceneGone(draft.sceneName) };
      }
      return { kind: 'obsScene', sceneName: draft.sceneName, target: draft.obsTarget };
    case 'wait': {
      const milliseconds = convertWaitSecondsTextToMilliseconds(draft.waitSecondsText);
      return milliseconds === undefined
        ? { errorMessage: fieldErrors.waitInvalid }
        : { kind: 'wait', ms: milliseconds };
    }
  }
}

/**
 * Builds the `steps` of createMacro or updateMacro from the rows, in the rows' order,
 * checking scene rows against `obsSceneNames` (the obs slice's list, empty without OBS).
 * Every wrong row is reported at once, each with its own message; nothing is built
 * unless every row is right. An empty list is valid: a macro may have no step yet.
 */
export function buildMacroStepsFromDrafts(
  drafts: MacroStepDraft[],
  obsSceneNames: string[],
): MacroStepsFromDrafts {
  const steps: MacroStep[] = [];
  const errorMessageByDraftId: Record<string, string> = {};
  for (const draft of drafts) {
    const stepOrError = buildStepFromDraft(draft, obsSceneNames);
    if ('errorMessage' in stepOrError) {
      errorMessageByDraftId[draft.draftId] = stepOrError.errorMessage;
    } else {
      steps.push(stepOrError);
    }
  }
  const hasAnyWrongRow = Object.keys(errorMessageByDraftId).length > 0;
  return hasAnyWrongRow ? { isValid: false, errorMessageByDraftId } : { isValid: true, steps };
}

/** A new, empty row of the given kind; "+ Passo" adds one of these. */
export function buildEmptyMacroStepDraft(draftId: string, kind: MacroStep['kind']): MacroStepDraft {
  return {
    draftId,
    kind,
    itemId: '',
    layerId: '',
    waitSecondsText: '',
    sceneName: '',
    obsTarget: 'program',
  };
}

/**
 * The rows for a stored macro's steps, one per step, each given an id by
 * `createDraftId`. A wait shows in seconds as an operator writes it.
 */
export function buildMacroStepDraftsFromSteps(
  steps: MacroStep[],
  createDraftId: () => string,
): MacroStepDraft[] {
  return steps.map((step) => {
    const draft = buildEmptyMacroStepDraft(createDraftId(), step.kind);
    switch (step.kind) {
      case 'takeItem':
        return { ...draft, itemId: step.itemId };
      case 'clearLayer':
        return { ...draft, layerId: step.layerId };
      case 'clearAll':
        return draft;
      case 'obsScene':
        return { ...draft, sceneName: step.sceneName, obsTarget: step.target };
      case 'wait':
        return { ...draft, waitSecondsText: formatWaitMillisecondsAsSecondsText(step.ms) };
    }
  });
}
