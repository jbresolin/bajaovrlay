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
import { BindingTransformSelect, TransformParameterControl } from './BindingTransformControls';
import { BindingValueNowLine } from './BindingValueNowLine';
import type { SchemaFormBindingOptions } from './schemaFormBindingOptions';
import type { SchemaFormFieldDescription } from './schemaFormDescription';
import type { SchemaFormValues } from './schemaFormValues';

const editorTexts = ptBR.bindings.editor;
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
        <BindingTransformSelect
          form={form}
          transformName={`${bindingName}.transformId`}
          accessibleName={editorTexts.transformLabel(field.label)}
          transformIds={chosenPath.transformIdsThatFit}
          offersNoTransform={chosenPath.fitsWithoutTransform}
          onTransformChosen={chooseFirstTransform}
          isDisabled={isDisabled}
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
        <BindingTransformSelect
          form={form}
          transformName={`${bindingName}.thenTransformId`}
          accessibleName={editorTexts.thenTransformLabel(field.label)}
          transformIds={secondTransformIdsThatFit}
          offersNoTransform={true}
          isDisabled={isDisabled}
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
