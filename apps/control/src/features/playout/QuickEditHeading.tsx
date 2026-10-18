import type { Graphic, Instance, Item, Layer } from '@bajaovrlay/shared';

import { Button } from '@/components/ui/button';
import { ptBR } from '@/i18n/ptBR';

const texts = ptBR.playout.quickEdit;

/** What the heading needs: the instance loaded, and the slices that name things. */
export type QuickEditHeadingProps = {
  instanceBeingEdited: Instance;
  layers: Layer[];
  graphics: Graphic[];
  items: Item[];
  onStopEditingPressed: () => void;
};

/**
 * The top of "Edição rápida" while an instance is loaded, saying what a press of its
 * button changes: "Editando: Relógio · Largada do enduro · No ar", with "Parar de editar"
 * to let go of that instance. The heading is an h3 so a screen reader (and a test) finds
 * it as the panel's one sub-heading under "Edição rápida".
 */
export function QuickEditHeading(props: QuickEditHeadingProps) {
  const { instanceBeingEdited, layers, graphics, items } = props;
  const outputWord =
    instanceBeingEdited.target === 'program' ? texts.onProgramWord : texts.inPreviewWord;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-sm font-medium">
        {texts.editingHeader(
          nameLayer(layers, instanceBeingEdited.layerId),
          nameInstance(instanceBeingEdited, graphics, items),
          outputWord,
        )}
      </h3>
      <Button type="button" size="xs" variant="outline" onClick={props.onStopEditingPressed}>
        {texts.stopEditingButton}
      </Button>
    </div>
  );
}

/** A layer as the layer panel names it, or its id when the server no longer lists it. */
function nameLayer(layers: Layer[], layerId: string): string {
  return layers.find((layer) => layer.id === layerId)?.name ?? layerId;
}

/**
 * An instance in the words the operator knows it by: the label of the item it was taken
 * from, or the graphic's name for one with no item (taken by hand before BAJAOVRLAY-37,
 * or whose item was deleted since), as the lines under the Prévia monitor name a preview.
 */
function nameInstance(instance: Instance, graphics: Graphic[], items: Item[]): string {
  const itemTaken = items.find((item) => item.id === instance.itemId);
  if (itemTaken !== undefined) {
    return itemTaken.label;
  }
  const graphic = graphics.find((candidate) => candidate.id === instance.graphicId);
  return graphic?.manifest.name ?? instance.graphicId;
}
