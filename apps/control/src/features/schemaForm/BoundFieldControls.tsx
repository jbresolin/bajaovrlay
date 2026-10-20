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

import { listBindingPathChoicesOfField, readBindingPathKey } from './bindingChoices';
import {
  emptySchemaFormBindingValue,
  parameterOfEachBindingTransform,
  readBindingFromSchemaFormValue,
} from './bindingFormValue';
import { describeBindingValueNow } from './bindingValueNowText';
import type { SchemaFormFieldDescription } from './schemaFormDescription';
import type { SchemaFormValues } from './schemaFormValues';

/**
 * What a panel hands the generated form so its fields can read a data source: the
 * sources to offer, and how to read a binding against the page's slices now (the shared
 * resolveBindingAgainstSources, for the "Valor agora" line). Only the item editor hands
 * it; without it no field offers "Fonte".
 */
export type SchemaFormBindingOptions = {
  dataSources: Array<{ id: string; label: string }>;
  readValueNow: (binding: BindingFieldValue) => BindingResolution;
};

const editorTexts = ptBR.bindings.editor;
// The dropdown's value for "no transform": a Select cannot hold the empty text.
const noTransformValue = 'nenhuma';

/**
 * The controls of a field set to "Fonte" (or "Relógio da fonte", `isWholeClock`): the
 * source, what to read (the paths that fit the field, a car number for a car chosen by
 * number), "Ao vivo / Congelado na entrada", the transform and its one parameter, and
 * the line saying what the field would get now. Everything lives in react-hook-form under
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

  // What the field would get now, once the choices make a binding the field can take.
  const bindingRead = readBindingFromSchemaFormValue(field, bindingValue, dataSchema, isWholeClock);
  const valueNowText =
    bindingRead.status === 'binding'
      ? describeBindingValueNow(bindingOptions.readValueNow(bindingRead.binding))
      : editorTexts.chooseToSeeTheValue;

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
                transformField.onChange(choice === noTransformValue ? '' : choice)
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
          bindingName={bindingName}
          controlId={`${controlId}-transform-parameter`}
          fieldLabel={field.label}
          transformId={bindingValue.transformId}
          isWholeNumber={parameterOfTheTransform.isWholeNumber}
          isDisabled={isDisabled}
        />
      )}

      <p className="text-xs text-muted-foreground">{valueNowText}</p>
    </div>
  );
}

/** The one parameter of the chosen transform: digits, or formatGapAsText's unit. */
function TransformParameterControl(props: {
  form: UseFormReturn<SchemaFormValues>;
  bindingName: `bindings.${string}`;
  controlId: string;
  fieldLabel: string;
  transformId: string;
  isWholeNumber: boolean;
  isDisabled: boolean;
}) {
  const { form, bindingName, controlId, fieldLabel, transformId, isWholeNumber, isDisabled } =
    props;
  const parameterName = editorTexts.transformParameterNames[transformId] ?? transformId;
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={controlId}>{parameterName}</Label>
      {isWholeNumber ? (
        <Input
          id={controlId}
          inputMode="numeric"
          autoComplete="off"
          aria-label={editorTexts.transformParameterLabel(fieldLabel)}
          disabled={isDisabled}
          {...form.register(`${bindingName}.transformParameterText`)}
        />
      ) : (
        <Controller
          control={form.control}
          name={`${bindingName}.transformParameterText`}
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
                aria-label={editorTexts.transformParameterLabel(fieldLabel)}
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
