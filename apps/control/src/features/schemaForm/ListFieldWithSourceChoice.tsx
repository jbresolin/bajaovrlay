import type { EntityLibrary } from '@bajaovrlay/shared';
import { Controller, type UseFormReturn, useFormState, useWatch } from 'react-hook-form';

import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ptBR } from '@/i18n/ptBR';

import { canFieldBeBoundToASource } from './bindingChoices';
import { emptySchemaFormBindingValue } from './bindingFormValue';
import { BoundFieldControls } from './BoundFieldControls';
import { EntityListControls } from './EntityListControls';
import { canFieldReadAnEntityList } from './entityListFormValue';
import type { SchemaFormBindingOptions } from './schemaFormBindingOptions';
import type { SchemaFormFieldDescription } from './schemaFormDescription';
import type { SchemaFormFieldKind, SchemaFormValues } from './schemaFormValues';
import { UnsupportedValueBox } from './UnsupportedValueBox';

/** The kinds a list field may be read with: as it is, from a source, or from Cadastros. */
type ListFieldKind = Extract<SchemaFormFieldKind, 'literal' | 'binding' | 'entityList'>;

/**
 * Whether a list field offers a choice at all: "Fonte" where the panel handed binding
 * options and a source's list fits it, "Lista dos cadastros" where it handed the library
 * and a list of Cadastros fits it (BAJAOVRLAY-46).
 */
export function doesListFieldOfferAChoice(
  dataSchema: unknown,
  fieldKey: string,
  bindingOptions: SchemaFormBindingOptions | undefined,
  entityLibrary: EntityLibrary | undefined,
): boolean {
  const offersASource =
    bindingOptions !== undefined && canFieldBeBoundToASource(dataSchema, fieldKey);
  const offersAList = entityLibrary !== undefined && canFieldReadAnEntityList(dataSchema, fieldKey);
  return offersASource || offersAList;
}

/**
 * A field the form cannot edit (a list, such as a tower's cars or a roll's sponsors) that
 * may still read a source or Cadastros: "Valor como está" keeps the read-only box (the
 * value goes on as it was), "Fonte" draws the binding controls, and "Lista dos cadastros"
 * the list's controls. The kind lives under `kinds.<key>`, absent for "as it is", so a
 * form that never offered this keeps exactly the values it always had.
 */
export function ListFieldWithSourceChoice(props: {
  form: UseFormReturn<SchemaFormValues>;
  field: SchemaFormFieldDescription;
  dataSchema: unknown;
  controlId: string;
  keptJsonText: string | undefined;
  /** What a list may read from a source; undefined: no "Fonte". */
  bindingOptions: SchemaFormBindingOptions | undefined;
  /** The entity library; undefined: no "Lista dos cadastros". */
  entityLibrary: EntityLibrary | undefined;
  isDisabled: boolean;
}) {
  const { form, field, dataSchema, controlId, keptJsonText, bindingOptions, isDisabled } = props;
  const { entityLibrary } = props;
  const chosenKind = useWatch({ control: form.control, name: `kinds.${field.key}` });
  // This field's errors only, by name; `form.formState` would subscribe the whole form.
  const stateOfThisField = useFormState({ control: form.control, name: `values.${field.key}` });
  const errorMessage = stateOfThisField.errors.values?.[field.key]?.message;

  const kindsOffered: ListFieldKind[] = ['literal'];
  if (bindingOptions !== undefined && canFieldBeBoundToASource(dataSchema, field.key)) {
    kindsOffered.push('binding');
  }
  if (entityLibrary !== undefined && canFieldReadAnEntityList(dataSchema, field.key)) {
    kindsOffered.push('entityList');
  }
  const kindShown: ListFieldKind =
    chosenKind === 'binding' || chosenKind === 'entityList' ? chosenKind : 'literal';
  const isReadFromASource = kindShown === 'binding' && bindingOptions !== undefined;
  const isReadFromTheLibrary = kindShown === 'entityList' && entityLibrary !== undefined;

  /** Switches the kind, giving the field its empty "Fonte" the first time it is chosen. */
  function chooseKind(kind: string): void {
    if (kind === 'binding' && form.getValues(`bindings.${field.key}`) === undefined) {
      form.setValue(`bindings.${field.key}`, emptySchemaFormBindingValue);
    }
    const kindChosen = kindsOffered.find((kindOffered) => kindOffered === kind) ?? 'literal';
    form.setValue(`kinds.${field.key}`, kindChosen, { shouldDirty: true });
  }

  /** The label of each kind in the selector: "as it is" reads differently for a list. */
  function labelOfKind(kind: ListFieldKind): string {
    return kind === 'literal' ? ptBR.schemaForm.listKindAsItIs : ptBR.schemaForm.kindLabels[kind];
  }

  return (
    <div className="flex flex-col gap-2">
      <Controller
        control={form.control}
        name={`kinds.${field.key}`}
        render={() => (
          <Select value={kindShown} onValueChange={chooseKind} disabled={isDisabled}>
            <SelectTrigger
              size="sm"
              className="w-full"
              aria-label={ptBR.schemaForm.kindSelectorLabel(field.label)}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {kindsOffered.map((kind) => (
                <SelectItem key={kind} value={kind}>
                  {labelOfKind(kind)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
      {isReadFromASource && (
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
      )}
      {isReadFromTheLibrary && (
        <>
          <Label htmlFor={controlId}>{field.label}</Label>
          <EntityListControls
            form={form}
            field={field}
            dataSchema={dataSchema}
            controlId={controlId}
            entityLibrary={entityLibrary}
            isDisabled={isDisabled}
          />
        </>
      )}
      {!isReadFromASource && !isReadFromTheLibrary && (
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
