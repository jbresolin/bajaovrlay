import { ActionButton } from '@/features/connection/ActionButton';
import { ptBR } from '@/i18n/ptBR';

import { CommandErrorMessage } from './CommandErrorMessage';

/** What the button needs: whether a press is under way, which output, what it does. */
export type QuickEditButtonsProps = {
  /** true while a press is being checked and its command waits: the button is off. */
  isWaitingForTheServer: boolean;
  /** The output of the loaded instance: it decides the button's words. */
  outputOfTheInstance: 'program' | 'preview';
  /** true while the page's last error is the one this form's own last command left. */
  isTheErrorOfThePageFromThisForm: boolean;
  onUpdatePressed: () => void;
};

/**
 * The one button under the form of "Edição rápida": "Atualizar" for an instance on air,
 * "Atualizar prévia" for a loaded preview. Both change the loaded instance in place.
 * Since BAJAOVRLAY-37 there is no "Colocar no ar", "Prévia" or "Salvar como item" here:
 * a new graphic is a new item. A refusal of this form's own command is shown beside it.
 */
export function QuickEditButtons(props: QuickEditButtonsProps) {
  const buttonWords =
    props.outputOfTheInstance === 'program'
      ? ptBR.playout.updateButton
      : ptBR.playout.quickEdit.updatePreviewButton;
  return (
    <>
      <ActionButton
        type="button"
        disabled={props.isWaitingForTheServer}
        onClick={props.onUpdatePressed}
      >
        {buttonWords}
      </ActionButton>
      {props.isTheErrorOfThePageFromThisForm && (
        <CommandErrorMessage commandTypes={['updateInstanceData']} />
      )}
    </>
  );
}
