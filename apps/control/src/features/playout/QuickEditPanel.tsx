import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ptBR } from '@/i18n/ptBR';
import { useServerState } from '@/state/ControlPageStateProvider';

import { useQuickEditChoice } from './QuickEditChoiceProvider';
import { QuickEditForm } from './QuickEditForm';
import { QuickEditGraphicAndLayerChoice } from './QuickEditGraphicAndLayerChoice';
import { QuickEditHeading } from './QuickEditHeading';
import { findQuickEditMode, type QuickEditMode } from './quickEditMode';

/**
 * "Edição rápida", the centre panel of the page. It works on one of two things, and its
 * heading says which (QuickEditHeading.tsx):
 * - ONE instance, loaded by "Editar" (on air) or "Editar prévia" on a "Camadas" row.
 *   "Atualizar" changes that instance in place, by its id only; "Colocar no ar" and
 *   "Prévia" go to that instance's layer.
 * - a new entry, with nothing loaded: a graphic and a layer chosen in the dropdowns
 *   (QuickEditGraphicAndLayerChoice.tsx), "Colocar no ar" and "Prévia" on that layer.
 *   This is how the page opens.
 * When the loaded instance leaves its output or is replaced, a line says so and the panel
 * makes a new entry with the same form; it never moves to another instance by itself
 * (quickEditMode.ts). A take from the rundown or a shortcut button changes nothing here:
 * only this panel and the "Camadas" rows write what it works on (QuickEditChoiceProvider).
 * This replaces the panel that followed the graphic taken most recently (BAJAOVRLAY-36).
 *
 * The form (QuickEditForm.tsx) is drawn with the graphic's id and the choice's
 * formLoadNumber as its React `key`: "Editar" and choosing a graphic start a fresh form,
 * while letting go of an instance keeps it. Nothing here knows any graphic by name.
 */
export function QuickEditPanel() {
  const graphics = useServerState((state) => state.graphics);
  const instances = useServerState((state) => state.instances);
  const quickEditChoice = useQuickEditChoice();

  const modeFromTheChoice = findQuickEditMode(quickEditChoice.target, instances);
  const graphicIdWanted =
    modeFromTheChoice.kind === 'editingInstance'
      ? modeFromTheChoice.instanceBeingEdited.graphicId
      : quickEditChoice.graphicIdChosen;
  const graphicShown = graphics.find((graphic) => graphic.id === graphicIdWanted) ?? graphics[0];
  // An instance can only be edited with its graphic's form. If the server stopped
  // listing that graphic, the panel makes a new entry of the graphic shown instead.
  const isTheGraphicOfTheInstanceListed =
    modeFromTheChoice.kind === 'editingInstance' && graphicShown?.id === graphicIdWanted;
  const mode: QuickEditMode =
    modeFromTheChoice.kind === 'editingInstance' && !isTheGraphicOfTheInstanceListed
      ? { kind: 'newTake', lostTarget: undefined }
      : modeFromTheChoice;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{ptBR.playout.quickEdit.panelTitle}</h2>
        </CardTitle>
      </CardHeader>
      {graphicShown === undefined ? (
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {ptBR.playout.quickEdit.noGraphicsOnServer}
          </p>
        </CardContent>
      ) : (
        <QuickEditPanelWithAGraphic
          mode={mode}
          graphicShownId={graphicShown.id}
          layerIdOfNewEntry={quickEditChoice.layerIdChosen ?? graphicShown.defaultLayerId}
        />
      )}
    </Card>
  );
}

/** The panel once there is a graphic to show: heading, dropdowns and the form. */
function QuickEditPanelWithAGraphic(props: {
  mode: QuickEditMode;
  graphicShownId: string;
  layerIdOfNewEntry: string;
}) {
  const { mode, graphicShownId, layerIdOfNewEntry } = props;
  const graphics = useServerState((state) => state.graphics);
  const layers = useServerState((state) => state.layers);
  const items = useServerState((state) => state.items);
  const quickEditChoice = useQuickEditChoice();
  const graphicShown = graphics.find((graphic) => graphic.id === graphicShownId);
  if (graphicShown === undefined) {
    return null;
  }

  const instanceBeingEdited =
    mode.kind === 'editingInstance' ? mode.instanceBeingEdited : undefined;
  const layerIdOfTheCommands = instanceBeingEdited?.layerId ?? layerIdOfNewEntry;

  return (
    <>
      <CardContent className="flex flex-col gap-3">
        <QuickEditHeading
          mode={mode}
          layers={layers}
          graphics={graphics}
          items={items}
          onStopEditingPressed={quickEditChoice.stopEditingTheInstance}
        />
        <QuickEditGraphicAndLayerChoice
          graphics={graphics}
          layers={layers}
          graphicIdShown={graphicShown.id}
          layerIdOfNewEntry={instanceBeingEdited === undefined ? layerIdOfNewEntry : undefined}
          onGraphicChosen={quickEditChoice.chooseGraphicForNewEntry}
          onLayerChosen={quickEditChoice.chooseLayerForNewEntry}
        />
      </CardContent>
      <QuickEditForm
        key={`${graphicShown.id}#${quickEditChoice.formLoadNumber}`}
        graphic={graphicShown}
        instanceBeingEdited={instanceBeingEdited}
        layerIdOfTheCommands={layerIdOfTheCommands}
      />
    </>
  );
}
