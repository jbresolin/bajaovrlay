import {
  findNextStepOfInstance,
  type Graphic,
  type Instance,
  type Layer,
  listLayersOfOutputBottomToTop,
  listOutputsProgramFirst,
  readStepCountOfInstance,
} from '@bajaovrlay/shared';

import { Card, CardContent } from '@/components/ui/card';
import { CommandErrorMessage } from '@/features/playout/CommandErrorMessage';
import { useQuickEditChoice } from '@/features/playout/QuickEditChoiceProvider';
import { describeWhatUndoOnLayerBringsBack } from '@/features/undo/whatUndoBringsBack';
import { useSendCommand, useServerState } from '@/state/ControlPageStateProvider';

import { nameFieldsByTheirTitles } from './fieldsOfInstanceOnAir';
import { chooseHomeOfItemSavedFromCamadas } from './itemSavedFromInstanceWithoutItem';
import { LayerGroupOfOutput } from './LayerGroupOfOutput';
import { listLayersInCamadasOrder } from './layersInCamadasOrder';
import { LayerStatusRow } from './LayerStatusRow';
import { useCurrentTime } from './useCurrentTime';
import { useSavesFromCamadas } from './useSavesFromCamadas';
import { WallClockChoiceDialog } from './WallClockChoiceDialog';

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
 * A row whose instance was changed on air offers "Salvar no item" and one with no item
 * "Salvar como item" (useSavesFromCamadas.ts); either may first ask about a clock's
 * moment (WallClockChoiceDialog.tsx). A graphic shown in steps offers "Próximo"
 * (`nextOnLayer`, BAJAOVRLAY-47). A layer whose program the server remembers changing
 * offers "Desfazer" (`undoOnLayer`, BAJAOVRLAY-30; features/undo). A row whose item was
 * saved after the take says "item mudou" and offers to catch up (ItemAheadOfTheAirMarker.tsx,
 * BAJAOVRLAY-38); that marker reads its own instance and item, so it is not drawn from here.
 */
export function LayerStatusPanel() {
  const outputs = useServerState((state) => state.outputs);
  const layers = useServerState((state) => state.layers);
  const graphics = useServerState((state) => state.graphics);
  const instances = useServerState((state) => state.instances);
  const items = useServerState((state) => state.items);
  const rundowns = useServerState((state) => state.rundowns);
  const panels = useServerState((state) => state.quickFirePanels);
  const previewClearedLayerIds = useServerState((state) => state.previewClearedLayerIds);
  const programHistory = useServerState((state) => state.programHistory);
  const sendCommand = useSendCommand();
  const { editInstanceInQuickEdit } = useQuickEditChoice();
  const currentTime = useCurrentTime(relativeTimeRefreshIntervalInMilliseconds);
  const saves = useSavesFromCamadas(graphics, items);
  // Where "Salvar como item" puts a new item; with no rundown and no panel it is not offered.
  const homeOfItemSavedFromCamadas = chooseHomeOfItemSavedFromCamadas(rundowns, panels);

  // With program alone the rows are listed as they always were; with more outputs
  // (BAJAOVRLAY-49) each output is a group, program first (LayerGroupOfOutput.tsx).
  const isOneOutputOnly = outputs.length <= 1;
  const layersFromBottomToTop = listLayersInCamadasOrder(layers, outputs);

  // One row of Camadas; the same for every output, so a PiP's row offers what program's does.
  function drawRowOfLayer(layer: Layer) {
    const instanceOnProgram = findInstanceOnProgram(instances, layer.id);
    const instanceInPreview = findInstanceInPreview(instances, layer.id);
    const programInstanceToEdit = keepIfItsGraphicIsListed(instanceOnProgram, graphics);
    const previewInstanceToEdit = keepIfItsGraphicIsListed(instanceInPreview, graphics);
    const graphicOnProgram = graphics.find(
      (graphic) => graphic.id === instanceOnProgram?.graphicId,
    );
    const keysChangedOnAir = instanceOnProgram?.fieldsChangedOnAir ?? [];
    const graphicInPreview = graphics.find(
      (graphic) => graphic.id === instanceInPreview?.graphicId,
    );
    const keysChangedInPreview = instanceInPreview?.fieldsChangedOnAir ?? [];
    const isItemOnProgramStored = items.some((item) => item.id === instanceOnProgram?.itemId);
    return (
      <LayerStatusRow
        key={layer.id}
        layer={layer}
        instanceOnProgram={instanceOnProgram}
        isHoldingAPreview={instanceInPreview !== undefined}
        instanceIdInPreview={instanceInPreview?.id}
        isMarkedToBeCleared={previewClearedLayerIds.includes(layer.id)}
        graphicName={findGraphicName(graphics, instanceOnProgram?.graphicId)}
        graphicOnProgram={graphicOnProgram}
        currentTime={currentTime}
        onClearPressed={() => void sendCommand({ type: 'clearLayer', layerId: layer.id })}
        whatUndoBringsBack={describeWhatUndoOnLayerBringsBack(programHistory, layer.id)}
        onUndoPressed={() => void sendCommand({ type: 'undoOnLayer', layerId: layer.id })}
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
        changedFieldTitles={nameFieldsByTheirTitles(graphicOnProgram, keysChangedOnAir)}
        changedInPreviewFieldTitles={nameFieldsByTheirTitles(
          graphicInPreview,
          keysChangedInPreview,
        )}
        isSaveIntoItemWaiting={
          instanceOnProgram !== undefined && saves.isSavingIntoItem(instanceOnProgram.id)
        }
        onSaveIntoItemPressed={
          instanceOnProgram === undefined || keysChangedOnAir.length === 0 || !isItemOnProgramStored
            ? undefined
            : () => saves.pressSaveIntoItem(instanceOnProgram)
        }
        onSaveAsItemPressed={
          instanceOnProgram === undefined ||
          instanceOnProgram.itemId !== undefined ||
          homeOfItemSavedFromCamadas === undefined
            ? undefined
            : () => saves.pressSaveAsItem(instanceOnProgram, homeOfItemSavedFromCamadas)
        }
        stepOnProgram={describeStepOnProgram(instanceOnProgram, graphicOnProgram)}
        onNextStepPressed={
          instanceOnProgram === undefined ||
          findNextStepOfInstance(instanceOnProgram, graphicOnProgram) === undefined
            ? undefined
            : () =>
                void sendCommand({
                  type: 'nextOnLayer',
                  layerId: layer.id,
                  fromStep: instanceOnProgram.currentStep,
                })
        }
      />
    );
  }

  return (
    <Card className="py-2">
      {/* px-4, not the card's 24 px: in a 880 px column the 16 px gained keep a row with
          something on air and its buttons on one line (BAJAOVRLAY-59). */}
      <CardContent className="px-4">
        {isOneOutputOnly ? (
          <ul className="flex flex-col divide-y">{layersFromBottomToTop.map(drawRowOfLayer)}</ul>
        ) : (
          listOutputsProgramFirst(outputs).map((output) => (
            <LayerGroupOfOutput key={output.outputId} output={output}>
              {listLayersOfOutputBottomToTop(layers, output.outputId).map(drawRowOfLayer)}
            </LayerGroupOfOutput>
          ))
        )}
        {/* "Limpar" and "Limpar tudo" show their refusals below the panel (AppShell.tsx). A
            row's "Disparar" (an item saved since its take) sends its take as Camadas', so its
            refusal shows here only (gate 2 of PR #64). */}
        <CommandErrorMessage
          areaOfThePage="layerPanel"
          commandTypes={[
            'previewClearLayer',
            'saveOnAirChangesIntoItem',
            'nextOnLayer',
            'undoOnLayer',
            'takeItem',
          ]}
        />
        {saves.noteAboutTheLastSave !== null && (
          <p role="status" className="text-sm text-muted-foreground">
            {saves.noteAboutTheLastSave}
          </p>
        )}
        <WallClockChoiceDialog
          isOpen={saves.isAskingAboutTheClock}
          onChosen={saves.answerTheClockQuestion}
          onCancelled={saves.cancelTheClockQuestion}
        />
      </CardContent>
    </Card>
  );
}

/**
 * Where the instance on air stands among its steps, counted from 1 as the operator reads
 * it; undefined for an empty layer or a graphic of one step. A bracket's count comes from
 * the rounds on air (BAJAOVRLAY-25), so a live update can change it.
 */
function describeStepOnProgram(
  instanceOnProgram: Instance | undefined,
  graphicOnProgram: Graphic | undefined,
): { stepNumber: number; stepCount: number } | undefined {
  if (instanceOnProgram === undefined) {
    return undefined;
  }
  const stepCount = readStepCountOfInstance(instanceOnProgram, graphicOnProgram);
  if (stepCount === 1) {
    return undefined;
  }
  return { stepNumber: instanceOnProgram.currentStep + 1, stepCount };
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
