import { Controller, type UseFormReturn, useWatch } from 'react-hook-form';

import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ptBR } from '@/i18n/ptBR';

import { emptySchemaFormBindingValue } from './bindingFormValue';
import { BoundFieldControls, type SchemaFormBindingOptions } from './BoundFieldControls';
import type { SchemaFormFieldDescription } from './schemaFormDescription';
import type { SchemaFormValues } from './schemaFormValues';
import { UnsupportedValueBox } from './UnsupportedValueBox';

/**
 * A field the form cannot edit (a list, such as a tower's cars) that may still read a
 * source: "Valor como está" keeps the read-only box (the value goes on as it was), and
 * "Fonte" draws the binding controls. The kind lives under `kinds.<key>`, absent for
 * "as it is", so a form that never offered this keeps exactly the values it always had.
 */
export function ListFieldWithSourceChoice(props: {
  form: UseFormReturn<SchemaFormValues>;
  field: SchemaFormFieldDescription;
  dataSchema: unknown;
  controlId: string;
  keptJsonText: string | undefined;
  bindingOptions: SchemaFormBindingOptions;
  isDisabled: boolean;
}) {
  const { form, field, dataSchema, controlId, keptJsonText, bindingOptions, isDisabled } = props;
  const chosenKind = useWatch({ control: form.control, name: `kinds.${field.key}` });
  const isReadFromASource = chosenKind === 'binding';
  const errorMessage = form.formState.errors.values?.[field.key]?.message;

  /** Switches the kind, giving the field its empty "Fonte" the first time it is chosen. */
  function chooseKind(kind: string): void {
    if (kind === 'binding' && form.getValues(`bindings.${field.key}`) === undefined) {
      form.setValue(`bindings.${field.key}`, emptySchemaFormBindingValue);
    }
    form.setValue(`kinds.${field.key}`, kind === 'binding' ? 'binding' : 'literal', {
      shouldDirty: true,
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Controller
        control={form.control}
        name={`kinds.${field.key}`}
        render={() => (
          <Select
            value={isReadFromASource ? 'binding' : 'literal'}
            onValueChange={chooseKind}
            disabled={isDisabled}
          >
            <SelectTrigger
              size="sm"
              className="w-full"
              aria-label={ptBR.schemaForm.kindSelectorLabel(field.label)}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="literal">{ptBR.schemaForm.listKindAsItIs}</SelectItem>
              <SelectItem value="binding">{ptBR.schemaForm.kindLabels.binding}</SelectItem>
            </SelectContent>
          </Select>
        )}
      />
      {isReadFromASource ? (
        <>
          <Label htmlFor={controlId}>{field.label}</Label>
          <BoundFieldControls
            form={form}
            field={field}
            dataSchema={dataSchema}
            controlId={controlId}
            isWholeClock={false}
            bindingOptions={bindingOptions}
            isDisabled={isDisabled}
          />
          {errorMessage !== undefined && <p className="text-sm text-destructive">{errorMessage}</p>}
        </>
      ) : (
        <UnsupportedValueBox
          controlId={controlId}
          label={field.label}
          note={
            keptJsonText === undefined
              ? ptBR.schemaForm.unsupportedPropertyWithoutValueNote
              : ptBR.schemaForm.unsupportedPropertyNote
          }
          jsonText={keptJsonText}
        />
      )}
    </div>
  );
}
