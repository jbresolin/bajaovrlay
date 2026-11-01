import { useFieldArray, type UseFormReturn } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { buildErrorAttributesForControl } from '@/features/items/FormFieldRow';
import { ptBR } from '@/i18n/ptBR';

import { buildEmptyIncompleteConditionFormValues } from './flexMappingOptionsFormValues';
import type { FlexSourceFormValues } from './flexSourceFormValues';
import { readErrorMessageAtPath } from './formErrorAtPath';

const texts = ptBR.dataSources.flexForm.mappingOptions;

/**
 * "Disputa incompleta quando", on the brackets block (BAJAOVRLAY-53): each condition a path
 * on a match and the values that mark it incomplete, typed and separated by commas
 * ("pending, unknown"). A round holding an incomplete match is left out, with the rounds
 * after it. "+ Condição" adds an empty one.
 */
export function FlexIncompleteConditionsEditor(props: {
  form: UseFormReturn<FlexSourceFormValues>;
  mappingPath: `mappings.${number}`;
  controlIdPrefix: string;
}) {
  const { form, mappingPath } = props;
  const conditions = useFieldArray({
    control: form.control,
    name: `${mappingPath}.incompleteConditions`,
  });
  const errors = form.formState.errors;

  return (
    <div role="group" aria-label={texts.incompleteTitle} className="flex flex-col gap-2">
      <span className="text-sm font-medium">{texts.incompleteTitle}</span>
      <p className="text-xs text-muted-foreground">{texts.incompleteHint}</p>
      {conditions.fields.map((conditionField, conditionIndex) => {
        const conditionNumber = conditionIndex + 1;
        const conditionPath = `${mappingPath}.incompleteConditions.${conditionIndex}` as const;
        const idPrefix = `${props.controlIdPrefix}-incompleteConditions-${conditionIndex}`;
        const pathError = readErrorMessageAtPath(errors, `${conditionPath}.path`);
        const valuesError = readErrorMessageAtPath(errors, `${conditionPath}.valuesText`);
        return (
          <div
            key={conditionField.id}
            role="group"
            aria-label={texts.incompleteRegionLabel(conditionNumber)}
            className="flex flex-wrap items-center gap-2"
          >
            <Input
              aria-label={texts.incompleteFields.path(conditionNumber)}
              className="w-48 font-mono"
              {...form.register(`${conditionPath}.path`)}
              {...buildErrorAttributesForControl(`${idPrefix}-path`, pathError)}
            />
            <Input
              aria-label={texts.incompleteFields.valuesText(conditionNumber)}
              className="min-w-40 flex-1 font-mono"
              {...form.register(`${conditionPath}.valuesText`)}
              {...buildErrorAttributesForControl(`${idPrefix}-valuesText`, valuesError)}
            />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => conditions.remove(conditionIndex)}
            >
              {texts.removeIncompleteConditionButton(conditionNumber)}
            </Button>
            {pathError !== undefined && (
              <p id={`${idPrefix}-path-error`} className="w-full text-sm text-destructive">
                {pathError}
              </p>
            )}
            {valuesError !== undefined && (
              <p id={`${idPrefix}-valuesText-error`} className="w-full text-sm text-destructive">
                {valuesError}
              </p>
            )}
          </div>
        );
      })}
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="self-start"
        onClick={() => conditions.append(buildEmptyIncompleteConditionFormValues())}
      >
        {texts.addIncompleteConditionButton}
      </Button>
    </div>
  );
}
