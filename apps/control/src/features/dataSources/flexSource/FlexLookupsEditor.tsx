import { Controller, useFieldArray, type UseFormReturn } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { buildErrorAttributesForControl, FormFieldRow } from '@/features/items/FormFieldRow';
import { ptBR } from '@/i18n/ptBR';

import { buildEmptyLookupFormValues, type LookupFormValues } from './flexMappingOptionsFormValues';
import type { FlexSourceFormValues } from './flexSourceFormValues';
import { readErrorMessageAtPath } from './formErrorAtPath';

const texts = ptBR.dataSources.flexForm.mappingOptions;

/** The text fields of a lookup, each an input with its label, in the order shown. */
const lookupTextFields = ['lookupName', 'listPath', 'keyPath', 'entryKeyPath'] as const;

/**
 * The lookups of one list mapping (BAJAOVRLAY-53): lists from another request joined by
 * key, such as the teams by car number. Each lookup has its name (which a field's
 * "Consulta" picks), the request whose answer holds the list, the list's path, the key in
 * each of its items and the key in each item of this shape. "+ Consulta" adds one reading
 * the first request.
 */
export function FlexLookupsEditor(props: {
  form: UseFormReturn<FlexSourceFormValues>;
  mappingPath: `mappings.${number}`;
  requestIdsToOffer: string[];
  controlIdPrefix: string;
}) {
  const { form, mappingPath } = props;
  const lookups = useFieldArray({ control: form.control, name: `${mappingPath}.lookups` });
  const errors = form.formState.errors;

  return (
    <div role="group" aria-label={texts.lookupsTitle} className="flex flex-col gap-2">
      <span className="text-sm font-medium">{texts.lookupsTitle}</span>
      {lookups.fields.map((lookupField, lookupIndex) => {
        const lookupNumber = lookupIndex + 1;
        const lookupPath = `${mappingPath}.lookups.${lookupIndex}` as const;
        const idPrefix = `${props.controlIdPrefix}-lookups-${lookupIndex}`;
        const requestIdControlId = `${idPrefix}-requestId`;
        const requestIdError = readErrorMessageAtPath(errors, `${lookupPath}.requestId`);
        return (
          <section
            key={lookupField.id}
            aria-label={texts.lookupRegionLabel(lookupNumber)}
            className="grid gap-2 rounded-md bg-muted p-2 md:grid-cols-2"
          >
            {lookupTextFields.map((fieldName: keyof LookupFormValues) => {
              const controlId = `${idPrefix}-${fieldName}`;
              const errorMessage = readErrorMessageAtPath(errors, `${lookupPath}.${fieldName}`);
              return (
                <FormFieldRow
                  key={fieldName}
                  label={texts.lookupFields[fieldName]}
                  controlId={controlId}
                  errorMessage={errorMessage}
                >
                  <Input
                    id={controlId}
                    className="bg-background font-mono"
                    {...form.register(`${lookupPath}.${fieldName}`)}
                    {...buildErrorAttributesForControl(controlId, errorMessage)}
                  />
                </FormFieldRow>
              );
            })}
            <FormFieldRow
              label={texts.lookupFields.requestId}
              controlId={requestIdControlId}
              errorMessage={requestIdError}
            >
              <Controller
                control={form.control}
                name={`${lookupPath}.requestId`}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger
                      id={requestIdControlId}
                      className="w-full bg-background"
                      {...buildErrorAttributesForControl(requestIdControlId, requestIdError)}
                    >
                      <SelectValue placeholder={ptBR.dataSources.form.nothingChosenPlaceholder} />
                    </SelectTrigger>
                    <SelectContent>
                      {props.requestIdsToOffer.map((requestId) => (
                        <SelectItem key={requestId} value={requestId}>
                          {requestId}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormFieldRow>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="self-end justify-self-start"
              onClick={() => lookups.remove(lookupIndex)}
            >
              {texts.removeLookupButton(lookupNumber)}
            </Button>
          </section>
        );
      })}
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="self-start"
        onClick={() => lookups.append(buildEmptyLookupFormValues(props.requestIdsToOffer[0] ?? ''))}
      >
        {texts.addLookupButton}
      </Button>
    </div>
  );
}
