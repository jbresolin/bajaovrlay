import { type MappableField, transformRegistry } from '@bajaovrlay/shared';
import { Controller, type UseFormReturn, useWatch } from 'react-hook-form';

import { Badge } from '@/components/ui/badge';
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
  type FieldRuleSourceKind,
  type FlexSourceFormValues,
  noTransformId,
} from './flexSourceFormValues';
import { readErrorMessageAtPath } from './formErrorAtPath';
import { ValueTableEditor } from './ValueTableEditor';

const texts = ptBR.dataSources.flexForm;

// "Ordem na lista" is the place of an item in its list, so only an item's field offers it.
const sourceKindsOfTopLevelFields: readonly FieldRuleSourceKind[] = [
  'none',
  'path',
  'constant',
  'pollMoment',
];
const sourceKindsOfEntryFields: readonly FieldRuleSourceKind[] = [
  'none',
  'path',
  'constant',
  'listOrder',
  'pollMoment',
];

/**
 * One canonical field's row: its label (marked when required), where its value comes
 * from, the path or fixed value, and for a path the transform from the shared registry,
 * with the value table under it when the transform is "Tabela de valores" (mapValues).
 * The controls are named after the field ("Caminho de Equipe"), so every row is told
 * apart by ear and by a test.
 */
export function FlexFieldRuleRow(props: {
  form: UseFormReturn<FlexSourceFormValues>;
  field: MappableField;
  rowPath: `mappings.${number}.fieldRules.${number}`;
  controlIdPrefix: string;
}) {
  const { form, field, rowPath, controlIdPrefix } = props;
  const sourceKind = useWatch({ control: form.control, name: `${rowPath}.sourceKind` });
  const transformId = useWatch({ control: form.control, name: `${rowPath}.transformId` });
  const errors = form.formState.errors;
  const textError = readErrorMessageAtPath(errors, `${rowPath}.pathOrConstantText`);
  const transformError = readErrorMessageAtPath(errors, `${rowPath}.transformId`);
  const textControlId = `${controlIdPrefix}-text`;
  const transformControlId = `${controlIdPrefix}-transform`;

  const sourceKindsOffered =
    field.level === 'entry' ? sourceKindsOfEntryFields : sourceKindsOfTopLevelFields;
  const hasText = sourceKind === 'path' || sourceKind === 'constant';
  const isReadByPath = sourceKind === 'path';

  return (
    <div className="flex flex-col gap-1 border-t border-border pt-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex w-full items-center gap-2 text-sm md:w-48">
          {field.label}
          {field.isRequired && <Badge variant="secondary">{texts.requiredMark}</Badge>}
        </span>
        <Controller
          control={form.control}
          name={`${rowPath}.sourceKind`}
          render={({ field: sourceKindField }) => (
            <Select value={sourceKindField.value} onValueChange={sourceKindField.onChange}>
              <SelectTrigger aria-label={texts.fieldRule.sourceKind(field.label)} className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sourceKindsOffered.map((kind) => (
                  <SelectItem key={kind} value={kind}>
                    {texts.fieldRule.sourceKinds[kind]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {hasText && (
          <Input
            aria-label={
              isReadByPath
                ? texts.fieldRule.path(field.label)
                : texts.fieldRule.constant(field.label)
            }
            className="min-w-40 flex-1 font-mono"
            {...form.register(`${rowPath}.pathOrConstantText`)}
            {...buildErrorAttributesForControl(textControlId, textError)}
          />
        )}
        {isReadByPath && (
          <Controller
            control={form.control}
            name={`${rowPath}.transformId`}
            render={({ field: transformField }) => (
              <Select value={transformField.value} onValueChange={transformField.onChange}>
                <SelectTrigger
                  aria-label={texts.fieldRule.transform(field.label)}
                  className="w-56"
                  {...buildErrorAttributesForControl(transformControlId, transformError)}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={noTransformId}>{texts.fieldRule.noTransform}</SelectItem>
                  {transformRegistry.map((transform) => (
                    <SelectItem key={transform.id} value={transform.id}>
                      {transform.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        )}
      </div>
      {hasText && textError !== undefined && (
        <p id={`${textControlId}-error`} className="text-sm text-destructive">
          {textError}
        </p>
      )}
      {sourceKind === 'constant' && (
        <p className="text-xs text-muted-foreground">{texts.typedValueHint}</p>
      )}
      {isReadByPath && transformError !== undefined && (
        <p id={`${transformControlId}-error`} className="text-sm text-destructive">
          {transformError}
        </p>
      )}
      {isReadByPath && transformId === 'mapValues' && (
        <ValueTableEditor form={form} rowPath={rowPath} fieldLabel={field.label} />
      )}
    </div>
  );
}
