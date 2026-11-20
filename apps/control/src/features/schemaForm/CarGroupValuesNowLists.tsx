import type { CarGroup, InboxEventPayload } from '@bajaovrlay/shared';

import { ptBR } from '@/i18n/ptBR';

import { emptySchemaFormBindingValue, readBindingFromSchemaFormValue } from './bindingFormValue';
import { BindingValueNowLine } from './BindingValueNowLine';
import type { FieldOfCarGroup } from './CarGroupFields';
import { describeEventPathWithItsExample } from './eventFieldFormValue';
import type { SchemaFormBindingOptions } from './schemaFormBindingOptions';
import type { SchemaFormValues } from './schemaFormValues';

const texts = ptBR.carGroups;

/**
 * "Valores agora" under a car picked in the positions (BAJAOVRLAY-66): each field of the
 * group with what its binding reads now. Moved out of CarGroupFields.tsx unchanged when
 * the team picker joined it (BAJAOVRLAY-80); TeamRecordPickControls.tsx lists its own.
 */
export function CarPickValuesNowList(props: {
  fieldsOfTheGroup: FieldOfCarGroup[];
  formValues: SchemaFormValues;
  dataSchema: unknown;
  bindingOptions: SchemaFormBindingOptions;
}) {
  return (
    <ul className="flex flex-col gap-1" aria-label={texts.valuesNowHeading}>
      {props.fieldsOfTheGroup.map(({ field }) => {
        const bindingRead = readBindingFromSchemaFormValue(
          field,
          props.formValues.bindings[field.key] ?? emptySchemaFormBindingValue,
          props.dataSchema,
          false,
        );
        return (
          <li key={field.key} className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-xs">{field.label}</span>
            {bindingRead.status === 'binding' && (
              <BindingValueNowLine
                binding={bindingRead.binding}
                bindingOptions={props.bindingOptions}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * "Valores agora" of a group read "Do evento" (BAJAOVRLAY-67): each field with the payload
 * field it reads and the sample event's value; the labels alone when there is no sample.
 */
export function EventValuesNowList(props: {
  carGroup: CarGroup;
  fieldsOfTheGroup: FieldOfCarGroup[];
  sampleEventPayload: InboxEventPayload | undefined;
}) {
  const { sampleEventPayload } = props;
  return (
    <ul className="flex flex-col gap-1" aria-label={texts.valuesNowHeading}>
      {props.fieldsOfTheGroup.map(({ field }) => (
        <li key={field.key} className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-xs">{field.label}</span>
          {sampleEventPayload === undefined ? null : (
            <span className="text-xs text-muted-foreground">
              {describeEventPathWithItsExample(
                props.carGroup.fields[field.key] ?? '',
                sampleEventPayload,
              )}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
