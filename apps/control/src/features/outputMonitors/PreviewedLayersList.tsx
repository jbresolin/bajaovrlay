import { Badge } from '@/components/ui/badge';
import { ActionButton } from '@/features/connection/ActionButton';
import { CommandErrorMessage } from '@/features/playout/CommandErrorMessage';
import { ptBR } from '@/i18n/ptBR';
import { useSendCommand, useServerState } from '@/state/ControlPageStateProvider';

import { listPreviewedLayers } from './previewedLayers';

/**
 * What sits under the "Prévia" monitor: one line per layer that holds a preview, in the
 * layer panel's order, naming the layer and what is previewed on it (previewedLayers.ts),
 * with "Tomar" (`takePreview` for that layer: the preview goes on air as it was seen) and
 * "Descartar" (`stopPreview` for that layer). With nothing previewed it says so.
 *
 * Several layers can hold a preview at once and the monitor draws them all, so there is
 * one line each rather than one pair of buttons that would have to guess which preview
 * is meant. It only repeats the server's instances: a line leaves when the server's next
 * slice no longer holds that preview, not when a button is pressed.
 *
 * Deliberate: a line has no status badge. A preview's status stays "loading" for good,
 * because the pages that draw previews never report to the server.
 */
export function PreviewedLayersList() {
  const layers = useServerState((state) => state.layers);
  const graphics = useServerState((state) => state.graphics);
  const items = useServerState((state) => state.items);
  const instances = useServerState((state) => state.instances);
  const sendCommand = useSendCommand();

  const previewedLayers = listPreviewedLayers({ layers, graphics, items, instances });

  return (
    // The least height is one line's, so the panel below the monitors does not jump down
    // when the first preview appears.
    <div className="flex min-h-8 flex-col gap-2">
      {previewedLayers.length === 0 ? (
        <p className="text-sm text-muted-foreground">{ptBR.outputMonitors.nothingInPreview}</p>
      ) : (
        <ul
          aria-label={ptBR.outputMonitors.previewedLayersListLabel}
          className="flex flex-col gap-2"
        >
          {previewedLayers.map((previewedLayer) => (
            <li
              key={previewedLayer.layerId}
              aria-label={previewedLayer.layerName}
              className="flex items-center gap-2"
            >
              <Badge variant="outline">{previewedLayer.layerName}</Badge>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {previewedLayer.previewLabel}
              </span>
              <ActionButton
                size="xs"
                onClick={() =>
                  void sendCommand({ type: 'takePreview', layerId: previewedLayer.layerId })
                }
              >
                {ptBR.outputMonitors.takePreviewButton}
              </ActionButton>
              {/* The layer is always named: `layerId: null` would throw away the previews
                  of every other layer as well. */}
              <ActionButton
                size="xs"
                variant="outline"
                onClick={() =>
                  void sendCommand({ type: 'stopPreview', layerId: previewedLayer.layerId })
                }
              >
                {ptBR.outputMonitors.discardPreviewButton}
              </ActionButton>
            </li>
          ))}
        </ul>
      )}
      <CommandErrorMessage commandTypes={['takePreview', 'stopPreview']} />
    </div>
  );
}
