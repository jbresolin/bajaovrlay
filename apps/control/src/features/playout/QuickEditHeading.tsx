import type { Graphic, Instance, Item, Layer } from '@bajaovrlay/shared';

import { Button } from '@/components/ui/button';
import { ptBR } from '@/i18n/ptBR';

import type { LostQuickEditTarget, QuickEditMode } from './quickEditMode';

const texts = ptBR.playout.quickEdit;

/** What the heading needs: the panel's mode and the slices that name things. */
export type QuickEditHeadingProps = {
  mode: QuickEditMode;
  layers: Layer[];
  graphics: Graphic[];
  items: Item[];
  onStopEditingPressed: () => void;
};

/**
 * The top of "Edição rápida", saying what a press of its buttons will change:
 * "Nova entrada — não altera nenhum item", or "Editando: Relógio · Largada do enduro ·
 * No ar" with a "Nova entrada" button to let go of that instance. When the instance
 * being edited is gone, one line under the heading says whether it left or was replaced.
 * The heading is an h3 so a screen reader (and a test) finds it as the panel's one
 * sub-heading under "Edição rápida".
 */
export function QuickEditHeading(props: QuickEditHeadingProps) {
  const { mode, layers, graphics, items } = props;

  if (mode.kind === 'editingInstance') {
    const instance = mode.instanceBeingEdited;
    const outputWord = instance.target === 'program' ? texts.onProgramWord : texts.inPreviewWord;
    return (
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium">
          {texts.editingHeader(
            nameLayer(layers, instance.layerId),
            nameInstance(instance, graphics, items),
            outputWord,
          )}
        </h3>
        <Button type="button" size="xs" variant="outline" onClick={props.onStopEditingPressed}>
          {texts.stopEditingButton}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-sm font-medium">{texts.newTakeHeader}</h3>
      {mode.lostTarget === undefined ? null : (
        <p role="status" className="text-sm text-muted-foreground">
          {describeLostTarget(mode.lostTarget, nameLayer(layers, mode.lostTarget.layerId))}
        </p>
      )}
    </div>
  );
}

/** A layer as the layer panel names it, or its id when the server no longer lists it. */
function nameLayer(layers: Layer[], layerId: string): string {
  return layers.find((layer) => layer.id === layerId)?.name ?? layerId;
}

/**
 * An instance in the words the operator knows it by: the label of the item it was taken
 * from, or the graphic's name for one taken by hand (or whose item was deleted since),
 * as the lines under the Prévia monitor name a preview.
 */
function nameInstance(instance: Instance, graphics: Graphic[], items: Item[]): string {
  const itemTaken = items.find((item) => item.id === instance.itemId);
  if (itemTaken !== undefined) {
    return itemTaken.label;
  }
  const graphic = graphics.find((candidate) => candidate.id === instance.graphicId);
  return graphic?.manifest.name ?? instance.graphicId;
}

/** The one line that says what became of the instance the panel was editing. */
function describeLostTarget(lostTarget: LostQuickEditTarget, layerName: string): string {
  if (lostTarget.output === 'program') {
    return lostTarget.wasReplaced
      ? texts.targetReplacedOnProgram(layerName)
      : texts.targetLeftProgram(layerName);
  }
  return lostTarget.wasReplaced
    ? texts.targetReplacedInPreview(layerName)
    : texts.targetLeftPreview(layerName);
}
