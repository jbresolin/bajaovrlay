import { Badge } from '@/components/ui/badge';
import { useTakeThenPreviewNextItem } from '@/features/autoPreview/useTakeThenPreviewNextItem';
import { ActionButton } from '@/features/connection/ActionButton';
import { CommandErrorMessage } from '@/features/playout/CommandErrorMessage';
import { ptBR } from '@/i18n/ptBR';
import { useSendCommand, useServerState } from '@/state/ControlPageStateProvider';

import { listPreviewedLayers } from './previewedLayers';
import { TakeAllAndDiscardAllButtons } from './TakeAllAndDiscardAllButtons';

// From this many lines on, the set can be taken or thrown away with one press.
const numberOfLinesThatMakeASet = 2;

/**
 * What sits under the "Prévia" monitor: one line per layer that holds a preview or is
 * marked "vai limpar" (the take will clear it, so Prévia shows it empty), in the
 * layer panel's order, naming the layer and what is previewed on it (previewedLayers.ts),
 * with "Tomar" (`takePreview` for that layer: the preview goes on air as it was seen) and
 * "Descartar" (`stopPreview` for that layer). With nothing previewed it says so.
 * "Tomar" goes through the same road as Space (features/autoPreview/): while "Prévia
 * automática" is on, a take that moved the rundown's cursor on is followed by a preview of
 * the new cursor item, so "Tomar", "Tomar" walks the rundown like Space, Space. A refusal
 * of that preview is shown in the rundown column, where every `previewItem` refusal is.
 *
 * Several layers can hold a preview at once and the monitor draws them all, so there is
 * one line each rather than one pair of buttons that would have to guess which preview
 * is meant. It only repeats the server's instances: a line leaves when the server's next
 * slice no longer holds that preview, not when a button is pressed. With two or more
 * lines, "Tomar tudo" and "Descartar tudo" (TakeAllAndDiscardAllButtons.tsx) act on all.
 *
 * Deliberate: a line has no status badge. A preview's status stays "loading" for good,
 * because the pages that draw previews never report to the server.
 */
export function PreviewedLayersList() {
  const layers = useServerState((state) => state.layers);
  const graphics = useServerState((state) => state.graphics);
  const items = useServerState((state) => state.items);
  const instances = useServerState((state) => state.instances);
  const previewClearedLayerIds = useServerState((state) => state.previewClearedLayerIds);
  const sendCommand = useSendCommand();
  const sendTakeByThisOperator = useTakeThenPreviewNextItem();

  const previewedLayers = listPreviewedLayers({
    layers,
    graphics,
    items,
    instances,
    previewClearedLayerIds,
  });
  const isASetToTakeOrDiscard = previewedLayers.length >= numberOfLinesThatMakeASet;

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
              key={previewedLayer.lineKey}
              aria-label={previewedLayer.layerName}
              className="flex items-center gap-2"
            >
              <Badge variant="outline">{previewedLayer.layerName}</Badge>
              {previewedLayer.isMarkedToBeCleared ? (
                <span className="min-w-0 flex-1 truncate text-sm italic text-muted-foreground">
                  {ptBR.outputMonitors.willClearLabel}
                </span>
              ) : (
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {previewedLayer.previewLabel}
                </span>
              )}
              <ActionButton
                size="xs"
                onClick={() =>
                  sendTakeByThisOperator({ type: 'takePreview', layerId: previewedLayer.layerId })
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
      {isASetToTakeOrDiscard ? <TakeAllAndDiscardAllButtons /> : null}
      <CommandErrorMessage commandTypes={['takePreview', 'stopPreview', 'takeAllPreviews']} />
    </div>
  );
}
