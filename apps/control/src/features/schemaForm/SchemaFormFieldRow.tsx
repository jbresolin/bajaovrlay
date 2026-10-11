import { Controller, type UseFormReturn, useWatch } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ptBR } from '@/i18n/ptBR';

import type { SchemaFormFieldDescription } from './schemaFormDescription';
import { SchemaFormValueControl } from './SchemaFormValueControl';
import type { SchemaFormFieldValue, SchemaFormValues } from './schemaFormValues';

// The kinds the selector lists, in the order the operator reads them.
const kindsTheSelectorOffers = ['literal', 'takeTime'] as const;

/** Joins the ids of the texts under a control for `aria-describedby`; undefined when none. */
function joinIdsOfDescribingTexts(idsOrNothing: Array<string | undefined>): string | undefined {
  const ids = idsOrNothing.filter((id) => id !== undefined);
  return ids.length === 0 ? undefined : ids.join(' ');
}

/**
 * One editable field of a generated form, top to bottom: its label (with a mark when
 * the manifest requires it), the kind selector where "filled by the server at the take"
 * is offered, the control, the "limpar" button of an optional field, the note of a
 * field without a value, the manifest's help text and the pt-BR error message.
 *
 * Two things here decide what the form sends, so they are spelled out:
 * - An optional typed field (text, number, mm:ss, date) that is emptied becomes cleared
 *   (null) at once: for those, blank and cleared are one state, and typing again is the
 *   way back. A dropdown or a switch can only be cleared with "limpar"; choosing an
 *   option or flipping the switch is the way back.
 * - While the kind is "filled by the server", the control is replaced by a note and the
 *   typed value is kept underneath, so switching back shows it again.
 */
export function SchemaFormFieldRow(props: {
  form: UseFormReturn<SchemaFormValues>;
  field: SchemaFormFieldDescription;
  /** The element id of this field's control; the other ids of the row start with it. */
  controlId: string;
  isDisabled: boolean;
}) {
  const { form, field, controlId, isDisabled } = props;
  const kindSelectorId = `${controlId}-kind`;
  const helpTextId = `${controlId}-help`;
  const errorMessageId = `${controlId}-error`;

  const chosenKind = useWatch({ control: form.control, name: `kinds.${field.key}` });
  const isFilledByTheServer = field.offersTakeTime && chosenKind === 'takeTime';
  const errorMessage = form.formState.errors.values?.[field.key]?.message;
  const hasError = errorMessage !== undefined && !isFilledByTheServer;
  const describedByIds = joinIdsOfDescribingTexts([
    field.help === undefined ? undefined : helpTextId,
    hasError ? errorMessageId : undefined,
  ]);
  const isTypedControl = field.control !== 'select' && field.control !== 'switch';

  /** Stores what a control reports; an optional typed field that is emptied is cleared. */
  function chooseValueToStore(formValue: SchemaFormFieldValue): SchemaFormFieldValue {
    const isEmptiedOptionalTypedField = formValue === '' && isTypedControl && !field.isRequired;
    return isEmptiedOptionalTypedField ? null : formValue;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1">
        <Label htmlFor={controlId}>{field.label}</Label>
        {field.isRequired && (
          <span
            aria-hidden="true"
            title={ptBR.schemaForm.requiredMarkerHint}
            className="text-sm leading-none text-destructive"
          >
            {ptBR.schemaForm.requiredMarker}
          </span>
        )}
      </div>

      {field.offersTakeTime && (
        <Controller
          control={form.control}
          name={`kinds.${field.key}`}
          render={({ field: kindField }) => (
            <Select
              value={kindField.value}
              onValueChange={kindField.onChange}
              disabled={isDisabled}
            >
              <SelectTrigger
                id={kindSelectorId}
                size="sm"
                className="w-full"
                aria-label={ptBR.schemaForm.kindSelectorLabel(field.label)}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {kindsTheSelectorOffers.map((kind) => (
                  <SelectItem key={kind} value={kind}>
                    {ptBR.schemaForm.kindLabels[kind]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      )}

      {isFilledByTheServer ? (
        <p id={controlId} className="text-sm text-muted-foreground">
          {ptBR.schemaForm.takeTimeNote}
        </p>
      ) : (
        <Controller
          control={form.control}
          name={`values.${field.key}`}
          render={({ field: valueField }) => (
            <>
              <div className="flex items-center gap-2">
                <SchemaFormValueControl
                  field={field}
                  controlId={controlId}
                  formValue={valueField.value ?? null}
                  onFormValueChange={(formValue) =>
                    valueField.onChange(chooseValueToStore(formValue))
                  }
                  onBlur={valueField.onBlur}
                  focusRef={valueField.ref}
                  describedByIds={describedByIds}
                  hasError={hasError}
                  isDisabled={isDisabled}
                />
                {!field.isRequired && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    aria-label={ptBR.schemaForm.clearFieldButtonLabel(field.label)}
                    disabled={isDisabled || valueField.value === null}
                    onClick={() => valueField.onChange(null)}
                  >
                    {ptBR.schemaForm.clearFieldButton}
                  </Button>
                )}
              </div>
              {valueField.value === null && (
                <p className="text-xs text-muted-foreground">{ptBR.schemaForm.clearedFieldNote}</p>
              )}
            </>
          )}
        />
      )}

      {field.help !== undefined && (
        <p id={helpTextId} className="text-xs text-muted-foreground">
          {field.help}
        </p>
      )}
      {hasError && (
        <p id={errorMessageId} className="text-sm text-destructive">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
