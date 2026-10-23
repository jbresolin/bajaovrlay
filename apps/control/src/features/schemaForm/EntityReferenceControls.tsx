import {
  type EntityLibrary,
  type EntityType,
  EntityTypeSchema,
  findEntityAttribute,
  listAttributesThatFitDataSchemaField,
  ptBREntities,
  readMediaIdOfMediaUrl,
  resolveEntityReferenceAgainstLibrary,
} from '@bajaovrlay/shared';
import { useState } from 'react';
import { Controller, type UseFormReturn, useWatch } from 'react-hook-form';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  describeRecordOfType,
  readKeyOfRecord,
} from '@/features/entityLibrary/entityRecordsOfType';
import { MediaThumbnail } from '@/features/entityLibrary/MediaThumbnail';
import { listRecordsFoundBySearch } from '@/features/entityLibrary/recordSearch';
import { ptBR } from '@/i18n/ptBR';

import {
  emptySchemaFormEntityReferenceValue,
  readEntityReferenceFromSchemaFormValue,
} from './entityReferenceFormValue';
import type { SchemaFormFieldDescription } from './schemaFormDescription';
import type { SchemaFormValues } from './schemaFormValues';

const texts = ptBR.entityLibrary.editor;

/** What a field row gives the controls. */
export type EntityReferenceControlsProps = {
  form: UseFormReturn<SchemaFormValues>;
  field: SchemaFormFieldDescription;
  dataSchema: unknown;
  controlId: string;
  /** The library as the server holds it now (the item editor reads it from the slices). */
  entityLibrary: EntityLibrary;
  isDisabled: boolean;
};

/**
 * The controls of a field set to "Cadastro" (BAJAOVRLAY-19), in the order they are
 * chosen: the kind of record; the record, with a search box over it (a team by its car
 * number or its team or school name, the others by name); the attribute, only those
 * that fit the field (an image field takes images only, any other string field texts);
 * and "Valor agora", what the field would get now, an image as a thumbnail. Everything
 * lives in react-hook-form under `entityReferences.<key>`; choosing another kind clears
 * the record and the attribute, so the form never holds a record of the wrong kind.
 */
export function EntityReferenceControls(props: EntityReferenceControlsProps) {
  const { form, field, dataSchema, controlId, entityLibrary, isDisabled } = props;
  const [searchText, setSearchText] = useState('');
  const referenceValue =
    useWatch({ control: form.control, name: `entityReferences.${field.key}` }) ??
    emptySchemaFormEntityReferenceValue;
  const entityType = referenceValue.entityType;

  function chooseTheKindOfRecord(chosenType: EntityType): void {
    form.setValue(
      `entityReferences.${field.key}`,
      { entityType: chosenType, recordKey: '', attribute: '' },
      { shouldDirty: true },
    );
    setSearchText('');
  }

  // The record chosen stays listed whatever the search, so its name stays in the box.
  const recordsFound =
    entityType === '' ? [] : listRecordsFoundBySearch(entityLibrary, entityType, searchText);
  const chosenRecord =
    entityType === ''
      ? undefined
      : listRecordsFoundBySearch(entityLibrary, entityType, '').find(
          (record) => readKeyOfRecord(entityType, record) === referenceValue.recordKey,
        );
  const recordsListed =
    chosenRecord === undefined || recordsFound.includes(chosenRecord)
      ? recordsFound
      : [chosenRecord, ...recordsFound];
  const attributesOffered =
    entityType === ''
      ? []
      : listAttributesThatFitDataSchemaField(entityType, dataSchema, field.key);

  return (
    <div className="flex flex-col gap-2">
      <Select
        value={entityType === '' ? undefined : entityType}
        onValueChange={(value) => chooseTheKindOfRecord(EntityTypeSchema.parse(value))}
        disabled={isDisabled}
      >
        <SelectTrigger
          id={`${controlId}-entity-type`}
          size="sm"
          className="w-full"
          aria-label={texts.entityTypeSelectorLabel(field.label)}
        >
          <SelectValue placeholder={ptBR.entityLibrary.form.noChoice} />
        </SelectTrigger>
        <SelectContent>
          {EntityTypeSchema.options.map((option) => (
            <SelectItem key={option} value={option}>
              {ptBREntities.entityTypeNames[option]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {entityType !== '' && (
        <>
          <Input
            aria-label={texts.searchLabel(field.label)}
            placeholder={texts.searchPlaceholder}
            value={searchText}
            disabled={isDisabled}
            onChange={(event) => setSearchText(event.target.value)}
          />
          {recordsListed.length === 0 ? (
            <p className="text-sm text-muted-foreground">{texts.noRecordFound}</p>
          ) : (
            <Controller
              control={form.control}
              name={`entityReferences.${field.key}.recordKey`}
              render={({ field: recordKeyField }) => (
                <Select
                  value={recordKeyField.value === '' ? undefined : recordKeyField.value}
                  onValueChange={recordKeyField.onChange}
                  disabled={isDisabled}
                >
                  <SelectTrigger
                    id={`${controlId}-record`}
                    size="sm"
                    className="w-full"
                    aria-label={texts.recordSelectorLabel(field.label)}
                  >
                    <SelectValue placeholder={ptBR.entityLibrary.form.noChoice} />
                  </SelectTrigger>
                  <SelectContent>
                    {recordsListed.map((record) => (
                      <SelectItem
                        key={readKeyOfRecord(entityType, record)}
                        value={readKeyOfRecord(entityType, record)}
                      >
                        {describeRecordOfType(entityType, record)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          )}
          <Controller
            control={form.control}
            name={`entityReferences.${field.key}.attribute`}
            render={({ field: attributeField }) => (
              <Select
                value={attributeField.value === '' ? undefined : attributeField.value}
                onValueChange={attributeField.onChange}
                disabled={isDisabled}
              >
                <SelectTrigger
                  id={`${controlId}-attribute`}
                  size="sm"
                  className="w-full"
                  aria-label={texts.attributeSelectorLabel(field.label)}
                >
                  <SelectValue placeholder={ptBR.entityLibrary.form.noChoice} />
                </SelectTrigger>
                <SelectContent>
                  {attributesOffered.map((attribute) => (
                    <SelectItem key={attribute.attributeKey} value={attribute.attributeKey}>
                      {attribute.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </>
      )}
      <EntityValueNowLine
        field={field}
        dataSchema={dataSchema}
        entityLibrary={entityLibrary}
        referenceValue={referenceValue}
      />
    </div>
  );
}

/**
 * "Valor agora": what the field would get if the item were taken now, read with the
 * shared resolution the server's take runs; an image as a thumbnail drawn from the media
 * store. Nothing until the kind, the record and the attribute are all chosen.
 */
function EntityValueNowLine(props: {
  field: SchemaFormFieldDescription;
  dataSchema: unknown;
  entityLibrary: EntityLibrary;
  referenceValue: typeof emptySchemaFormEntityReferenceValue;
}) {
  const reading = readEntityReferenceFromSchemaFormValue(
    props.field,
    props.referenceValue,
    props.dataSchema,
  );
  if (reading.status === 'problem') {
    return null;
  }
  const resolution = resolveEntityReferenceAgainstLibrary(reading.reference, props.entityLibrary);
  if (resolution.status !== 'resolved') {
    return <p className="text-sm text-muted-foreground">{texts.noValueNow(resolution.problem)}</p>;
  }
  const attribute = findEntityAttribute(reading.reference.entityType, reading.reference.attribute);
  const mediaIdOfTheImage =
    attribute?.valueType === 'imageUrl'
      ? readMediaIdOfMediaUrl(String(resolution.value))
      : undefined;
  if (mediaIdOfTheImage !== undefined) {
    return (
      <MediaThumbnail
        mediaId={mediaIdOfTheImage}
        alt={texts.imageNowAlt(props.field.label)}
        sizeClassName="h-12 w-12"
      />
    );
  }
  return (
    <p className="text-sm text-muted-foreground">{texts.valueNow(String(resolution.value))}</p>
  );
}
