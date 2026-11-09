import type { Graphic, Item, ItemFields } from '@bajaovrlay/shared';
import { type Ref, useEffect, useImperativeHandle, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { useEntityLibrary } from '@/features/entityLibrary/useEntityLibrary';
import {
  buildChangedItemFieldsFromSchemaForm,
  buildItemFieldsFromSchemaForm,
  buildSchemaFormResolver,
  listFieldKeysReadFromASource,
  SchemaFormFields,
  type SchemaFormValues,
} from '@/features/schemaForm';
import { ptBR } from '@/i18n/ptBR';
import { useReadServerStateNow } from '@/state/ControlPageStateProvider';

import { fillGraphicFieldsOfItemEditor } from './graphicFieldsOfItemEditor';
import { SourceChangeAtTheNextTakeNote } from './SourceChangeAtTheNextTakeNote';
import { useBindingOptionsOfItemEditor } from './useBindingOptionsOfItemEditor';

// "Edição rápida" draws generated fields too, and is on the page at the same time. This
// prefix keeps the element ids of the editor's fields apart from the ids of those.
const graphicFieldsControlIdPrefix = 'item-editor-graphic-fields';

/**
 * What the item editor panel can ask of the graphic's fields. The panel owns the buttons
 * and the commands; this form owns the fields, so the panel reaches them through here.
 */
export type ItemGraphicFieldsFormHandle = {
  /**
   * Checks every field, puts the pt-BR message under each wrong one and answers whether
   * all passed. The typing cursor goes to the first wrong field only when asked to.
   */
  checkFields: (options: { shouldFocusFirstWrongField: boolean }) => Promise<boolean>;
  /** Every field as a new item stores it. Call only after `checkFields` answered true. */
  buildFieldsOfNewItem: () => ItemFields;
  /**
   * Only the fields in which the form differs from what `storedItem` stores. Call only
   * after `checkFields` answered true.
   */
  findFieldsChangedFromStoredItem: (storedItem: Item) => ItemFields;
  /** The keys the form reads from a source now; "Atualizar no ar" leaves them out. */
  listFieldKeysReadFromASource: () => string[];
};

/** What the item editor panel gives this form. */
export type ItemGraphicFieldsFormProps = {
  /** The graphic chosen in the editor, as the server registered it. */
  graphic: Graphic;
  /**
   * What the fields open with (graphicFieldsOfItemEditor.ts): the stored item's fields as
   * they were when the editor opened, a prefill's fields, or null for the defaults.
   */
  fieldsToShow: ItemFields | null;
  /** react-hook-form's `mode`, the same the item's own form uses. */
  whenFieldsAreChecked: 'onChange' | 'onSubmit';
  /** Where the panel receives the handle above while this form is on the page. */
  handleRef: Ref<ItemGraphicFieldsFormHandle>;
  /** true while the stored item is on the program output ("Atualizar no ar" is offered). */
  isItemOnAir: boolean;
  /**
   * Told whether any field is "Evento" now, and again each time that changes: such an
   * item goes on air only through its event, so the panel turns "Salvar e disparar" off.
   */
  onIsFilledByAnEventChanged: (isFilledByAnEvent: boolean) => void;
  /**
   * Told when an image field's upload starts and ends, with the field's key: the panel
   * keeps its save buttons off meanwhile. It must stay the same function between draws.
   */
  onImageUploadingChange: (fieldKey: string, isUploading: boolean) => void;
};

/**
 * The second form of the item editor: the fields of ONE graphic, generated from its
 * manifest (features/schemaForm), with the warning about stored values it could not show.
 *
 * It is filled once, when it is first drawn, and belongs to that graphic for good. The
 * panel draws it with the graphic's id as its React `key`, so choosing another graphic
 * for a new item throws this form away and draws a new one from that graphic's defaults:
 * what was typed for the first graphic is dropped, and fields, rules and values can never
 * belong to two different graphics.
 */
export function ItemGraphicFieldsForm(props: ItemGraphicFieldsFormProps) {
  const { graphic, fieldsToShow, whenFieldsAreChecked, handleRef, isItemOnAir } = props;

  // Decided at the first draw and kept: a newer copy of the graphics slice (a reconnect)
  // must not refill the form over what the operator has typed, and a source that comes
  // on later must not change a "Fonte" the operator already saw. So the sources a new
  // item's suggested "Fonte" is judged by are read once, as the page holds them then, and
  // not subscribed to: a subscription would redraw the whole form at every poll of a
  // source (BAJAOVRLAY-45).
  const readServerStateNow = useReadServerStateNow();
  const [graphicFields] = useState(() => {
    const { dataSources, dataSnapshots } = readServerStateNow();
    return fillGraphicFieldsOfItemEditor(graphic, fieldsToShow, { dataSources, dataSnapshots });
  });
  const form = useForm<SchemaFormValues>({
    defaultValues: graphicFields.formValues,
    resolver: buildSchemaFormResolver(graphicFields.description),
    mode: whenFieldsAreChecked,
  });

  // `useImperativeHandle` is React's way to let a parent call into a child: it puts the
  // object below into the panel's `handleRef` while this form is on the page, and null
  // once it is gone. The panel needs it because one press checks and reads two forms.
  useImperativeHandle(
    handleRef,
    () => ({
      checkFields: (options) =>
        form.trigger(undefined, { shouldFocus: options.shouldFocusFirstWrongField }),
      buildFieldsOfNewItem: () =>
        buildItemFieldsFromSchemaForm(graphicFields.description, form.getValues()),
      findFieldsChangedFromStoredItem: (storedItem) =>
        buildChangedItemFieldsFromSchemaForm(
          graphicFields.description,
          form.getValues(),
          storedItem.fields,
        ),
      listFieldKeysReadFromASource: () =>
        listFieldKeysReadFromASource(graphicFields.description, form.getValues()),
    }),
    [form, graphicFields],
  );

  // A yes or no computed in the watch (`compute`): react-hook-form redraws this form only
  // when the answer changes, not at every pick in any field (BAJAOVRLAY-45).
  const isFilledByAnEventNow = useWatch({
    control: form.control,
    name: 'kinds',
    compute: (kindsNow) => Object.values(kindsNow).includes('eventField'),
  });
  const { onIsFilledByAnEventChanged } = props;
  useEffect(() => {
    onIsFilledByAnEventChanged(isFilledByAnEventNow);
  }, [isFilledByAnEventNow, onIsFilledByAnEventChanged]);

  const hasFieldsThatCouldNotBeRead = graphicFields.labelsOfFieldsThatCouldNotBeRead.length > 0;
  // The item editor alone lets a field read a data source (BAJAOVRLAY-20) or the entity
  // library (BAJAOVRLAY-19).
  const bindingOptions = useBindingOptionsOfItemEditor();
  const entityLibrary = useEntityLibrary();

  return (
    <>
      {hasFieldsThatCouldNotBeRead && (
        <p role="status" className="text-sm text-muted-foreground">
          {ptBR.itemEditor.fieldsThatCouldNotBeRead(
            graphicFields.labelsOfFieldsThatCouldNotBeRead.join(', '),
          )}
        </p>
      )}
      <SchemaFormFields
        form={form}
        description={graphicFields.description}
        controlIdPrefix={graphicFieldsControlIdPrefix}
        bindingOptions={bindingOptions}
        entityLibrary={entityLibrary}
        onImageUploadingChange={props.onImageUploadingChange}
        carGroups={graphicFields.carGroups}
      />
      {isItemOnAir && (
        <SourceChangeAtTheNextTakeNote
          form={form}
          description={graphicFields.description}
          formValuesAsOpened={graphicFields.formValues}
        />
      )}
    </>
  );
}
