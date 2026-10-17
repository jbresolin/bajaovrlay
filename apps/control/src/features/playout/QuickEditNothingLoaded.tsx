import type { Layer } from '@bajaovrlay/shared';

import { Button } from '@/components/ui/button';
import { CardContent } from '@/components/ui/card';
import { useItemEditorTarget } from '@/features/items/ItemEditorTargetProvider';
import { useQuickFireTabChoice } from '@/features/quickFire/QuickFireTabChoiceProvider';
import {
  chooseTabShown,
  findPanelIdForNewShortcut,
  listQuickFireTabsInOrder,
} from '@/features/quickFire/quickFireTabs';
import { ptBR } from '@/i18n/ptBR';
import { useServerState } from '@/state/ControlPageStateProvider';

import { useQuickEditChoice } from './QuickEditChoiceProvider';
import type { LostQuickEditTarget } from './quickEditMode';

const texts = ptBR.playout.quickEdit;

/**
 * "Edição rápida" with nothing loaded: the line about an instance that is gone (when the
 * panel was editing one), one hint saying how to load what is on air, and "Novo gráfico…".
 * That button opens the item editor for a new item, "Onde" on the shortcuts panel the
 * strip shows: everything on air comes from an item (BAJAOVRLAY-37), and a graphic made
 * on the spot is an ad hoc button rather than a step of the rundown. It sends nothing
 * itself, so it is a plain button that works without a connection, and it takes the line
 * about a lost instance away: the operator has moved on.
 */
export function QuickEditNothingLoaded(props: { lostTarget: LostQuickEditTarget | undefined }) {
  const layers = useServerState((state) => state.layers);
  const panels = useServerState((state) => state.quickFirePanels);
  const { openItemEditorForNewItem } = useItemEditorTarget();
  const { chosenTab } = useQuickFireTabChoice();
  const { stopEditingTheInstance } = useQuickEditChoice();

  function openItemEditorOnThePanelShown(): void {
    const tabs = listQuickFireTabsInOrder(panels);
    const panelId = findPanelIdForNewShortcut(tabs, chooseTabShown(tabs, chosenTab));
    stopEditingTheInstance();
    openItemEditorForNewItem({ kind: 'quickFire', panelId });
  }

  const { lostTarget } = props;
  return (
    <CardContent className="flex flex-col items-start gap-3">
      {lostTarget === undefined ? null : (
        <p role="status" className="text-sm text-muted-foreground">
          {describeLostTarget(lostTarget, nameLayer(layers, lostTarget.layerId))}
        </p>
      )}
      <p className="text-sm text-muted-foreground">{texts.nothingLoadedHint}</p>
      <Button type="button" variant="outline" onClick={openItemEditorOnThePanelShown}>
        {texts.newGraphicButton}
      </Button>
    </CardContent>
  );
}

/** A layer as the layer panel names it, or its id when the server no longer lists it. */
function nameLayer(layers: Layer[], layerId: string): string {
  return layers.find((layer) => layer.id === layerId)?.name ?? layerId;
}

/** The one line that says what became of the instance the panel was editing. */
function describeLostTarget(lostTarget: LostQuickEditTarget, layerName: string): string {
  if (lostTarget.whatHappened === 'graphicNoLongerListed') {
    return texts.targetGraphicNoLongerListed(layerName);
  }
  const wasReplaced = lostTarget.whatHappened === 'replaced';
  if (lostTarget.output === 'program') {
    return wasReplaced
      ? texts.targetReplacedOnProgram(layerName)
      : texts.targetLeftProgram(layerName);
  }
  return wasReplaced
    ? texts.targetReplacedInPreview(layerName)
    : texts.targetLeftPreview(layerName);
}
