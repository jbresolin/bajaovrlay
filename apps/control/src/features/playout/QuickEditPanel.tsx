import { useEffect } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ptBR } from '@/i18n/ptBR';
import { useServerState } from '@/state/ControlPageStateProvider';

import { useQuickEditChoice } from './QuickEditChoiceProvider';
import { QuickEditForm } from './QuickEditForm';
import { QuickEditHeading } from './QuickEditHeading';
import { findQuickEditMode } from './quickEditMode';
import { QuickEditNothingLoaded } from './QuickEditNothingLoaded';

/**
 * "Edição rápida", the centre panel of the page. Since BAJAOVRLAY-37 it only changes what
 * is already up: ONE instance, loaded by "Editar" (on air) or "Editar prévia" on a
 * "Camadas" row. "Atualizar" (or "Atualizar prévia") changes that instance in place, by
 * its id only; nothing here puts a new graphic up, because everything on air comes from
 * an item. With nothing loaded the panel says how to load something and offers "Novo
 * gráfico…", which opens the item editor (QuickEditNothingLoaded.tsx).
 *
 * When the loaded instance leaves its output or is replaced, or the server no longer
 * lists its graphic, a line says so and the panel has nothing loaded; the values typed
 * are dropped, since there is no other form to keep them in. It never moves to another
 * instance by itself (quickEditMode.ts), and the line keeps the words it had when first
 * shown. A take from the rundown or a shortcut button changes nothing here: only the
 * "Camadas" rows and this panel write what it works on (QuickEditChoiceProvider).
 *
 * The form (QuickEditForm.tsx) is drawn with the instance's id and the choice's
 * formLoadNumber as its React `key`, so every "Editar" starts a fresh form. Nothing here
 * knows any graphic by name.
 */
export function QuickEditPanel() {
  const graphics = useServerState((state) => state.graphics);
  const instances = useServerState((state) => state.instances);
  const layers = useServerState((state) => state.layers);
  const items = useServerState((state) => state.items);
  const quickEditChoice = useQuickEditChoice();

  const listedGraphicIds = graphics.map((graphic) => graphic.id);
  const mode = findQuickEditMode(quickEditChoice.target, instances, listedGraphicIds);

  // The first draw that finds the loaded instance gone writes down what became of it, so
  // the line keeps those words whatever comes to that layer later. No list of inputs on
  // purpose: it runs after every draw, and writing down a loss already written changes
  // nothing (QuickEditChoiceProvider hands back the same choice, so nothing is redrawn).
  const { writeDownTheLossOfTheTarget } = quickEditChoice;
  const idOfTheTarget = quickEditChoice.target?.instanceId;
  const lostTargetSeenNow = mode.kind === 'nothingLoaded' ? mode.lostTarget : undefined;
  useEffect(() => {
    if (idOfTheTarget !== undefined && lostTargetSeenNow !== undefined) {
      writeDownTheLossOfTheTarget(idOfTheTarget, lostTargetSeenNow);
    }
  });

  // An instance being edited always has its graphic listed (findQuickEditMode lets go of
  // it otherwise), so its form can be drawn.
  const instanceBeingEdited =
    mode.kind === 'editingInstance' ? mode.instanceBeingEdited : undefined;
  const graphicOfTheInstance = graphics.find(
    (graphic) => graphic.id === instanceBeingEdited?.graphicId,
  );

  return (
    <section aria-label={ptBR.playout.quickEdit.panelTitle}>
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>{ptBR.playout.quickEdit.panelTitle}</h2>
          </CardTitle>
        </CardHeader>
        {instanceBeingEdited === undefined || graphicOfTheInstance === undefined ? (
          <QuickEditNothingLoaded
            lostTarget={mode.kind === 'nothingLoaded' ? mode.lostTarget : undefined}
          />
        ) : (
          <>
            <CardContent>
              <QuickEditHeading
                instanceBeingEdited={instanceBeingEdited}
                layers={layers}
                graphics={graphics}
                items={items}
                onStopEditingPressed={quickEditChoice.stopEditingTheInstance}
              />
            </CardContent>
            <QuickEditForm
              key={`${instanceBeingEdited.id}#${quickEditChoice.formLoadNumber}`}
              graphic={graphicOfTheInstance}
              instanceBeingEdited={instanceBeingEdited}
            />
          </>
        )}
      </Card>
    </section>
  );
}
