import type { EntityLibrary } from '@bajaovrlay/shared';
import { Controller, type UseFormReturn, useWatch } from 'react-hook-form';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ptBR } from '@/i18n/ptBR';

import {
  listEntityListTypesOfferedToField,
  readEntityListOfFormField,
  writeEntityListValueNowText,
} from './entityListFormValue';
import type { SchemaFormFieldDescription } from './schemaFormDescription';
import type { SchemaFormValues } from './schemaFormValues';

const texts = ptBR.entityLibrary.editor;

/**
 * The controls of a list field set to "Lista dos cadastros" (BAJAOVRLAY-46): which list,
 * among those that fit the field ("Patrocinadores", "Programação"), and the "Valor agora"
 * line saying how long it is now, read as the server's take reads it. The choice lives in
 * react-hook-form under `entityLists.<key>`; before the operator touches it, the form
 * reads the first list that fits (a field usually fits one).
 */
export function EntityListControls(props: {
  form: UseFormReturn<SchemaFormValues>;
  field: SchemaFormFieldDescription;
  dataSchema: unknown;
  controlId: string;
  entityLibrary: EntityLibrary;
  isDisabled: boolean;
}) {
  const { form, field, dataSchema, controlId, entityLibrary, isDisabled } = props;
  const chosenListType = useWatch({ control: form.control, name: `entityLists.${field.key}` });
  const listTypesOffered = listEntityListTypesOfferedToField(dataSchema, field.key);
  const list = readEntityListOfFormField(dataSchema, field.key, chosenListType);

  return (
    <div className="flex flex-col gap-2">
      <Controller
        control={form.control}
        name={`entityLists.${field.key}`}
        render={({ field: listField }) => (
          <Select
            value={list?.entityType ?? ''}
            onValueChange={(listType) =>
              listField.onChange(listTypesOffered.find((offered) => offered === listType))
            }
            disabled={isDisabled}
          >
            <SelectTrigger
              id={controlId}
              size="sm"
              className="w-full"
              aria-label={texts.entityListSelectorLabel(field.label)}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {listTypesOffered.map((listType) => (
                <SelectItem key={listType} value={listType}>
                  {texts.entityListNames[listType]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
      {list !== undefined && (
        <p className="text-sm text-muted-foreground">
          {writeEntityListValueNowText(list.entityType, entityLibrary)}
        </p>
      )}
    </div>
  );
}
