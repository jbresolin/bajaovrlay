import { findTransform } from '@bajaovrlay/shared';
import { Controller, type UseFormReturn } from 'react-hook-form';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ptBR } from '@/i18n/ptBR';

import type { SchemaFormValues } from './schemaFormValues';

const editorTexts = ptBR.bindings.editor;
// The dropdown's value for "no transform": a Select cannot hold the empty text.
const noTransformValue = 'nenhuma';

/**
 * A transform dropdown of a field set to "Fonte": the first transform or the second
 * (BAJAOVRLAY-47), by `transformName`. It lists the transforms given, by their pt-BR
 * labels, and "Nenhuma" first when the value may go without one ("Nenhuma" is held as the
 * empty text). A choice goes to `onTransformChosen` when given, which decides what else it
 * changes (a new first transform clears the second, BoundFieldControls.tsx); left out,
 * the choice is stored as react-hook-form's own change, checked like any field's.
 */
export function BindingTransformSelect(props: {
  form: UseFormReturn<SchemaFormValues>;
  transformName: `bindings.${string}.transformId` | `bindings.${string}.thenTransformId`;
  accessibleName: string;
  transformIds: string[];
  /** Whether "Nenhuma" is offered: the path fits without a transform, or this is the second. */
  offersNoTransform: boolean;
  onTransformChosen?: (transformId: string) => void;
  isDisabled: boolean;
}) {
  const { form, transformName, accessibleName, transformIds, offersNoTransform } = props;
  const { onTransformChosen, isDisabled } = props;
  return (
    <Controller
      control={form.control}
      name={transformName}
      render={({ field: transformField }) => (
        <Select
          value={transformField.value === '' ? noTransformValue : transformField.value}
          onValueChange={(choice) => {
            const transformId = choice === noTransformValue ? '' : choice;
            if (onTransformChosen === undefined) {
              transformField.onChange(transformId);
            } else {
              onTransformChosen(transformId);
            }
          }}
          disabled={isDisabled}
        >
          <SelectTrigger size="sm" className="w-full" aria-label={accessibleName}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {offersNoTransform && (
              <SelectItem value={noTransformValue}>{editorTexts.noTransform}</SelectItem>
            )}
            {transformIds.map((transformId) => (
              <SelectItem key={transformId} value={transformId}>
                {findTransform(transformId)?.label ?? transformId}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    />
  );
}

/**
 * The one parameter of a chosen transform (the first or the second, by `parameterTextName`):
 * digits, or formatGapAsText's unit.
 */
export function TransformParameterControl(props: {
  form: UseFormReturn<SchemaFormValues>;
  parameterTextName:
    `bindings.${string}.transformParameterText` | `bindings.${string}.thenTransformParameterText`;
  controlId: string;
  accessibleName: string;
  transformId: string;
  isWholeNumber: boolean;
  isDisabled: boolean;
}) {
  const { form, parameterTextName, controlId, accessibleName, transformId } = props;
  const { isWholeNumber, isDisabled } = props;
  const parameterName = editorTexts.transformParameterNames[transformId] ?? transformId;
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={controlId}>{parameterName}</Label>
      {isWholeNumber ? (
        <Input
          id={controlId}
          inputMode="numeric"
          autoComplete="off"
          aria-label={accessibleName}
          disabled={isDisabled}
          {...form.register(parameterTextName)}
        />
      ) : (
        <Controller
          control={form.control}
          name={parameterTextName}
          render={({ field: unitField }) => (
            <Select
              value={unitField.value}
              onValueChange={unitField.onChange}
              disabled={isDisabled}
            >
              <SelectTrigger
                id={controlId}
                size="sm"
                className="w-full"
                aria-label={accessibleName}
              >
                <SelectValue placeholder={ptBR.schemaForm.nothingChosenPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(editorTexts.gapUnitOptions).map(([unit, unitLabel]) => (
                  <SelectItem key={unit} value={unit}>
                    {unitLabel}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      )}
    </div>
  );
}
