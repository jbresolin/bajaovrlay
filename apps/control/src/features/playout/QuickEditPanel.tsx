import { useState } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ptBR } from '@/i18n/ptBR';
import { useServerState } from '@/state/ControlPageStateProvider';

import { chooseGraphicForQuickEdit } from './graphicForQuickEdit';
import { QuickEditForm } from './QuickEditForm';

// The id that ties the dropdown to its label. It must not start like the ids of the
// generated fields (QuickEditForm.tsx), or a graphic's own field could end up with it.
const graphicDropdownId = 'quick-edit-chosen-graphic';

/**
 * "Edição rápida", the centre panel of the page: a dropdown of every graphic the server
 * lists (by the name in its manifest) and, under it, that graphic's form with "Colocar
 * no ar" and "Atualizar" (QuickEditForm.tsx). Nothing here knows any graphic by name:
 * the form is generated from whatever manifest the chosen graphic has.
 *
 * Until the operator chooses, the panel shows the graphic taken most recently on the
 * program output, or the first one listed when nothing is on air
 * (graphicForQuickEdit.ts). From the moment the operator picks a graphic in the dropdown,
 * or changes a field of the form, the panel stays on that graphic: a take fired from the
 * rundown must not swap the form under the operator's hands.
 *
 * Another graphic means a fresh form: the form is drawn with the graphic's id as its
 * React `key`. What could go wrong: an edit not yet sent is lost when the operator picks
 * another graphic in the dropdown, and is not there when they come back.
 */
export function QuickEditPanel() {
  const graphics = useServerState((state) => state.graphics);
  const instances = useServerState((state) => state.instances);
  const [graphicIdThePanelStaysOn, setGraphicIdThePanelStaysOn] = useState<string | undefined>(
    undefined,
  );

  const graphicShown = chooseGraphicForQuickEdit({
    graphics,
    instances,
    graphicIdThePanelStaysOn,
  });

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
        <>
          <CardContent className="flex flex-col gap-2">
            <Label htmlFor={graphicDropdownId}>{ptBR.playout.quickEdit.graphicLabel}</Label>
            <Select value={graphicShown.id} onValueChange={setGraphicIdThePanelStaysOn}>
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
          </CardContent>
          <QuickEditForm
            key={graphicShown.id}
            graphic={graphicShown}
            onOperatorChangedAFieldOfGraphic={setGraphicIdThePanelStaysOn}
          />
        </>
      )}
    </Card>
  );
}
