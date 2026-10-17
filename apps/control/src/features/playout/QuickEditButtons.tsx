import { Button } from '@/components/ui/button';
import { ActionButton } from '@/features/connection/ActionButton';
import { ptBR } from '@/i18n/ptBR';

import { CommandErrorMessage } from './CommandErrorMessage';

/** What the buttons need: whether a press is under way, what to offer, what each does. */
export type QuickEditButtonsProps = {
  /** true while a press is being checked and its command waits: every button is off. */
  isWaitingForTheServer: boolean;
  /** true while an instance ON AIR is loaded: only then is "Atualizar" offered. */
  isUpdateOffered: boolean;
  /** true while the page's last error is the one this form's own last command left. */
  isTheErrorOfThePageFromThisForm: boolean;
  onTakePressed: () => void;
  onPreviewPressed: () => void;
  onUpdatePressed: () => void;
  onSaveAsItemPressed: () => void;
};

/**
 * The buttons under the form of "Edição rápida": "Colocar no ar" and "Prévia" always,
 * and "Atualizar" only while an instance on air is loaded. For a loaded preview there is
 * no "Atualizar": the preview is changed by previewing again, which "Prévia" does on the
 * same layer. "Salvar como item" sends nothing (it opens the item editor), so it is a
 * plain button that works without a connection. A refusal of this form's own command is
 * shown beside them.
 */
export function QuickEditButtons(props: QuickEditButtonsProps) {
  const { isWaitingForTheServer } = props;

  return (
    <>
      <ActionButton type="button" disabled={isWaitingForTheServer} onClick={props.onTakePressed}>
        {ptBR.playout.takeButton}
      </ActionButton>
      <ActionButton
        type="button"
        variant="outline"
        disabled={isWaitingForTheServer}
        onClick={props.onPreviewPressed}
      >
        {ptBR.playout.previewButton}
      </ActionButton>
      {props.isUpdateOffered && (
        <ActionButton
          type="button"
          variant="secondary"
          disabled={isWaitingForTheServer}
          onClick={props.onUpdatePressed}
        >
          {ptBR.playout.updateButton}
        </ActionButton>
      )}
      <Button
        type="button"
        variant="ghost"
        disabled={isWaitingForTheServer}
        onClick={props.onSaveAsItemPressed}
      >
        {ptBR.playout.quickEdit.saveAsItemButton}
      </Button>
      {props.isTheErrorOfThePageFromThisForm && (
        <CommandErrorMessage
          commandTypes={['takeGraphic', 'previewGraphic', 'updateInstanceData']}
        />
      )}
    </>
  );
}
