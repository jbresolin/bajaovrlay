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

import {
  chooseGraphicForQuickEdit,
  findTakeForQuickEditToFollow,
  type TakeFollowedByQuickEdit,
} from './graphicForQuickEdit';
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
 * The graphic the panel went to by itself leaving the air is not a reason to move: the
 * panel remembers the take it followed and moves only for a later one, so the form keeps
 * what was on air and "Colocar no ar" puts the same thing back. What could go wrong:
 * that memory lives in this page, so after a reload with that graphic off air the panel
 * chooses afresh from what is on air.
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
  const [takeThePanelLastFollowed, setTakeThePanelLastFollowed] = useState<
    TakeFollowedByQuickEdit | undefined
  >(undefined);

  const graphicShown = chooseGraphicForQuickEdit({
    graphics,
    instances,
    graphicIdThePanelStaysOn,
    takeThePanelLastFollowed,
  });

  // The take the panel follows is remembered as soon as it is seen, so the next news
  // from the server is judged against it. React allows setting state while drawing when
  // it is guarded like this: it draws again at once with the remembered take, and the
  // second time the take is no longer new, so it stops there. The two texts of the take
  // are compared, not the object, which is a new one on every draw.
  const takeToFollow = findTakeForQuickEditToFollow({
    graphics,
    instances,
    takeThePanelLastFollowed,
  });
  const isANewTakeToFollow =
    takeToFollow !== undefined &&
    (takeToFollow.graphicId !== takeThePanelLastFollowed?.graphicId ||
      takeToFollow.takenAt !== takeThePanelLastFollowed?.takenAt);
  if (isANewTakeToFollow) {
    setTakeThePanelLastFollowed(takeToFollow);
  }

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
