import { type EntityLibrary, isImageFieldOfDataSchema } from '@bajaovrlay/shared';
import { memo, type ReactNode, useState } from 'react';
import { Controller, type UseFormReturn, useFormState, useWatch } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ptBR } from '@/i18n/ptBR';

import { BoundFieldControls } from './BoundFieldControls';
import { EntityReferenceControls } from './EntityReferenceControls';
import { EventFieldControls } from './EventFieldControls';
import { FieldKindSelect } from './FieldKindSelect';
import {
  controlsThatCanShowAPanelText,
  joinIdsOfDescribingTexts,
  listKindsOfferedForField,
} from './fieldKindsOffered';
import { clearBlankOptionalTypedFormValue } from './fieldValueConversion';
import { ImageUrlFieldControl } from './ImageUrlFieldControl';
import type { SchemaFormBindingOptions } from './schemaFormBindingOptions';
import type { SchemaFormFieldDescription } from './schemaFormDescription';
import { SchemaFormValueControl } from './SchemaFormValueControl';
import type { SchemaFormValues } from './schemaFormValues';
import {
  chooseTextShownInPlaceOfFieldValue,
  type CursorVisitToField,
  type TextShownInUntouchedField,
} from './textShownInUntouchedField';

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
 *
 * Wrapped in React's `memo`, so the row is drawn again only when one of its props changes
 * or when what it watches of its own field does (its kind, its value, its errors): a pick
 * or a keystroke in another field leaves it alone (BAJAOVRLAY-45). That holds only while
 * the panel hands the same props from one draw to the next; the item editor does (the
 * form, the description it keeps, memoised binding options and library). What could go
 * wrong: a prop built anew at every draw (an inline object or function) would silently
 * bring every row's redraw back; ItemEditorPanelRenders.test.tsx fails if it does.
 */
export const SchemaFormFieldRow = memo(function SchemaFormFieldRow(props: {
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
  /** The entity library, which the item editor hands; undefined: no "Cadastro". */
  entityLibrary?: EntityLibrary | undefined;
  /** True while another field is "Relógio da fonte" and fills this clock field too. */
  isFilledByTheWholeClock: boolean;
  /** What the panel shows in place of the control, for a field drawn read-only. */
  readOnlyContent: ReactNode | undefined;
  /** Told when this image field's upload starts and ends; undefined: the panel does not ask. */
  onImageUploadingChange: ((fieldKey: string, isUploading: boolean) => void) | undefined;
}) {
  const { form, field, controlId, isDisabled, textShownWhileUntouched } = props;
  const { dataSchema, bindingOptions, isFilledByTheWholeClock } = props;
  const kindSelectorId = `${controlId}-kind`;
  const takeTimeNoteId = `${controlId}-take-time-note`;
  const helpTextId = `${controlId}-help`;
  const errorMessageId = `${controlId}-error`;

  const chosenKind = useWatch({ control: form.control, name: `kinds.${field.key}` });
  const kindsOffered = listKindsOfferedForField(
    field,
    dataSchema,
    bindingOptions,
    props.entityLibrary,
  );
  const isReadFromTheLibrary = chosenKind === 'entity' && kindsOffered.includes('entity');
  const isImageField = isImageFieldOfDataSchema(dataSchema, field.key);
  const isFilledByTheServer = field.offersTakeTime && chosenKind === 'takeTime';
  const isReadFromASource =
    (chosenKind === 'binding' || chosenKind === 'wholeClock') && kindsOffered.includes(chosenKind);
  const isFilledByAnEvent = chosenKind === 'eventField' && kindsOffered.includes(chosenKind);
  // This field's own state, read through useFormState with its name, never through
  // `form.formState`: a read there makes the whole form redraw on every change of that
  // state anywhere, the first keystroke in any field included (BAJAOVRLAY-45). `exact`,
  // because names are otherwise matched by their start: "manualTrend" would redraw at
  // every keystroke in "manualTrendChangeMs".
  const stateOfThisField = useFormState({
    control: form.control,
    name: `values.${field.key}`,
    exact: true,
  });
  const errorMessage = stateOfThisField.errors.values?.[field.key]?.message;
  const hasError = errorMessage !== undefined && !isFilledByTheServer && !isFilledByTheWholeClock;
  // The one test of "the operator types this value": every other kind replaces the control.
  const hasTypedValue =
    !isFilledByTheServer && !isReadFromASource && !isFilledByAnEvent && !isReadFromTheLibrary;
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
    hasOperatorChangedTheValue: stateOfThisField.dirtyFields.values?.[field.key] === true,
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
        <FieldKindSelect
          form={form}
          field={field}
          controlId={kindSelectorId}
          kindsOffered={kindsOffered}
          describedById={isFilledByTheServer ? takeTimeNoteId : undefined}
          isDisabled={isDisabled}
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
      {isReadFromTheLibrary && props.entityLibrary !== undefined && (
        <EntityReferenceControls
          form={form}
          field={field}
          dataSchema={dataSchema}
          controlId={controlId}
          entityLibrary={props.entityLibrary}
          isDisabled={isDisabled}
        />
      )}
      {isFilledByTheServer && (
        <p id={takeTimeNoteId} className="text-sm text-muted-foreground">
          {ptBR.schemaForm.takeTimeNote}
        </p>
      )}
      {hasTypedValue && isImageField && (
        <Controller
          control={form.control}
          name={`values.${field.key}`}
          render={({ field: valueField }) => (
            <ImageUrlFieldControl
              controlId={controlId}
              label={field.label}
              formValue={valueField.value ?? null}
              onFormValueChange={valueField.onChange}
              onUploadingChange={(isUploading) => {
                props.onImageUploadingChange?.(field.key, isUploading);
              }}
            />
          )}
        />
      )}
      {hasTypedValue && !isImageField && (
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
});
