import { listTransformsOfFamily, type MappableField } from '@bajaovrlay/shared';
import { Controller, type UseFormReturn, useWatch } from 'react-hook-form';

import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { buildErrorAttributesForControl } from '@/features/items/FormFieldRow';
import { ptBR } from '@/i18n/ptBR';

import { FlexAlternativesEditor } from './FlexAlternativesEditor';
import { type FieldRuleSourceKind, noTransformId } from './flexFieldRuleFormValues';
import { FlexReadingControls } from './FlexReadingControls';
import type { FlexSourceFormValues } from './flexSourceFormValues';
import { readErrorMessageAtPath } from './formErrorAtPath';
import { ValueTableEditor } from './ValueTableEditor';

const texts = ptBR.dataSources.flexForm;

// Only the mapping family: a binding transform formats canonical data for the screen and
// belongs to an item field (BAJAOVRLAY-20); the config schema refuses one here anyway.
const mappingTransforms = listTransformsOfFamily('mapping');

// "Ordem na lista", "Item de fora", "Consulta" and "Coluna" read an item of a list, so
// only an item's field offers them; "Alternativas" (paths and fixed values) both.
const sourceKindsOfTopLevelFields: readonly FieldRuleSourceKind[] = [
  'none',
  'path',
  'constant',
  'pollMoment',
  'alternatives',
];
const sourceKindsOfEntryFields: readonly FieldRuleSourceKind[] = [
  'none',
  'path',
  'constant',
  'listOrder',
  'pollMoment',
  'parent',
  'lookup',
  'column',
  'alternatives',
];

/** The kinds whose value is read from the data, which a transform may work on. */
const sourceKindsThatReadTheData: ReadonlySet<FieldRuleSourceKind> = new Set([
  'path',
  'parent',
  'lookup',
  'column',
  'alternatives',
]);

/**
 * One canonical field's row: its label (marked when required), where its value comes
 * from, that reading's controls (FlexReadingControls) or the alternatives
 * (FlexAlternativesEditor), and for a value read the transform from the shared registry,
 * with the value table under it when the transform is "Tabela de valores" (mapValues).
 * The controls are named after the field ("Caminho de Equipe"), so every row is told
 * apart by ear and by a test.
 */
export function FlexFieldRuleRow(props: {
  form: UseFormReturn<FlexSourceFormValues>;
  field: MappableField;
  rowPath: `mappings.${number}.fieldRules.${number}`;
  lookupNamesToOffer: string[];
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
  const isOneReading =
    sourceKind === 'path' ||
    sourceKind === 'constant' ||
    sourceKind === 'parent' ||
    sourceKind === 'lookup' ||
    sourceKind === 'column';
  const readsTheData = sourceKindsThatReadTheData.has(sourceKind);
  // What is about the whole rule (one source, two alternatives) lands at the path field,
  // which alternatives and the kinds without text do not draw: it is shown here instead.
  const isRuleErrorWithoutItsInput = !isOneReading && textError !== undefined;

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
        {isOneReading && (
          <FlexReadingControls
            form={form}
            readingPath={rowPath}
            sourceKind={sourceKind}
            lookupNamesToOffer={props.lookupNamesToOffer}
            controlIdPrefix={controlIdPrefix}
            labels={{
              path:
                sourceKind === 'parent'
                  ? texts.fieldRule.parentPath(field.label)
                  : texts.fieldRule.path(field.label),
              constant: texts.fieldRule.constant(field.label),
              lookupName: texts.fieldRule.lookupName(field.label),
              lookupPath: texts.fieldRule.lookupPath(field.label),
              columnHeader: texts.fieldRule.columnHeader(field.label),
              columnPath: texts.fieldRule.columnPath(field.label),
            }}
          />
        )}
        {readsTheData && (
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
                  {mappingTransforms.map((transform) => (
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
      {isRuleErrorWithoutItsInput && (
        <p id={`${textControlId}-error`} className="text-sm text-destructive">
          {textError}
        </p>
      )}
      {sourceKind === 'constant' && (
        <p className="text-xs text-muted-foreground">{texts.typedValueHint}</p>
      )}
      {readsTheData && transformError !== undefined && (
        <p id={`${transformControlId}-error`} className="text-sm text-destructive">
          {transformError}
        </p>
      )}
      {sourceKind === 'alternatives' && (
        <FlexAlternativesEditor
          form={form}
          rowPath={rowPath}
          fieldLabel={field.label}
          level={field.level}
          lookupNamesToOffer={props.lookupNamesToOffer}
          controlIdPrefix={controlIdPrefix}
        />
      )}
      {readsTheData && transformId === 'mapValues' && (
        <ValueTableEditor form={form} rowPath={rowPath} fieldLabel={field.label} />
      )}
    </div>
  );
}
