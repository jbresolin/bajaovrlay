import type { DataShapeKey } from '@bajaovrlay/shared';
import { Controller, type FieldPath, type UseFormReturn } from 'react-hook-form';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { buildErrorAttributesForControl, FormFieldRow } from '@/features/items/FormFieldRow';
import { ptBR } from '@/i18n/ptBR';

import { FlexIncompleteConditionsEditor } from './FlexIncompleteConditionsEditor';
import { FlexLookupsEditor } from './FlexLookupsEditor';
import type { FlexSourceFormValues } from './flexSourceFormValues';
import { readErrorMessageAtPath } from './formErrorAtPath';

const texts = ptBR.dataSources.flexForm.mappingOptions;

/**
 * The options of one mapping block beside its rows (BAJAOVRLAY-53), each on the shapes it
 * is for: the list inside each item, the lookups and the table's layout on every list;
 * the parts by column on the standings; the gaps switch on the positions; the
 * incomplete-match conditions on the brackets; the refusal flag on every shape. An option
 * left empty is left out of the config.
 */
export function FlexMappingOptions(props: {
  form: UseFormReturn<FlexSourceFormValues>;
  mappingIndex: number;
  shapeKey: DataShapeKey;
  requestIdsToOffer: string[];
  controlIdPrefix: string;
}) {
  const { form, shapeKey, controlIdPrefix } = props;
  const mappingPath = `mappings.${props.mappingIndex}` as const;
  const isAList = shapeKey !== 'session';
  const gapsSwitchId = `${controlIdPrefix}-workOutGapsFromLaps`;

  /** One labelled text input of an option, with its error under it. */
  function renderOptionInput(fieldPath: FieldPath<FlexSourceFormValues>, label: string) {
    const controlId = `${controlIdPrefix}-${fieldPath.replaceAll('.', '-')}`;
    const errorMessage = readErrorMessageAtPath(form.formState.errors, fieldPath);
    return (
      <FormFieldRow label={label} controlId={controlId} errorMessage={errorMessage}>
        <Input
          id={controlId}
          className="font-mono"
          {...form.register(fieldPath)}
          {...buildErrorAttributesForControl(controlId, errorMessage)}
        />
      </FormFieldRow>
    );
  }

  const scorePartHeadersPath = `${mappingPath}.scorePartHeadersText` as const;
  const scorePartHeadersId = `${controlIdPrefix}-scorePartHeadersText`;
  const scorePartHeadersError = readErrorMessageAtPath(form.formState.errors, scorePartHeadersPath);

  return (
    <div role="group" aria-label={texts.regionLabel} className="flex flex-col gap-3">
      {isAList && (
        <div className="flex flex-col gap-1">
          {renderOptionInput(`${mappingPath}.nestedEntriesPath`, texts.nestedEntriesPath)}
          <p className="text-xs text-muted-foreground">{texts.nestedEntriesPathHint}</p>
        </div>
      )}
      {isAList && (
        <FlexLookupsEditor
          form={form}
          mappingPath={mappingPath}
          requestIdsToOffer={props.requestIdsToOffer}
          controlIdPrefix={controlIdPrefix}
        />
      )}
      {isAList && (
        <div role="group" aria-label={texts.tableTitle} className="flex flex-col gap-2">
          <span className="text-sm font-medium">{texts.tableTitle}</span>
          <p className="text-xs text-muted-foreground">{texts.tableHint}</p>
          <div className="grid gap-2 md:grid-cols-3">
            {renderOptionInput(`${mappingPath}.table.columnsPath`, texts.tableFields.columnsPath)}
            {renderOptionInput(`${mappingPath}.table.headerPath`, texts.tableFields.headerPath)}
            {renderOptionInput(`${mappingPath}.table.cellsPath`, texts.tableFields.cellsPath)}
          </div>
        </div>
      )}
      {shapeKey === 'standings' && (
        <div role="group" aria-label={texts.scorePartsTitle} className="flex flex-col gap-2">
          <span className="text-sm font-medium">{texts.scorePartsTitle}</span>
          <FormFieldRow
            label={texts.scorePartHeaders}
            controlId={scorePartHeadersId}
            errorMessage={scorePartHeadersError}
          >
            <Textarea
              id={scorePartHeadersId}
              rows={4}
              {...form.register(scorePartHeadersPath)}
              {...buildErrorAttributesForControl(scorePartHeadersId, scorePartHeadersError)}
            />
          </FormFieldRow>
          {renderOptionInput(`${mappingPath}.scorePartValuePath`, texts.scorePartValuePath)}
        </div>
      )}
      {shapeKey === 'positions' && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Controller
              control={form.control}
              name={`${mappingPath}.workOutGapsFromLaps`}
              render={({ field }) => (
                <Switch id={gapsSwitchId} checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
            <Label htmlFor={gapsSwitchId}>{texts.workOutGapsFromLaps}</Label>
          </div>
          <p className="text-xs text-muted-foreground">{texts.workOutGapsFromLapsHint}</p>
        </div>
      )}
      {shapeKey === 'brackets' && (
        <FlexIncompleteConditionsEditor
          form={form}
          mappingPath={mappingPath}
          controlIdPrefix={controlIdPrefix}
        />
      )}
      <div role="group" aria-label={texts.refusalTitle} className="flex flex-col gap-2">
        <span className="text-sm font-medium">{texts.refusalTitle}</span>
        <p className="text-xs text-muted-foreground">{texts.refusalHint}</p>
        <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,2fr)]">
          {renderOptionInput(`${mappingPath}.refuseWhen.path`, texts.refusalFields.path)}
          {renderOptionInput(
            `${mappingPath}.refuseWhen.equalsText`,
            texts.refusalFields.equalsText,
          )}
          {renderOptionInput(
            `${mappingPath}.refuseWhen.notOneOfText`,
            texts.refusalFields.notOneOfText,
          )}
          {renderOptionInput(`${mappingPath}.refuseWhen.message`, texts.refusalFields.message)}
        </div>
      </div>
    </div>
  );
}
