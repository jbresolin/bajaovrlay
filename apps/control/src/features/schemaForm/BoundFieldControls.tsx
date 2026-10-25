import { type BindingFieldValue, type BindingResolution, findTransform } from '@bajaovrlay/shared';
import { Controller, type UseFormReturn, useWatch } from 'react-hook-form';

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

import {
  listBindingPathChoicesOfField,
  listSecondTransformIdsThatFit,
  readBindingPathKey,
} from './bindingChoices';
import {
  emptySchemaFormBindingValue,
  parameterOfEachBindingTransform,
  readBindingFromSchemaFormValue,
} from './bindingFormValue';
import { BindingValueNowLine } from './BindingValueNowLine';
import type { SchemaFormFieldDescription } from './schemaFormDescription';
import type { SchemaFormValues } from './schemaFormValues';

/**
 * What a panel hands the generated form so its fields can read a data source: the
 * sources to offer, how to read a binding against the page's slices now (the shared
 * resolveBindingAgainstSources, for the "Valor agora" line), and how to be told when
 * what it reads may have changed. Only the item editor hands it; without it no field
 * offers "Fonte".
 */
export type SchemaFormBindingOptions = {
  /** The sources the "Fonte de …" dropdown lists. */
  dataSources: Array<{ id: string; label: string }>;
  /** Reads a binding against the page's slices as they are at the moment of the call. */
  readValueNow: (binding: BindingFieldValue) => BindingResolution;
  /**
   * Calls `onValuesChanged` after every change that may change what readValueNow reads (a
   * poll, a correction, a team), and returns the way to stop. Only "Valor agora" listens
   * (BindingValueNowLine.tsx), so a poll redraws that line and nothing else.
   */
  subscribeToValuesNow: (onValuesChanged: () => void) => () => void;
};

const editorTexts = ptBR.bindings.editor;
// The dropdown's value for "no transform": a Select cannot hold the empty text.
const noTransformValue = 'nenhuma';

/**
 * The controls of a field set to "Fonte" (or "Relógio da fonte", `isWholeClock`): the
 * source, what to read (the paths that fit the field, a car number for a car chosen by
 * number), "Ao vivo / Congelado na entrada", the transform and its one parameter, a
 * second transform once a first is chosen (BAJAOVRLAY-47) with its parameter, and the line
 * saying what the field would get now. Everything lives in react-hook-form under
 * `bindings.<key>`; choosing a path that only fits through a transform picks the first
 * such transform, so the form never holds a binding the field cannot take.
 * The whole clock reads the session clock whole, so it has no path and no transform.
 */
export function BoundFieldControls(props: {
  form: UseFormReturn<SchemaFormValues>;
  field: SchemaFormFieldDescription;
  dataSchema: unknown;
  controlId: string;
  isWholeClock: boolean;
  bindingOptions: SchemaFormBindingOptions;
  isDisabled: boolean;
}) {
  const { form, field, dataSchema, controlId, isWholeClock, bindingOptions, isDisabled } = props;
  const bindingName = `bindings.${field.key}` as const;
  const bindingValue =
    useWatch({ control: form.control, name: bindingName }) ?? emptySchemaFormBindingValue;
  const pathChoices = isWholeClock ? [] : listBindingPathChoicesOfField(dataSchema, field.key);
  const chosenPath = pathChoices.find((choice) => choice.pathKey === bindingValue.pathKey);
  const chosenShapeAndPath = readBindingPathKey(bindingValue.pathKey);
  const isCarChosenByNumber = chosenShapeAndPath?.path.startsWith('entryOfCar.') ?? false;
  const parameterOfTheTransform = parameterOfEachBindingTransform[bindingValue.transformId];
  // The second transform is offered once a first is chosen and something can follow it.
  const secondTransformIdsThatFit =
    chosenPath === undefined || bindingValue.transformId === ''
      ? []
      : listSecondTransformIdsThatFit(
          dataSchema,
          field.key,
          chosenPath.valueType,
          bindingValue.transformId,
        );
  const parameterOfTheSecondTransform =
    parameterOfEachBindingTransform[bindingValue.thenTransformId];

  // What the field would get now, once the choices make a binding the field can take.
  const bindingRead = readBindingFromSchemaFormValue(field, bindingValue, dataSchema, isWholeClock);

  /** Chooses a path, and a transform that makes it fit when it fits through one only. */
  function choosePath(pathKey: string): void {
    form.setValue(`${bindingName}.pathKey`, pathKey, { shouldDirty: true });
    const newChoice = pathChoices.find((choice) => choice.pathKey === pathKey);
    const isTransformStillFitting =
      newChoice?.transformIdsThatFit.includes(bindingValue.transformId) ?? false;
    const transformToKeep = isTransformStillFitting ? bindingValue.transformId : '';
    const transformAfter =
      newChoice !== undefined && !newChoice.fitsWithoutTransform && transformToKeep === ''
        ? (newChoice.transformIdsThatFit[0] ?? '')
        : transformToKeep;
    form.setValue(`${bindingName}.transformId`, transformAfter, { shouldDirty: true });
    // What may follow depends on the path and the first transform, so a new path starts
    // with no second one.
    clearSecondTransform();
  }

  /**
   * Chooses the first transform. Any change of it clears the second transform and its
   * parameter: what may follow depends on the first, and a second left from before would
   * be hidden from the operator yet saved (gate 2 of PR #27).
   */
  function chooseFirstTransform(transformId: string): void {
    const isChange = transformId !== bindingValue.transformId;
    form.setValue(`${bindingName}.transformId`, transformId, { shouldDirty: true });
    if (isChange) {
      clearSecondTransform();
    }
  }

  /** Takes the second transform and its parameter off the field's choices. */
  function clearSecondTransform(): void {
    form.setValue(`${bindingName}.thenTransformId`, '', { shouldDirty: true });
    form.setValue(`${bindingName}.thenTransformParameterText`, '', { shouldDirty: true });
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-2">
      {bindingOptions.dataSources.length === 0 ? (
        <p className="text-sm text-muted-foreground">{editorTexts.noSourceYet}</p>
      ) : (
        <Controller
          control={form.control}
          name={`${bindingName}.sourceId`}
          render={({ field: sourceField }) => (
            <Select
              value={sourceField.value}
              onValueChange={sourceField.onChange}
              disabled={isDisabled}
            >
              <SelectTrigger
                id={controlId}
                size="sm"
                className="w-full"
                aria-label={editorTexts.sourceLabel(field.label)}
              >
                <SelectValue placeholder={ptBR.schemaForm.nothingChosenPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {bindingOptions.dataSources.map((dataSource) => (
                  <SelectItem key={dataSource.id} value={dataSource.id}>
                    {dataSource.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      )}

      {!isWholeClock && (
        <Select value={bindingValue.pathKey} onValueChange={choosePath} disabled={isDisabled}>
          <SelectTrigger
            size="sm"
            className="w-full"
            aria-label={editorTexts.pathLabel(field.label)}
          >
            <SelectValue placeholder={ptBR.schemaForm.nothingChosenPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            {pathChoices.map((choice) => (
              <SelectItem key={choice.pathKey} value={choice.pathKey}>
                {choice.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {isCarChosenByNumber && (
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${controlId}-car-number`}>
            {editorTexts.carNumberLabel(field.label)}
          </Label>
          <Input
            id={`${controlId}-car-number`}
            inputMode="numeric"
            autoComplete="off"
            disabled={isDisabled}
            {...form.register(`${bindingName}.carNumberText`)}
          />
        </div>
      )}

      <Controller
        control={form.control}
        name={`${bindingName}.isLive`}
        render={({ field: whenField }) => (
          <Select
            value={whenField.value ? 'live' : 'frozen'}
            onValueChange={(choice) => whenField.onChange(choice === 'live')}
            disabled={isDisabled}
          >
            <SelectTrigger
              size="sm"
              className="w-full"
              aria-label={editorTexts.whenLabel(field.label)}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="live">{editorTexts.whenOptions.live}</SelectItem>
              <SelectItem value="frozen">{editorTexts.whenOptions.frozen}</SelectItem>
            </SelectContent>
          </Select>
        )}
      />

      {chosenPath !== undefined && chosenPath.transformIdsThatFit.length > 0 && (
        <Controller
          control={form.control}
          name={`${bindingName}.transformId`}
          render={({ field: transformField }) => (
            <Select
              value={transformField.value === '' ? noTransformValue : transformField.value}
              onValueChange={(choice) =>
                chooseFirstTransform(choice === noTransformValue ? '' : choice)
              }
              disabled={isDisabled}
            >
              <SelectTrigger
                size="sm"
                className="w-full"
                aria-label={editorTexts.transformLabel(field.label)}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {chosenPath.fitsWithoutTransform && (
                  <SelectItem value={noTransformValue}>{editorTexts.noTransform}</SelectItem>
                )}
                {chosenPath.transformIdsThatFit.map((transformId) => (
                  <SelectItem key={transformId} value={transformId}>
                    {findTransform(transformId)?.label ?? transformId}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      )}

      {parameterOfTheTransform !== undefined && (
        <TransformParameterControl
          form={form}
          parameterTextName={`${bindingName}.transformParameterText`}
          controlId={`${controlId}-transform-parameter`}
          accessibleName={editorTexts.transformParameterLabel(field.label)}
          transformId={bindingValue.transformId}
          isWholeNumber={parameterOfTheTransform.isWholeNumber}
          isDisabled={isDisabled}
        />
      )}

      {secondTransformIdsThatFit.length > 0 && (
        <Controller
          control={form.control}
          name={`${bindingName}.thenTransformId`}
          render={({ field: secondTransformField }) => (
            <Select
              value={
                secondTransformField.value === '' ? noTransformValue : secondTransformField.value
              }
              onValueChange={(choice) =>
                secondTransformField.onChange(choice === noTransformValue ? '' : choice)
              }
              disabled={isDisabled}
            >
              <SelectTrigger
                size="sm"
                className="w-full"
                aria-label={editorTexts.thenTransformLabel(field.label)}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={noTransformValue}>{editorTexts.noTransform}</SelectItem>
                {secondTransformIdsThatFit.map((transformId) => (
                  <SelectItem key={transformId} value={transformId}>
                    {findTransform(transformId)?.label ?? transformId}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      )}

      {secondTransformIdsThatFit.length > 0 && parameterOfTheSecondTransform !== undefined && (
        <TransformParameterControl
          form={form}
          parameterTextName={`${bindingName}.thenTransformParameterText`}
          controlId={`${controlId}-then-transform-parameter`}
          accessibleName={editorTexts.thenTransformParameterLabel(field.label)}
          transformId={bindingValue.thenTransformId}
          isWholeNumber={parameterOfTheSecondTransform.isWholeNumber}
          isDisabled={isDisabled}
        />
      )}

      {bindingRead.status === 'binding' ? (
        <BindingValueNowLine binding={bindingRead.binding} bindingOptions={bindingOptions} />
      ) : (
        <p className="text-xs text-muted-foreground">{editorTexts.chooseToSeeTheValue}</p>
      )}
    </div>
  );
}

/**
 * The one parameter of a chosen transform (the first or the second, by `parameterTextName`):
 * digits, or formatGapAsText's unit.
 */
function TransformParameterControl(props: {
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
