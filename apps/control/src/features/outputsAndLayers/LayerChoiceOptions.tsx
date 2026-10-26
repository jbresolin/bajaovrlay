import {
  type Layer,
  listLayersOfOutputBottomToTop,
  listOutputsProgramFirst,
} from '@bajaovrlay/shared';

import { SelectGroup, SelectItem, SelectLabel } from '@/components/ui/select';
import { ptBR } from '@/i18n/ptBR';
import { useServerState } from '@/state/ControlPageStateProvider';

/**
 * The options of a layer dropdown (the item editor's "Camada", a macro step's "limpar a
 * camada"), drawn inside its SelectContent. With program alone they are the layers bottom
 * to top, as they always were. With more outputs (BAJAOVRLAY-49) each output is a group,
 * program first, labelled "Saída <nome>", so two outputs' "Legenda" layers are never
 * mixed up. `layers` is the list the caller offers; the outputs come from the store.
 */
export function LayerChoiceOptions(props: { layers: Layer[] }) {
  const outputs = useServerState((state) => state.outputs);
  if (outputs.length <= 1) {
    const layersBottomToTop = [...props.layers].sort(
      (oneLayer, otherLayer) => oneLayer.zIndex - otherLayer.zIndex,
    );
    return layersBottomToTop.map((layer) => (
      <SelectItem key={layer.id} value={layer.id}>
        {layer.name}
      </SelectItem>
    ));
  }
  return listOutputsProgramFirst(outputs).map((output) => (
    <SelectGroup key={output.outputId}>
      <SelectLabel>{ptBR.outputs.layerGroupLabel(output.name)}</SelectLabel>
      {listLayersOfOutputBottomToTop(props.layers, output.outputId).map((layer) => (
        <SelectItem key={layer.id} value={layer.id}>
          {layer.name}
        </SelectItem>
      ))}
    </SelectGroup>
  ));
}
