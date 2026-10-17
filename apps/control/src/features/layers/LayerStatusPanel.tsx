import type { Graphic, Instance } from '@bajaovrlay/shared';

import { Card, CardContent } from '@/components/ui/card';
import { CommandErrorMessage } from '@/features/playout/CommandErrorMessage';
import { useQuickEditChoice } from '@/features/playout/QuickEditChoiceProvider';
import { useSendCommand, useServerState } from '@/state/ControlPageStateProvider';

import { LayerStatusRow } from './LayerStatusRow';
import { useCurrentTime } from './useCurrentTime';

// "há 2 min" changes once a minute; refreshing every 10 s keeps it at most 10 s late.
const relativeTimeRefreshIntervalInMilliseconds = 10_000;

/**
 * Lists every layer, from the bottom of the screen stack to the top, with what is on
 * air on it, and a chip on a layer that also holds something on the preview output.
 * Always visible: the operator must never have to guess what a layer shows.
 * A row with something on air also offers "Prévia: limpar" (`previewClearLayer`) until
 * it is marked; a marked layer carries the chip "vai limpar" instead.
 * It only repeats the server's slices; pressing "Limpar" sends `clearLayer` and the row
 * changes when the server's next instances slice arrives, not before.
 */
export function LayerStatusPanel() {
  const layers = useServerState((state) => state.layers);
  const graphics = useServerState((state) => state.graphics);
  const instances = useServerState((state) => state.instances);
  const previewClearedLayerIds = useServerState((state) => state.previewClearedLayerIds);
  const sendCommand = useSendCommand();
  const { editInstanceInQuickEdit } = useQuickEditChoice();
  const currentTime = useCurrentTime(relativeTimeRefreshIntervalInMilliseconds);

  // Copied before sorting: the list in the store belongs to the store.
  const layersFromBottomToTop = [...layers].sort(
    (oneLayer, otherLayer) => oneLayer.zIndex - otherLayer.zIndex,
  );

  return (
    <Card className="py-2">
      <CardContent>
        <ul className="flex flex-col divide-y">
          {layersFromBottomToTop.map((layer) => {
            const instanceOnProgram = findInstanceOnProgram(instances, layer.id);
            const instanceInPreview = findInstanceInPreview(instances, layer.id);
            const programInstanceToEdit = keepIfItsGraphicIsListed(instanceOnProgram, graphics);
            const previewInstanceToEdit = keepIfItsGraphicIsListed(instanceInPreview, graphics);
            return (
              <LayerStatusRow
                key={layer.id}
                layer={layer}
                instanceOnProgram={instanceOnProgram}
                isHoldingAPreview={instanceInPreview !== undefined}
                isMarkedToBeCleared={previewClearedLayerIds.includes(layer.id)}
                graphicName={findGraphicName(graphics, instanceOnProgram?.graphicId)}
                currentTime={currentTime}
                onClearPressed={() => void sendCommand({ type: 'clearLayer', layerId: layer.id })}
                onPreviewClearPressed={() =>
                  void sendCommand({ type: 'previewClearLayer', layerId: layer.id })
                }
                onEditProgramInstancePressed={
                  programInstanceToEdit === undefined
                    ? undefined
                    : () => editInstanceInQuickEdit(programInstanceToEdit)
                }
                onEditPreviewInstancePressed={
                  previewInstanceToEdit === undefined
                    ? undefined
                    : () => editInstanceInQuickEdit(previewInstanceToEdit)
                }
              />
            );
          })}
        </ul>
        {/* "Limpar" and "Limpar tudo" show their refusals below the panel (AppShell.tsx). */}
        <CommandErrorMessage commandTypes={['previewClearLayer']} />
      </CardContent>
    </Card>
  );
}

/** The instance on air on a layer: the one on the program output. */
function findInstanceOnProgram(instances: Instance[], layerId: string): Instance | undefined {
  return instances.find(
    (instance) => instance.layerId === layerId && instance.target === 'program',
  );
}

/**
 * The instance a layer holds on the preview output, if any. The row marks it with a chip
 * and offers "Editar prévia": what is previewed, and the buttons that take or discard it,
 * are under the "Prévia" monitor (features/outputMonitors).
 */
function findInstanceInPreview(instances: Instance[], layerId: string): Instance | undefined {
  return instances.find(
    (instance) => instance.layerId === layerId && instance.target === 'preview',
  );
}

/**
 * The instance, when "Edição rápida" can draw its form: only for a graphic the server
 * still lists, because the form is generated from that graphic's manifest.
 */
function keepIfItsGraphicIsListed(
  instance: Instance | undefined,
  graphics: Graphic[],
): Instance | undefined {
  const isItsGraphicListed = graphics.some((graphic) => graphic.id === instance?.graphicId);
  return isItsGraphicListed ? instance : undefined;
}

/**
 * The name the operator knows a graphic by (its manifest's name). Falls back to the id:
 * the server keeps an instance on air even after its package is removed, and the panel
 * must still list it.
 */
function findGraphicName(graphics: Graphic[], graphicId: string | undefined): string {
  if (graphicId === undefined) {
    return '';
  }
  const graphic = graphics.find((candidate) => candidate.id === graphicId);
  return graphic?.manifest.name ?? graphicId;
}
