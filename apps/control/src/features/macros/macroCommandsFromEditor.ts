/**
 * The two commands "Salvar macro" can send, built from values that already passed their
 * checks: `createMacro` for a new macro (all of it) and `updateMacro` for a stored one
 * (only what differs from the macro as it was when the editor opened). Pure functions.
 *
 * Sending only the changes is the item editor's rule too: two operators who change
 * different parts of one macro both keep their change. The steps are one part: updateMacro
 * replaces the whole list, so a change to any step sends every step.
 */
import type {
  CreateMacroCommand,
  ItemColor,
  Macro,
  MacroStep,
  UpdateMacroCommand,
} from '@bajaovrlay/shared';

/** What the editor holds once its checks passed. */
export type MacroEditorValues = {
  label: string;
  color: ItemColor;
  steps: MacroStep[];
};

/** Builds `createMacro` for a new macro; the server gives it its id. */
export function buildCreateMacroCommand(values: MacroEditorValues): CreateMacroCommand {
  return {
    type: 'createMacro',
    label: values.label.trim(),
    color: values.color,
    steps: values.steps,
  };
}

/** What buildUpdateMacroCommand needs: the macro as opened, and the editor's values. */
export type MacroUpdateParts = MacroEditorValues & { macroAsOpened: Macro };

/**
 * Builds `updateMacro` with only the label, colour and steps that differ from the macro
 * as opened. Undefined when nothing differs, so the caller sends nothing.
 */
export function buildUpdateMacroCommand(parts: MacroUpdateParts): UpdateMacroCommand | undefined {
  const { macroAsOpened } = parts;
  const command: UpdateMacroCommand = { type: 'updateMacro', macroId: macroAsOpened.id };

  const labelFromTheEditor = parts.label.trim();
  if (labelFromTheEditor !== macroAsOpened.label) {
    command.label = labelFromTheEditor;
  }
  if (parts.color !== macroAsOpened.color) {
    command.color = parts.color;
  }
  // Steps are plain data (kinds, ids, numbers), so comparing their JSON text is a fair
  // "same steps in the same order" test.
  const haveStepsChanged = JSON.stringify(parts.steps) !== JSON.stringify(macroAsOpened.steps);
  if (haveStepsChanged) {
    command.steps = parts.steps;
  }

  const isAnythingChanged =
    command.label !== undefined || command.color !== undefined || command.steps !== undefined;
  return isAnythingChanged ? command : undefined;
}
