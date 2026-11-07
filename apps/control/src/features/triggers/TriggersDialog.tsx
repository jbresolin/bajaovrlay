import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ptBR } from '@/i18n/ptBR';
import { useServerState } from '@/state/ControlPageStateProvider';

import { TriggerEditor } from './TriggerEditor';
import { describeTriggerForTheList } from './triggerText';

const texts = ptBR.triggers.dialog;

/** What the dialog shows: the list, or the editor of a new trigger or of a stored one. */
type DialogView = { kind: 'list' } | { kind: 'editor'; triggerId: string | null };

/**
 * "Gatilhos" (BAJAOVRLAY-48), opened beside "Regras" on the "Eventos" page: the triggers
 * in the order the server keeps them, each in words (triggerText.ts) with "Editar", and
 * "+ Gatilho". The editor (TriggerEditor.tsx) takes the dialog's place until it saves,
 * deletes or goes back. A trigger deleted by another operator while open goes back to the
 * list, since there is nothing left to edit.
 */
export function TriggersDialog(props: { onClose: () => void }) {
  const triggers = useServerState((state) => state.triggers);
  const macros = useServerState((state) => state.macros);
  const scheduleSlots = useServerState((state) => state.scheduleSlots);
  const [view, setView] = useState<DialogView>({ kind: 'list' });
  const triggerBeingEdited =
    view.kind === 'editor' && view.triggerId !== null
      ? triggers.find((trigger) => trigger.id === view.triggerId)
      : undefined;
  const isEditedTriggerGone =
    view.kind === 'editor' && view.triggerId !== null && triggerBeingEdited === undefined;

  return (
    <Dialog
      open
      onOpenChange={(isOpenNow) => {
        if (!isOpenNow) {
          props.onClose();
        }
      }}
    >
      <DialogContent closeButtonLabel={texts.closeButton} className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{texts.title}</DialogTitle>
          <DialogDescription>{texts.description}</DialogDescription>
        </DialogHeader>
        {view.kind === 'editor' && !isEditedTriggerGone ? (
          <TriggerEditor
            key={view.triggerId ?? 'novo'}
            triggerBeingEdited={triggerBeingEdited ?? null}
            onDone={() => setView({ kind: 'list' })}
          />
        ) : (
          <>
            {triggers.length === 0 ? (
              <p className="text-sm text-muted-foreground">{texts.noTriggers}</p>
            ) : null}
            <ul aria-label={texts.listLabel} className="flex flex-col gap-1">
              {triggers.map((trigger) => (
                <li key={trigger.id} className="flex items-center gap-2 rounded-md border p-2">
                  <div className="flex flex-1 flex-col text-sm">
                    <span className="font-semibold">{trigger.name}</span>
                    <span className="text-muted-foreground">
                      {describeTriggerForTheList(trigger, macros, scheduleSlots)}
                    </span>
                  </div>
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    aria-label={texts.editButton(trigger.name)}
                    onClick={() => setView({ kind: 'editor', triggerId: trigger.id })}
                  >
                    {texts.editWord}
                  </Button>
                </li>
              ))}
            </ul>
            <Button
              type="button"
              size="sm"
              className="self-start"
              onClick={() => setView({ kind: 'editor', triggerId: null })}
            >
              {texts.addButton}
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
