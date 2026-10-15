import type { Command } from '@bajaovrlay/shared';

import { Button } from '@/components/ui/button';
import { ActionButton } from '@/features/connection/ActionButton';
import { CommandErrorMessage } from '@/features/playout/CommandErrorMessage';
import { ptBR } from '@/i18n/ptBR';

/** What the row of buttons needs from the editor. */
export type ItemEditorButtonsProps = {
  /** true while a press is checked and its commands wait: both save buttons are off. */
  isWaitingForTheServer: boolean;
  /** true while the stored item has an instance on the program output. */
  isItemOnAir: boolean;
  /** The command types this opening of the editor sent; their refusals are shown here. */
  commandTypesSentInThisOpening: Command['type'][];
  onSavePressed: () => void;
  onUpdateOnAirPressed: () => void;
  onCancelPressed: () => void;
};

/**
 * The bottom row of the item editor: "Salvar item", "Atualizar no ar" (only while the
 * item is on air), "Cancelar", and the refusal of a command this opening sent. Drawing
 * only; what each press does is ItemEditorPanel.tsx. "Cancelar" stays on during a press,
 * so the operator can always leave.
 */
export function ItemEditorButtons(props: ItemEditorButtonsProps) {
  const hasSentACommandInThisOpening = props.commandTypesSentInThisOpening.length > 0;
  return (
    <>
      <ActionButton
        type="button"
        disabled={props.isWaitingForTheServer}
        onClick={props.onSavePressed}
      >
        {ptBR.itemEditor.saveButton}
      </ActionButton>
      {props.isItemOnAir && (
        <ActionButton
          type="button"
          variant="secondary"
          disabled={props.isWaitingForTheServer}
          onClick={props.onUpdateOnAirPressed}
        >
          {ptBR.itemEditor.updateOnAirButton}
        </ActionButton>
      )}
      <Button type="button" variant="outline" onClick={props.onCancelPressed}>
        {ptBR.itemEditor.cancelButton}
      </Button>
      {hasSentACommandInThisOpening && (
        <CommandErrorMessage commandTypes={props.commandTypesSentInThisOpening} />
      )}
    </>
  );
}
