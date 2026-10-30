import type { EntityLibrary } from '@bajaovrlay/shared';
import type { ReactNode } from 'react';
import { type UseFormReturn, useWatch } from 'react-hook-form';

import { ptBR } from '@/i18n/ptBR';

import {
  canFieldTakeTheWholeClock,
  listClockFieldKeysFilledByTheWholeClock,
} from './bindingChoices';
import { doesListFieldOfferAChoice, ListFieldWithSourceChoice } from './ListFieldWithSourceChoice';
import type { SchemaFormBindingOptions } from './schemaFormBindingOptions';
import type { SchemaFormDescription, SchemaFormFieldDescription } from './schemaFormDescription';
import { SchemaFormFieldRow } from './SchemaFormFieldRow';
import type { SchemaFormValues, UnsupportedValueAsJson } from './schemaFormValues';
import { TextListField } from './TextListField';
import type { TextShownInUntouchedField } from './textShownInUntouchedField';
import { UnsupportedValueBox } from './UnsupportedValueBox';

/**
 * Puts the kept values of a whole unsupported schema back together as one JSON text for
 * reading, or undefined when nothing was kept. Each kept text is JSON written by this
 * folder (buildSchemaFormValues.ts), so JSON.parse reads it back.
 */
function writeAllUnsupportedValuesAsOneJsonText(
  unsupportedValuesAsJson: UnsupportedValueAsJson[],
): string | undefined {
  if (unsupportedValuesAsJson.length === 0) {
    return undefined;
  }
  const keysAndValues: Array<[string, unknown]> = unsupportedValuesAsJson.map(
    (unsupportedValue) => [unsupportedValue.key, JSON.parse(unsupportedValue.jsonText)],
  );
  return JSON.stringify(Object.fromEntries(keysAndValues), null, 2);
}

/** What the panel shows in place of a field's control, when it draws the field read-only. */
function readOwnContentOfField(
  readOnlyFieldContents: Record<string, ReactNode> | undefined,
  fieldKey: string,
): ReactNode | undefined {
  if (readOnlyFieldContents === undefined || !Object.hasOwn(readOnlyFieldContents, fieldKey)) {
    return undefined;
  }
  return readOnlyFieldContents[fieldKey];
}

/** Texts, lists and unsupported fields take the full width; smaller controls sit two to a row. */
function chooseWidthClassOfField(field: SchemaFormFieldDescription): string {
  const takesTheFullWidth =
    field.control === 'text' || field.control === 'textList' || field.control === 'unsupported';
  return takesTheFullWidth ? 'col-span-2' : 'col-span-2 sm:col-span-1';
}

/**
 * Draws the fields of a generated form, in the manifest's order, for a
 * `useForm<SchemaFormValues>()` whose values came from buildSchemaFormValues.ts and whose
 * resolver came from buildSchemaFormResolver. It draws no buttons and sends nothing: the
 * panel around it owns the form and the commands.
 * - A graphic with no data schema draws nothing.
 * - A schema that is not an object with properties draws one read-only JSON box.
 * `controlIdPrefix` starts every element id. Two generated forms are on the page at once
 * (the item editor and "Edição rápida"), and with equal ids a label of the second would
 * point at a control of the first, so each must pass its own.
 * `textShownInUntouchedField` lets the panel have one text or mm:ss field show a text of
 * the panel's own while the operator has not touched it (textShownInUntouchedField.ts).
 * `bindingOptions` (the item editor only) lets a field read a data source: "Fonte" where a
 * bindable path fits it, "Relógio da fonte" on a clock's time field, which then fills the
 * three other clock fields; a field the form draws read-only (a list) may read one too.
 * `entityLibrary` (the item editor only) lets a field read the library: "Cadastro" where
 * an attribute fits it (BAJAOVRLAY-19), and a list field "Lista dos cadastros" where every
 * sponsor or every slot fits it (BAJAOVRLAY-46).
 */
export function SchemaFormFields(props: {
  form: UseFormReturn<SchemaFormValues>;
  description: SchemaFormDescription;
  controlIdPrefix: string;
  /** Turns every control off, for example while there is no connection. Default: false. */
  isDisabled?: boolean;
  /** A text for one untouched field to show in place of its value. Default: none. */
  textShownInUntouchedField?: TextShownInUntouchedField;
  /** What a field may read from a data source; left out, no field offers "Fonte". */
  bindingOptions?: SchemaFormBindingOptions;
  /** The entity library a field may read; left out, no field offers "Cadastro". */
  entityLibrary?: EntityLibrary;
  /**
   * Fields drawn read-only, by key, with what the panel shows in place of their control
   * ("Edição rápida" shows a field a source keeps up to date this way). Default: none.
   */
  readOnlyFieldContents?: Record<string, ReactNode>;
  /**
   * Told when an image field's upload starts and ends, with the field's key, so the panel
   * can keep its save buttons off meanwhile (the item editor, BAJAOVRLAY-51). Left out
   * ("Edição rápida"), nobody is told. It must stay the same function from one draw to the
   * next, or every row redraws at each keystroke (SchemaFormFieldRow.tsx).
   */
  onImageUploadingChange?: (fieldKey: string, isUploading: boolean) => void;
}) {
  const { form, description, controlIdPrefix, textShownInUntouchedField, bindingOptions } = props;
  const isDisabled = props.isDisabled ?? false;
  const unsupportedValuesAsJson =
    useWatch({ control: form.control, name: 'unsupportedValuesAsJson' }) ?? [];
  // A yes or no, computed in the watch (`compute`): react-hook-form then redraws these
  // fields only when the answer changes, not at every pick of a kind (BAJAOVRLAY-45).
  const isWholeClockChosen = useWatch({
    control: form.control,
    name: 'kinds',
    compute: (kinds) =>
      description.fields.some(
        (field) =>
          (kinds ?? {})[field.key] === 'wholeClock' &&
          canFieldTakeTheWholeClock(description.dataSchema, field.key),
      ),
  });
  const keysFilledByTheWholeClock = isWholeClockChosen
    ? listClockFieldKeysFilledByTheWholeClock(description.dataSchema)
    : [];

  if (description.isWholeDataSchemaUnsupported) {
    return (
      <GeneratedFieldsGroup>
        <UnsupportedValueBox
          controlId={`${controlIdPrefix}-whole-data`}
          label={ptBR.schemaForm.unsupportedWholeDataLabel}
          note={ptBR.schemaForm.unsupportedWholeDataNote}
          jsonText={writeAllUnsupportedValuesAsOneJsonText(unsupportedValuesAsJson)}
        />
      </GeneratedFieldsGroup>
    );
  }
  if (description.fields.length === 0) {
    return null;
  }

  return (
    <GeneratedFieldsGroup>
      <div className="grid grid-cols-2 gap-4">
        {description.fields.map((field, positionInTheForm) => {
          // The position in the form, not the key, makes every element id. A key is whatever
          // the graphic's author wrote: one with a space would break `aria-describedby`
          // (a list of ids separated by spaces), and "titulo-help" next to "titulo" would
          // give two elements the id of the first one's help text.
          if (field.control === 'unsupported') {
            const keptValue = unsupportedValuesAsJson.find((entry) => entry.key === field.key);
            const offersAChoice = doesListFieldOfferAChoice(
              description.dataSchema,
              field.key,
              bindingOptions,
              props.entityLibrary,
            );
            if (offersAChoice) {
              return (
                <div key={field.key} className={chooseWidthClassOfField(field)}>
                  <ListFieldWithSourceChoice
                    form={form}
                    field={field}
                    dataSchema={description.dataSchema}
                    controlId={`${controlIdPrefix}-unsupported-${positionInTheForm}`}
                    keptJsonText={keptValue?.jsonText}
                    bindingOptions={bindingOptions}
                    entityLibrary={props.entityLibrary}
                    isDisabled={isDisabled}
                  />
                </div>
              );
            }
            return (
              <div key={field.key} className={chooseWidthClassOfField(field)}>
                <UnsupportedValueBox
                  controlId={`${controlIdPrefix}-unsupported-${positionInTheForm}`}
                  label={field.label}
                  note={
                    keptValue === undefined
                      ? ptBR.schemaForm.unsupportedPropertyWithoutValueNote
                      : ptBR.schemaForm.unsupportedPropertyNote
                  }
                  jsonText={keptValue?.jsonText}
                />
              </div>
            );
          }
          // A list of texts is typed line by line, and is drawn read-only like any field
          // when the panel asks (readOnlyFieldContents).
          const readOnlyContent = readOwnContentOfField(props.readOnlyFieldContents, field.key);
          if (field.control === 'textList' && readOnlyContent === undefined) {
            return (
              <div key={field.key} className={chooseWidthClassOfField(field)}>
                <TextListField
                  form={form}
                  field={field}
                  controlId={`${controlIdPrefix}-field-${positionInTheForm}`}
                  isDisabled={isDisabled}
                />
              </div>
            );
          }
          return (
            <div key={field.key} className={chooseWidthClassOfField(field)}>
              <SchemaFormFieldRow
                form={form}
                field={field}
                controlId={`${controlIdPrefix}-field-${positionInTheForm}`}
                isDisabled={isDisabled}
                textShownWhileUntouched={
                  textShownInUntouchedField?.fieldKey === field.key
                    ? textShownInUntouchedField
                    : undefined
                }
                dataSchema={description.dataSchema}
                bindingOptions={bindingOptions}
                entityLibrary={props.entityLibrary}
                isFilledByTheWholeClock={keysFilledByTheWholeClock.includes(field.key)}
                readOnlyContent={readOnlyContent}
                onImageUploadingChange={props.onImageUploadingChange}
              />
            </div>
          );
        })}
      </div>
    </GeneratedFieldsGroup>
  );
}

/**
 * The fieldset around the generated fields, named "Campos do gráfico". A graphic may title
 * a field like one of the editor's own ("Rótulo", "Cor"); inside this group a screen reader
 * says whose field it is, and a test finds the editor's own by looking outside it. The
 * name is read, not shown: the panel's heading already says these are the graphic's.
 */
function GeneratedFieldsGroup(props: { children: ReactNode }) {
  return (
    <fieldset className="min-w-0" data-testid="generated-fields">
      <legend className="sr-only">{ptBR.schemaForm.generatedFieldsGroupName}</legend>
      {props.children}
    </fieldset>
  );
}
