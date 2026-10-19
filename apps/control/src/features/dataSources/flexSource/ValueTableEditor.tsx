import { useFieldArray, type UseFormReturn } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ptBR } from '@/i18n/ptBR';

import {
  buildEmptyValueTableRowFormValues,
  type FlexSourceFormValues,
} from './flexSourceFormValues';

const texts = ptBR.dataSources.flexForm.valueTable;

/**
 * The table of "Tabela de valores" (mapValues) for one field: each row a value the source
 * sends ("BOX", "RUN", "4") and what it becomes in the canonical shape ("inPit", true,
 * "red"). A value the source sends that is not in the table fails the poll by name, so
 * every code the source can send needs its row.
 */
export function ValueTableEditor(props: {
  form: UseFormReturn<FlexSourceFormValues>;
  rowPath: `mappings.${number}.fieldRules.${number}`;
  fieldLabel: string;
}) {
  const { form, rowPath } = props;
  const tableRows = useFieldArray({ control: form.control, name: `${rowPath}.valueTableRows` });

  return (
    <div
      role="group"
      aria-label={texts.label(props.fieldLabel)}
      className="flex flex-col gap-2 rounded-md bg-muted p-2 md:ml-48"
    >
      {tableRows.fields.map((tableRowField, tableRowIndex) => {
        const tableRowNumber = tableRowIndex + 1;
        const tableRowPath = `${rowPath}.valueTableRows.${tableRowIndex}` as const;
        return (
          <div key={tableRowField.id} className="flex flex-wrap items-center gap-2">
            <Input
              aria-label={texts.sourceValue(tableRowNumber)}
              className="w-36 bg-background font-mono"
              {...form.register(`${tableRowPath}.sourceValue`)}
            />
            <Input
              aria-label={texts.canonicalValue(tableRowNumber)}
              className="w-36 bg-background font-mono"
              {...form.register(`${tableRowPath}.canonicalValueText`)}
            />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => tableRows.remove(tableRowIndex)}
            >
              {texts.removeRowButton(tableRowNumber)}
            </Button>
          </div>
        );
      })}
      <p className="text-xs text-muted-foreground">{ptBR.dataSources.flexForm.typedValueHint}</p>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="self-start"
        onClick={() => tableRows.append(buildEmptyValueTableRowFormValues())}
      >
        {texts.addRowButton}
      </Button>
    </div>
  );
}
