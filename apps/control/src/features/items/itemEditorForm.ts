/**
 * Everything about the part of the item editor that is the same for every graphic and
 * is not drawing: its values, its rules with their pt-BR messages, the values a stored
 * item fills it with, and the auto-out delay converted to the server's milliseconds.
 * (The fields of the chosen graphic are generated from its manifest and keep their own
 * values and rules, features/schemaForm/.)
 */
import {
  defaultItemColor,
  type Graphic,
  type Item,
  type ItemColor,
  ItemColorSchema,
} from '@bajaovrlay/shared';
import { z } from 'zod';

import { ptBR } from '@/i18n/ptBR';

/**
 * The form as the operator edits it. `autoOutAfterSeconds` stays text until the save:
 * digits for whole seconds, or empty for "stay on air until cleared".
 */
export type ItemEditorFormValues = {
  graphicId: string;
  layerId: string;
  label: string;
  color: ItemColor;
  notes: string;
  autoOutAfterSeconds: string;
};

/**
 * The values the form opens with for a new item. The graphic and the layer are empty
 * here because they depend on what the server has registered; the panel chooses the
 * first graphic and its default layer as soon as it knows them.
 */
export const defaultItemEditorFormValues: ItemEditorFormValues = {
  graphicId: '',
  layerId: '',
  label: '',
  color: defaultItemColor,
  notes: '',
  autoOutAfterSeconds: '',
};

/**
 * The values the form opens with for a new item when the page already knows the
 * server's graphics: the first graphic, on its default layer. With no graphic known
 * yet (`undefined`) both stay empty and the panel fills them in when the list arrives.
 */
export function buildItemEditorFormValuesForNewItem(
  firstGraphic: Graphic | undefined,
): ItemEditorFormValues {
  if (firstGraphic === undefined) {
    return defaultItemEditorFormValues;
  }
  return {
    ...defaultItemEditorFormValues,
    graphicId: firstGraphic.id,
    layerId: firstGraphic.defaultLayerId,
  };
}

/** One pt-BR message per field that has a problem; an empty object means "all good". */
export type ItemEditorFormErrors = Partial<Record<keyof ItemEditorFormValues, string>>;

const fieldErrorMessages = ptBR.itemEditor.fieldErrors;
const millisecondsPerSecond = 1_000;

// Whole seconds from 1 up, with no sign, comma or point: "8", "90", never "0" or "7,5".
// Whole seconds are a deliberate limit of this task; the server stores milliseconds, so
// a finer delay can be offered later without changing anything stored.
const wholeSecondsAboveZeroPattern = /^0*[1-9]\d*$/;

/** Answers whether the auto-out text is blank ("none") or whole seconds above zero. */
function isAutoOutTextBlankOrWholeSecondsAboveZero(text: string): boolean {
  return text === '' || wholeSecondsAboveZeroPattern.test(text);
}

const ItemEditorFormSchema = z.object({
  graphicId: z
    .string({ error: fieldErrorMessages.graphicMissing })
    .min(1, { error: fieldErrorMessages.graphicMissing }),
  layerId: z
    .string({ error: fieldErrorMessages.layerMissing })
    .min(1, { error: fieldErrorMessages.layerMissing }),
  // The server refuses an empty label, and a label of spaces is an empty row in the rundown.
  label: z
    .string({ error: fieldErrorMessages.labelMissing })
    .trim()
    .min(1, { error: fieldErrorMessages.labelMissing }),
  color: z.enum(ItemColorSchema.options, { error: fieldErrorMessages.colorMissing }),
  notes: z.string(),
  autoOutAfterSeconds: z
    .string({ error: fieldErrorMessages.autoOutAfterSecondsInvalid })
    .trim()
    .refine(isAutoOutTextBlankOrWholeSecondsAboveZero, {
      error: fieldErrorMessages.autoOutAfterSecondsInvalid,
    }),
});

/**
 * Checks the form and returns one pt-BR message for each field that has a problem.
 * Every wrong field is reported at once; for a field with several problems only the
 * first is kept.
 */
export function findItemEditorFormErrors(formValues: unknown): ItemEditorFormErrors {
  const checkedForm = ItemEditorFormSchema.safeParse(formValues);
  if (checkedForm.success) {
    return {};
  }

  const fieldErrors: ItemEditorFormErrors = {};
  for (const issue of checkedForm.error.issues) {
    const fieldName = issue.path[0] as keyof ItemEditorFormValues;
    const fieldAlreadyHasAMessage = fieldErrors[fieldName] !== undefined;
    if (!fieldAlreadyHasAMessage) {
      fieldErrors[fieldName] = issue.message;
    }
  }
  return fieldErrors;
}

/**
 * Converts the auto-out text that passed findItemEditorFormErrors into the milliseconds
 * the server stores. A blank text is "no auto-out" and returns undefined.
 */
export function convertAutoOutSecondsTextToMilliseconds(text: string): number | undefined {
  const trimmedText = text.trim();
  if (trimmedText === '') {
    return undefined;
  }
  return Number(trimmedText) * millisecondsPerSecond;
}

/**
 * The form's values for a stored item, its delay shown in seconds. What could go wrong:
 * a delay that is not whole seconds (7 500 ms, which only a script can store) is shown
 * as "7.5", and the form's rule then asks the operator to correct it before any save.
 */
export function buildItemEditorFormValuesFromItem(item: Item): ItemEditorFormValues {
  const autoOutAfterSeconds =
    item.autoOutAfterMs === undefined ? '' : String(item.autoOutAfterMs / millisecondsPerSecond);
  return {
    graphicId: item.graphicId,
    layerId: item.layerId,
    label: item.label,
    color: item.color,
    notes: item.notes,
    autoOutAfterSeconds,
  };
}
