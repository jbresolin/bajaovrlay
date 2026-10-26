import { type Graphic, ItemColorSchema, type Layer } from '@bajaovrlay/shared';
import { Controller, type UseFormReturn } from 'react-hook-form';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LayerChoiceOptions } from '@/features/outputsAndLayers/LayerChoiceOptions';
import { ptBR } from '@/i18n/ptBR';

import { buildErrorAttributesForControl, FormFieldRow } from './FormFieldRow';
import { chipClassForEachItemColor } from './itemColorChip';
import type { ItemEditorFormValues } from './itemEditorForm';

// Each control's id, used to tie its label and its error message to it.
const controlIds = {
  graphic: 'item-editor-graphic',
  layer: 'item-editor-layer',
  label: 'item-editor-label',
  color: 'item-editor-color',
  notes: 'item-editor-notes',
  autoOutAfterSeconds: 'item-editor-auto-out-after-seconds',
} as const;

/** What the fields need: the form, the choices the server offers, and the kind of edit. */
export type ItemEditorFormFieldsProps = {
  form: UseFormReturn<ItemEditorFormValues>;
  graphics: Graphic[];
  layers: Layer[];
  /**
   * True while a stored item is being changed: its graphic is shown but cannot be
   * chosen, because `updateItemFields` cannot change it. Its layer can be chosen.
   */
  isEditingStoredItem: boolean;
};

/**
 * The six fields every item has, whatever its graphic: graphic, layer, label, colour,
 * notes and auto-out. Text fields are registered with react-hook-form directly; the
 * dropdowns are shadcn/ui controls with no native input to register, so each sits in a
 * `Controller`. A new item opens with no graphic chosen ("Escolha um gráfico…"), and
 * choosing a graphic moves the layer to that graphic's default. For a stored item the
 * graphic is read-only with a note; the layer stays choosable, and a new layer is saved
 * for the item's next takes (it never moves what is on air).
 */
export function ItemEditorFormFields(props: ItemEditorFormFieldsProps) {
  const { form, graphics, layers, isEditingStoredItem } = props;
  const { control, register, formState, setValue } = form;
  const fieldLabels = ptBR.itemEditor.fields;
  const errorMessages = {
    graphic: formState.errors.graphicId?.message,
    layer: formState.errors.layerId?.message,
    label: formState.errors.label?.message,
    color: formState.errors.color?.message,
    notes: formState.errors.notes?.message,
    autoOutAfterSeconds: formState.errors.autoOutAfterSeconds?.message,
  };

  // The layer follows the graphic only at the moment the graphic is chosen; a layer the
  // operator picks afterwards stays, until another graphic is chosen. `shouldValidate`
  // re-checks the layer alone, which removes a "choose the layer" message left by an
  // earlier press now that the layer has a value.
  // A default layer the operator deleted on "Saídas e camadas" (BAJAOVRLAY-49) is not
  // chosen: "Camada" is left empty, and the check says it must be chosen.
  function moveLayerToTheDefaultOfGraphic(graphicId: string): void {
    const chosenGraphic = graphics.find((graphic) => graphic.id === graphicId);
    if (chosenGraphic === undefined) {
      return;
    }
    const isDefaultLayerListed = layers.some((layer) => layer.id === chosenGraphic.defaultLayerId);
    const layerIdToChoose = isDefaultLayerListed ? chosenGraphic.defaultLayerId : '';
    setValue('layerId', layerIdToChoose, { shouldValidate: true });
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <FormFieldRow
        label={fieldLabels.graphic}
        controlId={controlIds.graphic}
        errorMessage={errorMessages.graphic}
      >
        <Controller
          control={control}
          name="graphicId"
          render={({ field }) => (
            <Select
              value={field.value}
              disabled={isEditingStoredItem}
              onValueChange={(graphicId) => {
                field.onChange(graphicId);
                moveLayerToTheDefaultOfGraphic(graphicId);
              }}
            >
              <SelectTrigger
                id={controlIds.graphic}
                className="w-full"
                {...buildErrorAttributesForControl(controlIds.graphic, errorMessages.graphic)}
              >
                <SelectValue placeholder={ptBR.itemEditor.graphicPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {graphics.map((graphic) => (
                  <SelectItem key={graphic.id} value={graphic.id}>
                    {graphic.manifest.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </FormFieldRow>

      <FormFieldRow
        label={fieldLabels.layer}
        controlId={controlIds.layer}
        errorMessage={errorMessages.layer}
      >
        <Controller
          control={control}
          name="layerId"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger
                id={controlIds.layer}
                className="w-full"
                {...buildErrorAttributesForControl(controlIds.layer, errorMessages.layer)}
              >
                {/* Empty until a graphic is chosen, which brings its default layer. */}
                <SelectValue placeholder={ptBR.schemaForm.nothingChosenPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                <LayerChoiceOptions layers={layers} />
              </SelectContent>
            </Select>
          )}
        />
      </FormFieldRow>

      {isEditingStoredItem && (
        <p className="col-span-2 text-sm text-muted-foreground">
          {ptBR.itemEditor.graphicCannotChange}
        </p>
      )}

      <FormFieldRow
        label={fieldLabels.label}
        controlId={controlIds.label}
        errorMessage={errorMessages.label}
      >
        <Input
          id={controlIds.label}
          autoComplete="off"
          {...buildErrorAttributesForControl(controlIds.label, errorMessages.label)}
          {...register('label')}
        />
      </FormFieldRow>

      <FormFieldRow
        label={fieldLabels.color}
        controlId={controlIds.color}
        errorMessage={errorMessages.color}
      >
        <Controller
          control={control}
          name="color"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger
                id={controlIds.color}
                className="w-full"
                {...buildErrorAttributesForControl(controlIds.color, errorMessages.color)}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {/* Each colour is a chip AND its name in words: colour alone would tell
                    nothing to an operator who cannot tell green from red. */}
                {ItemColorSchema.options.map((itemColor) => (
                  <SelectItem key={itemColor} value={itemColor}>
                    <span
                      aria-hidden="true"
                      className={`size-3 rounded-full ${chipClassForEachItemColor[itemColor]}`}
                    />
                    {ptBR.itemEditor.colorNames[itemColor]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </FormFieldRow>

      <div className="col-span-2">
        <FormFieldRow
          label={fieldLabels.notes}
          controlId={controlIds.notes}
          errorMessage={errorMessages.notes}
        >
          <Input
            id={controlIds.notes}
            autoComplete="off"
            {...buildErrorAttributesForControl(controlIds.notes, errorMessages.notes)}
            {...register('notes')}
          />
        </FormFieldRow>
      </div>

      <FormFieldRow
        label={fieldLabels.autoOutAfterSeconds}
        controlId={controlIds.autoOutAfterSeconds}
        errorMessage={errorMessages.autoOutAfterSeconds}
      >
        <Input
          id={controlIds.autoOutAfterSeconds}
          autoComplete="off"
          inputMode="numeric"
          {...buildErrorAttributesForControl(
            controlIds.autoOutAfterSeconds,
            errorMessages.autoOutAfterSeconds,
          )}
          {...register('autoOutAfterSeconds')}
        />
      </FormFieldRow>
    </div>
  );
}
