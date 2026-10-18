import { Controller, useFieldArray, type UseFormReturn, useWatch } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { buildErrorAttributesForControl } from '@/features/items/FormFieldRow';
import { ptBR } from '@/i18n/ptBR';

import {
  buildEmptyNameAndValueFormValues,
  type FlexSourceFormValues,
  type ValueKind,
} from './flexSourceFormValues';
import { readErrorMessageAtPath } from './formErrorAtPath';

const texts = ptBR.dataSources.flexForm;
const valueKinds: readonly ValueKind[] = ['value', 'environment'];

/** The two lists of rows a request has. */
type NameAndValueListPath = `requests.${number}.headers` | `requests.${number}.queryParameters`;

/**
 * The headers or the query parameters of one request: a row per name, its value typed
 * here ("valor") or read by the server from a BAJAOVRLAY_SOURCE_ variable ("variável de
 * ambiente"), for a token that must never be in the config. "+ Cabeçalho" adds a row.
 */
export function NameAndValueRows(props: {
  form: UseFormReturn<FlexSourceFormValues>;
  listPath: NameAndValueListPath;
  title: string;
  addButtonText: string;
  controlIdPrefix: string;
}) {
  const { form, listPath } = props;
  const rows = useFieldArray({ control: form.control, name: listPath });
  const rowValues = useWatch({ control: form.control, name: listPath });
  const errors = form.formState.errors;
  const isAnyRowFromTheEnvironment = rowValues.some((row) => row.valueKind === 'environment');

  return (
    <div role="group" aria-label={props.title} className="flex flex-col gap-2">
      <span className="text-sm font-medium">{props.title}</span>
      {rows.fields.map((rowField, rowIndex) => {
        const rowNumber = rowIndex + 1;
        const rowPath = `${listPath}.${rowIndex}` as const;
        const idPrefix = `${props.controlIdPrefix}-${rowIndex}`;
        const nameError = readErrorMessageAtPath(errors, `${rowPath}.name`);
        const valueError = readErrorMessageAtPath(errors, `${rowPath}.valueText`);
        const isFromTheEnvironment = rowValues[rowIndex]?.valueKind === 'environment';
        return (
          <div key={rowField.id} className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                aria-label={texts.nameAndValue.name(rowNumber)}
                className="w-40"
                {...form.register(`${rowPath}.name`)}
                {...buildErrorAttributesForControl(`${idPrefix}-name`, nameError)}
              />
              <Controller
                control={form.control}
                name={`${rowPath}.valueKind`}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger
                      aria-label={texts.nameAndValue.valueKind(rowNumber)}
                      className="w-48"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {valueKinds.map((valueKind) => (
                        <SelectItem key={valueKind} value={valueKind}>
                          {texts.nameAndValue.valueKinds[valueKind]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <Input
                aria-label={
                  isFromTheEnvironment
                    ? texts.nameAndValue.environmentVariable(rowNumber)
                    : texts.nameAndValue.value(rowNumber)
                }
                className="min-w-40 flex-1"
                {...form.register(`${rowPath}.valueText`)}
                {...buildErrorAttributesForControl(`${idPrefix}-valueText`, valueError)}
              />
              <Button type="button" size="sm" variant="ghost" onClick={() => rows.remove(rowIndex)}>
                {texts.nameAndValue.removeButton(rowNumber)}
              </Button>
            </div>
            {nameError !== undefined && (
              <p id={`${idPrefix}-name-error`} className="text-sm text-destructive">
                {nameError}
              </p>
            )}
            {valueError !== undefined && (
              <p id={`${idPrefix}-valueText-error`} className="text-sm text-destructive">
                {valueError}
              </p>
            )}
          </div>
        );
      })}
      {isAnyRowFromTheEnvironment && (
        <p className="text-xs text-muted-foreground">{texts.environmentVariableHint}</p>
      )}
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="self-start"
        onClick={() => rows.append(buildEmptyNameAndValueFormValues())}
      >
        {props.addButtonText}
      </Button>
    </div>
  );
}
