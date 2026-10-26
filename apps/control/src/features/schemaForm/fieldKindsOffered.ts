/**
 * What a field row of a generated form offers, worked out before it draws anything
 * (SchemaFormFieldRow.tsx): which kinds its kind selector lists, whether its control can
 * show a panel's text, and the ids that describe its control to a screen reader.
 */
import type { EntityLibrary } from '@bajaovrlay/shared';

import { canFieldBeBoundToASource, canFieldTakeTheWholeClock } from './bindingChoices';
import { canFieldReadTheEntityLibrary } from './entityReferenceFormValue';
import { canFieldBeFilledByAnEvent } from './eventFieldFormValue';
import type { SchemaFormBindingOptions } from './schemaFormBindingOptions';
import type { SchemaFormFieldDescription } from './schemaFormDescription';
import type { SchemaFormFieldKind } from './schemaFormValues';

// The controls that can show a panel's text in place of their value: the two that hold
// free text. A number input refuses "27:34", and a switch or a dropdown has no text.
export const controlsThatCanShowAPanelText = ['text', 'duration'];

/**
 * The kinds the selector lists for a field, in the order the operator reads them: typed
 * always; "filled by the server at the take" where the description offers it; "Fonte"
 * where the panel handed binding options and some bindable path fits the field; "Relógio
 * da fonte" on the time field of a graphic that marks the four clock roles; "Evento" in
 * the item editor (binding options handed) where some field of an event fits it;
 * "Cadastro" where the panel handed the entity library and some attribute fits the field.
 */
export function listKindsOfferedForField(
  field: SchemaFormFieldDescription,
  dataSchema: unknown,
  bindingOptions: SchemaFormBindingOptions | undefined,
  entityLibrary: EntityLibrary | undefined,
): SchemaFormFieldKind[] {
  const kinds: SchemaFormFieldKind[] = ['literal'];
  if (field.offersTakeTime) {
    kinds.push('takeTime');
  }
  if (bindingOptions !== undefined && canFieldBeBoundToASource(dataSchema, field.key)) {
    kinds.push('binding');
  }
  if (bindingOptions !== undefined && canFieldTakeTheWholeClock(dataSchema, field.key)) {
    kinds.push('wholeClock');
  }
  if (bindingOptions !== undefined && canFieldBeFilledByAnEvent(dataSchema, field.key)) {
    kinds.push('eventField');
  }
  if (entityLibrary !== undefined && canFieldReadTheEntityLibrary(dataSchema, field.key)) {
    kinds.push('entity');
  }
  return kinds;
}

/** Joins the ids of the texts under a control for `aria-describedby`; undefined when none. */
export function joinIdsOfDescribingTexts(
  idsOrNothing: Array<string | undefined>,
): string | undefined {
  const ids = idsOrNothing.filter((id) => id !== undefined);
  return ids.length === 0 ? undefined : ids.join(' ');
}
