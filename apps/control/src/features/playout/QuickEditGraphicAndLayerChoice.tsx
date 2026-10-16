import type { Graphic, Layer } from '@bajaovrlay/shared';

import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ptBR } from '@/i18n/ptBR';

// The ids that tie each dropdown to its label. They must not start like the ids of the
// generated fields (QuickEditForm.tsx), or a graphic's own field could end up with one.
const graphicDropdownId = 'quick-edit-chosen-graphic';
const layerDropdownId = 'quick-edit-chosen-layer';

/** What the two dropdowns show and what choosing in them does. */
export type QuickEditGraphicAndLayerChoiceProps = {
  graphics: Graphic[];
  layers: Layer[];
  graphicIdShown: string;
  /** The layer of a new entry, or undefined while an instance is loaded (no layer dropdown). */
  layerIdOfNewEntry: string | undefined;
  onGraphicChosen: (graphicId: string) => void;
  onLayerChosen: (layerId: string) => void;
};

/**
 * "Gráfico a editar", every graphic the server lists by its manifest's name, and, for a
 * new entry only, "Camada da nova entrada", every layer by its name. Choosing a graphic
 * always starts a new entry of it, also while an instance is loaded. A loaded instance
 * has no layer dropdown: it stays on its own layer, which the heading names.
 */
export function QuickEditGraphicAndLayerChoice(props: QuickEditGraphicAndLayerChoiceProps) {
  const { graphics, layers, graphicIdShown, layerIdOfNewEntry } = props;
  const texts = ptBR.playout.quickEdit;

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor={graphicDropdownId}>{texts.graphicLabel}</Label>
        <Select value={graphicIdShown} onValueChange={props.onGraphicChosen}>
          <SelectTrigger id={graphicDropdownId} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {graphics.map((graphic) => (
              <SelectItem key={graphic.id} value={graphic.id}>
                {graphic.manifest.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {layerIdOfNewEntry === undefined ? null : (
        <div className="flex flex-col gap-2">
          <Label htmlFor={layerDropdownId}>{texts.layerLabel}</Label>
          <Select value={layerIdOfNewEntry} onValueChange={props.onLayerChosen}>
            <SelectTrigger id={layerDropdownId} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {layers.map((layer) => (
                <SelectItem key={layer.id} value={layer.id}>
                  {layer.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
