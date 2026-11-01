import { Controller, type UseFormReturn } from 'react-hook-form';

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

import type { AlternativeSourceKind } from './flexFieldRuleFormValues';
import type { FlexSourceFormValues } from './flexSourceFormValues';
import { readErrorMessageAtPath } from './formErrorAtPath';

/**
 * The controls of one reading, a rule's or an alternative's (BAJAOVRLAY-53), by its kind:
 * a path ("Caminho", "Item de fora"), a fixed value, a lookup chosen from the mapping's
 * lookups and the path on its element, or a column's header and the path in its cell.
 * Each control's name comes from `labels`, so a rule row and its alternatives are told
 * apart by ear and by a test; each error is shown under its control.
 */
export function FlexReadingControls(props: {
  form: UseFormReturn<FlexSourceFormValues>;
  /** The row or alternative whose reading fields these are. */
  readingPath:
    | `mappings.${number}.fieldRules.${number}`
    | `mappings.${number}.fieldRules.${number}.alternatives.${number}`;
  sourceKind: AlternativeSourceKind;
  lookupNamesToOffer: string[];
  controlIdPrefix: string;
  labels: {
    path: string;
    constant: string;
    lookupName: string;
    lookupPath: string;
    columnHeader: string;
    columnPath: string;
  };
}) {
  const { form, readingPath, sourceKind, labels, controlIdPrefix } = props;
  const errors = form.formState.errors;
  const textError = readErrorMessageAtPath(errors, `${readingPath}.pathOrConstantText`);
  const lookupNameError = readErrorMessageAtPath(errors, `${readingPath}.lookupName`);
  const columnHeaderError = readErrorMessageAtPath(errors, `${readingPath}.columnHeader`);
  const ids = {
    text: `${controlIdPrefix}-text`,
    lookupName: `${controlIdPrefix}-lookupName`,
    columnHeader: `${controlIdPrefix}-columnHeader`,
  };

  const textLabelByKind: Record<AlternativeSourceKind, string> = {
    path: labels.path,
    parent: labels.path,
    constant: labels.constant,
    lookup: labels.lookupPath,
    column: labels.columnPath,
  };

  return (
    <>
      {sourceKind === 'lookup' && (
        <Controller
          control={form.control}
          name={`${readingPath}.lookupName`}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger
                aria-label={labels.lookupName}
                className="w-40"
                {...buildErrorAttributesForControl(ids.lookupName, lookupNameError)}
              >
                <SelectValue placeholder={ptBR.dataSources.form.nothingChosenPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {props.lookupNamesToOffer.map((lookupName) => (
                  <SelectItem key={lookupName} value={lookupName}>
                    {lookupName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      )}
      {sourceKind === 'column' && (
        <Input
          aria-label={labels.columnHeader}
          className="w-40"
          {...form.register(`${readingPath}.columnHeader`)}
          {...buildErrorAttributesForControl(ids.columnHeader, columnHeaderError)}
        />
      )}
      <Input
        aria-label={textLabelByKind[sourceKind]}
        className="min-w-40 flex-1 font-mono"
        {...form.register(`${readingPath}.pathOrConstantText`)}
        {...buildErrorAttributesForControl(ids.text, textError)}
      />
      <ReadingErrorLine controlId={ids.lookupName} message={lookupNameError} />
      <ReadingErrorLine controlId={ids.columnHeader} message={columnHeaderError} />
      <ReadingErrorLine controlId={ids.text} message={textError} />
    </>
  );
}

/** One control's error on its own line of the row, or nothing when it has none. */
function ReadingErrorLine(props: { controlId: string; message: string | undefined }) {
  if (props.message === undefined) {
    return null;
  }
  return (
    <p id={`${props.controlId}-error`} className="w-full text-sm text-destructive">
      {props.message}
    </p>
  );
}
