import { type UseFormReturn, useWatch } from 'react-hook-form';

import {
  hasSourceChoiceChangedSinceOpened,
  type SchemaFormDescription,
  type SchemaFormValues,
} from '@/features/schemaForm';
import { ptBR } from '@/i18n/ptBR';

/**
 * The note under the graphic's fields of an item on air: "A mudança de fonte entra no ar
 * na próxima entrada.", shown while a field's source choice differs from the one the
 * editor opened with ("Atualizar no ar" never sends a field read from a source).
 *
 * It watches the form by itself, so only this note redraws when its answer changes, never
 * the form around the fields (BAJAOVRLAY-45, gate 2 round 1 of PR #29): freezing a live
 * field is such a change. The editor draws it only while the item is on air.
 */
export function SourceChangeAtTheNextTakeNote(props: {
  form: UseFormReturn<SchemaFormValues>;
  description: SchemaFormDescription;
  /** The form's values as the editor opened, which the choices now are compared with. */
  formValuesAsOpened: SchemaFormValues;
}) {
  const { form, description, formValuesAsOpened } = props;

  // A yes or no computed in the watch (`compute`): react-hook-form redraws this note only
  // when the answer changes, not at every keystroke or pick.
  const hasSourceChoiceChanged = useWatch({
    control: form.control,
    // The form whole, so every kind of source choice is compared: a "Lista dos cadastros"
    // switched to the other list went unnoticed while only three parts were passed (from
    // PR #28 to gate 2 round 1 of PR #29).
    compute: (formValuesNow: SchemaFormValues) =>
      hasSourceChoiceChangedSinceOpened(description, formValuesNow, formValuesAsOpened),
  });

  if (!hasSourceChoiceChanged) {
    return null;
  }
  return (
    <p role="status" className="text-sm text-muted-foreground">
      {ptBR.bindings.editor.sourceChangeAtTheNextTake}
    </p>
  );
}
