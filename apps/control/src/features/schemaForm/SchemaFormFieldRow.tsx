import { type ReactNode, useState } from 'react';
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

import { canFieldBeBoundToASource, canFieldTakeTheWholeClock } from './bindingChoices';
import { BoundFieldControls, type SchemaFormBindingOptions } from './BoundFieldControls';
import { EventFieldControls } from './EventFieldControls';
import { canFieldBeFilledByAnEvent } from './eventFieldFormValue';
import { clearBlankOptionalTypedFormValue } from './fieldValueConversion';
import type { SchemaFormFieldDescription } from './schemaFormDescription';
import { SchemaFormValueControl } from './SchemaFormValueControl';
import type { SchemaFormFieldKind, SchemaFormValues } from './schemaFormValues';
import {
  chooseTextShownInPlaceOfFieldValue,
  type CursorVisitToField,
  type TextShownInUntouchedField,
} from './textShownInUntouchedField';

// The controls that can show a panel's text in place of their value: the two that hold
// free text. A number input refuses "27:34", and a switch or a dropdown has no text.
const controlsThatCanShowAPanelText = ['text', 'duration'];

/**
 * The kinds the selector lists for a field, in the order the operator reads them: typed
 * always; "filled by the server at the take" where the description offers it; "Fonte"
 * where the panel handed binding options and some bindable path fits the field; "Relógio
 * da fonte" on the time field of a graphic that marks the four clock roles; "Evento" in
 * the item editor (binding options handed) where some field of an event fits it.
 */
function listKindsOfferedForField(
  field: SchemaFormFieldDescription,
  dataSchema: unknown,
  bindingOptions: SchemaFormBindingOptions | undefined,
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
  return kinds;
}

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
 *   way back. The form is filled by the same rule (clearBlankOptionalTypedFormValue), so
 *   a field emptied again reads as untouched. A dropdown or a switch can only be cleared
 *   with "limpar"; choosing an option or flipping the switch is the way back.
 * - While the kind is "filled by the server", the control is replaced by a note and the
 *   typed value is kept underneath, so switching back shows it again. The note is read
 *   out with the kind selector, the one control left in the row.
 *
 * A panel may hand the row a text to show while the field is untouched
 * (textShownInUntouchedField.ts). The row then remembers, from the moment the cursor
 * enters the control until it leaves, which text was showing and whether the operator
 * typed, so the text stands still under the cursor. The first keystroke edits the text
 * that was showing, and from then on the form holds what was typed.
 * What could go wrong: a browser sends no "cursor left" when a control is switched off
 * while the cursor is in it, so a panel that uses both `isDisabled` and such a text
 * could leave the text frozen. No panel does today.
 */
export function SchemaFormFieldRow(props: {
  form: UseFormReturn<SchemaFormValues>;
  field: SchemaFormFieldDescription;
  /** The element id of this field's control; the other ids of the row start with it. */
  controlId: string;
  isDisabled: boolean;
  /** The panel's text for this field while it is untouched; undefined for none. */
  textShownWhileUntouched: TextShownInUntouchedField | undefined;
  /** The graphic's data schema, which decides which paths of a source fit the field. */
  dataSchema: unknown;
  /** What the panel offers for reading a source; undefined: no "Fonte" (Edição rápida). */
  bindingOptions: SchemaFormBindingOptions | undefined;
  /** True while another field is "Relógio da fonte" and fills this clock field too. */
  isFilledByTheWholeClock: boolean;
  /** What the panel shows in place of the control, for a field drawn read-only. */
  readOnlyContent: ReactNode | undefined;
}) {
  const { form, field, controlId, isDisabled, textShownWhileUntouched } = props;
  const { dataSchema, bindingOptions, isFilledByTheWholeClock } = props;
  const kindSelectorId = `${controlId}-kind`;
  const takeTimeNoteId = `${controlId}-take-time-note`;
  const helpTextId = `${controlId}-help`;
  const errorMessageId = `${controlId}-error`;

  const chosenKind = useWatch({ control: form.control, name: `kinds.${field.key}` });
  const kindsOffered = listKindsOfferedForField(field, dataSchema, bindingOptions);
  const isFilledByTheServer = field.offersTakeTime && chosenKind === 'takeTime';
  const isReadFromASource =
    (chosenKind === 'binding' || chosenKind === 'wholeClock') && kindsOffered.includes(chosenKind);
  const isFilledByAnEvent = chosenKind === 'eventField' && kindsOffered.includes(chosenKind);
  const errorMessage = form.formState.errors.values?.[field.key]?.message;
  const hasError = errorMessage !== undefined && !isFilledByTheServer && !isFilledByTheWholeClock;
  const hasTypedValue = !isFilledByTheServer && !isReadFromASource && !isFilledByAnEvent;
  const describedByIds = joinIdsOfDescribingTexts([
    field.help === undefined ? undefined : helpTextId,
    hasError ? errorMessageId : undefined,
  ]);

  // What the control shows in place of the form's value, if anything. Undefined for
  // every field no panel gave a text for, which is every field but one on the page.
  const [cursorVisit, setCursorVisit] = useState<CursorVisitToField | undefined>(undefined);
  const canControlShowAPanelText = controlsThatCanShowAPanelText.includes(field.control);
  const textShownInPlaceOfTheValue = chooseTextShownInPlaceOfFieldValue({
    textFromThePanel: canControlShowAPanelText ? textShownWhileUntouched?.text : undefined,
    hasOperatorChangedTheValue: form.formState.dirtyFields.values?.[field.key] === true,
    cursorVisit,
  });

  function rememberTheCursorEnteredTheControl(): void {
    // The cursor going from the input to "limpar" in the same row is one visit.
    if (cursorVisit !== undefined) {
      return;
    }
    setCursorVisit({
      textShownWhenTheCursorEntered: textShownInPlaceOfTheValue,
      hasOperatorTyped: false,
    });
    textShownWhileUntouched?.onCursorEnteredOrLeftTheField(true);
  }
  function forgetTheCursorVisit(): void {
    setCursorVisit(undefined);
    textShownWhileUntouched?.onCursorEnteredOrLeftTheField(false);
  }
  function rememberTheOperatorTyped(): void {
    if (cursorVisit !== undefined && !cursorVisit.hasOperatorTyped) {
      setCursorVisit({ ...cursorVisit, hasOperatorTyped: true });
    }
  }

  if (props.readOnlyContent !== undefined) {
    return (
      <div className="flex flex-col gap-2">
        <Label>{field.label}</Label>
        {props.readOnlyContent}
      </div>
    );
  }

  if (isFilledByTheWholeClock) {
    return (
      <div className="flex flex-col gap-2">
        <Label>{field.label}</Label>
        <p className="text-sm text-muted-foreground">
          {ptBR.bindings.editor.filledByTheWholeClockNote}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1">
        {/* While the server fills the field there is no control for the value, so the
            label points at nothing: the note is not a control, and the kind selector
            already has its own name ("Como preencher …"). */}
        <Label htmlFor={isFilledByTheServer ? undefined : controlId}>{field.label}</Label>
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

      {kindsOffered.length > 1 && (
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
                aria-describedby={isFilledByTheServer ? takeTimeNoteId : undefined}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {kindsOffered.map((kind) => (
                  <SelectItem key={kind} value={kind}>
                    {ptBR.schemaForm.kindLabels[kind]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      )}

      {isReadFromASource && bindingOptions !== undefined && (
        <BoundFieldControls
          form={form}
          field={field}
          dataSchema={dataSchema}
          controlId={controlId}
          isWholeClock={chosenKind === 'wholeClock'}
          bindingOptions={bindingOptions}
          isDisabled={isDisabled}
        />
      )}
      {isFilledByAnEvent && (
        <EventFieldControls
          form={form}
          field={field}
          dataSchema={dataSchema}
          controlId={controlId}
          isDisabled={isDisabled}
        />
      )}
      {isFilledByTheServer && (
        <p id={takeTimeNoteId} className="text-sm text-muted-foreground">
          {ptBR.schemaForm.takeTimeNote}
        </p>
      )}
      {hasTypedValue && (
        <Controller
          control={form.control}
          name={`values.${field.key}`}
          render={({ field: valueField }) => (
            <>
              {/* Focus and blur of everything inside reach this box, which is how the row
                  knows the cursor is in its control. A blur whose cursor goes on to
                  something else inside the box (the "limpar" button) is not a leaving. */}
              <div
                className="flex items-center gap-2"
                onFocus={rememberTheCursorEnteredTheControl}
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) {
                    forgetTheCursorVisit();
                  }
                }}
              >
                <SchemaFormValueControl
                  field={field}
                  controlId={controlId}
                  formValue={textShownInPlaceOfTheValue ?? valueField.value ?? null}
                  onFormValueChange={(formValue) => {
                    rememberTheOperatorTyped();
                    valueField.onChange(clearBlankOptionalTypedFormValue(field, formValue));
                  }}
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
