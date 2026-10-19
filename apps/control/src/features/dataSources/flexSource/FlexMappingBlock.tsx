import { listMappableFieldsOfShape, type MappableField } from '@bajaovrlay/shared';
import { Controller, type UseFormReturn } from 'react-hook-form';

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

import { FlexFieldRuleRow } from './FlexFieldRuleRow';
import type { FlexSourceFormValues, MappableShapeKey } from './flexSourceFormValues';
import { readErrorMessageAtPath } from './formErrorAtPath';

const texts = ptBR.dataSources.flexForm;

/**
 * One shape's mapping block: the request it reads, the "Caminho da lista" for positions
 * and standings, then one row per field listMappableFieldsOfShape gives, the shape's own
 * fields first, then (for a list) each item's fields; required fields first and marked.
 * The rows are the form's fieldRules in that same order, so row i is field i.
 */
export function FlexMappingBlock(props: {
  form: UseFormReturn<FlexSourceFormValues>;
  mappingIndex: number;
  shapeKey: MappableShapeKey;
  requestIdsToOffer: string[];
  controlIdPrefix: string;
  onRemove: () => void;
}) {
  const { form, mappingIndex, shapeKey } = props;
  const errors = form.formState.errors;
  const mappingPath = `mappings.${mappingIndex}` as const;
  const ids = {
    requestId: `${props.controlIdPrefix}-requestId`,
    entriesPath: `${props.controlIdPrefix}-entriesPath`,
  };
  const requestIdError = readErrorMessageAtPath(errors, `${mappingPath}.requestId`);
  const entriesPathError = readErrorMessageAtPath(errors, `${mappingPath}.entriesPath`);
  const isAList = shapeKey !== 'session';

  // Each field with its row index, split by level for the two headings.
  const fieldsWithRowIndex = listMappableFieldsOfShape(shapeKey).map((field, rowIndex) => ({
    field,
    rowIndex,
  }));
  const topLevelFields = fieldsWithRowIndex.filter(({ field }) => field.level === 'topLevel');
  const entryFields = fieldsWithRowIndex.filter(({ field }) => field.level === 'entry');

  /** Draws the rows of one level under its heading. */
  function renderFieldRows(
    heading: string,
    fieldsOfLevel: { field: MappableField; rowIndex: number }[],
  ) {
    return (
      <div role="group" aria-label={heading} className="flex flex-col gap-2">
        <span className="text-sm font-medium">{heading}</span>
        {fieldsOfLevel.map(({ field, rowIndex }) => (
          <FlexFieldRuleRow
            key={field.targetField}
            form={form}
            field={field}
            rowPath={`${mappingPath}.fieldRules.${rowIndex}`}
            controlIdPrefix={`${props.controlIdPrefix}-fieldRules-${rowIndex}`}
          />
        ))}
      </div>
    );
  }

  const shapeName = texts.shapeNames[shapeKey];
  return (
    <section
      aria-label={texts.mappingRegionLabel(shapeName)}
      className="flex flex-col gap-3 rounded-md border border-border p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <h5 className="font-semibold">{shapeName}</h5>
        <Button type="button" size="sm" variant="ghost" onClick={props.onRemove}>
          {texts.removeMappingButton}
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <FormFieldRow
          label={texts.mappingRequest}
          controlId={ids.requestId}
          errorMessage={requestIdError}
        >
          <Controller
            control={form.control}
            name={`${mappingPath}.requestId`}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger
                  id={ids.requestId}
                  className="w-full"
                  {...buildErrorAttributesForControl(ids.requestId, requestIdError)}
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
        {isAList && (
          <FormFieldRow
            label={texts.entriesPath}
            controlId={ids.entriesPath}
            errorMessage={entriesPathError}
          >
            <Input
              id={ids.entriesPath}
              placeholder={texts.entriesPathPlaceholder}
              className="font-mono"
              {...form.register(`${mappingPath}.entriesPath`)}
              {...buildErrorAttributesForControl(ids.entriesPath, entriesPathError)}
            />
          </FormFieldRow>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{texts.emptyRowHint}</p>
      {renderFieldRows(texts.topLevelFieldsTitle, topLevelFields)}
      {isAList && renderFieldRows(texts.entryFieldsTitle, entryFields)}
    </section>
  );
}
