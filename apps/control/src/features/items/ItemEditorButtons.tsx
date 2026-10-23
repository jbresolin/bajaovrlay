import type { Command } from '@bajaovrlay/shared';

import { Button } from '@/components/ui/button';
import { ActionButton } from '@/features/connection/ActionButton';
import { CommandErrorMessage } from '@/features/playout/CommandErrorMessage';
import { ptBR } from '@/i18n/ptBR';

/** What the row of buttons needs from the editor. */
export type ItemEditorButtonsProps = {
  /** true while a press is checked and its commands wait: the save buttons are off. */
  isWaitingForTheServer: boolean;
  /**
   * true while a new item has no graphic chosen yet: the save buttons are off and a
   * line says why, since there is nothing to save or to put on air.
   */
  isGraphicStillToBeChosen: boolean;
  /** true while the stored item has an instance on the program output. */
  isItemOnAir: boolean;
  /** The command types this opening of the editor sent; their refusals are shown here. */
  commandTypesSentInThisOpening: Command['type'][];
  onSavePressed: () => void;
  onSaveAndTakePressed: () => void;
  onSaveAndPreviewPressed: () => void;
  onUpdateOnAirPressed: () => void;
  onCancelPressed: () => void;
};

/**
 * The bottom row of the item editor: "Salvar item", "Salvar e disparar" and "Salvar e
 * prévia" (save, then take or preview this item: everything on air comes from an item),
 * "Atualizar no ar" (only while the item is on air), "Cancelar", and the refusal of a
 * command this opening sent. Drawing only; what each press does is useItemEditorSaves.ts.
 * The save buttons are off while a press waits for the server and while a new item has
 * no graphic chosen yet (a line beside them says so); the form's own rule "Escolha o
 * gráfico." stays as the second guard. "Cancelar" stays on during a press, so the
 * operator can always leave.
 */
export function ItemEditorButtons(props: ItemEditorButtonsProps) {
  const hasSentACommandInThisOpening = props.commandTypesSentInThisOpening.length > 0;
  const areSaveButtonsOff = props.isWaitingForTheServer || props.isGraphicStillToBeChosen;
  return (
    <>
      <ActionButton type="button" disabled={areSaveButtonsOff} onClick={props.onSavePressed}>
        {ptBR.itemEditor.saveButton}
      </ActionButton>
      <ActionButton
        type="button"
        variant="secondary"
        disabled={areSaveButtonsOff}
        onClick={props.onSaveAndTakePressed}
      >
        {ptBR.itemEditor.saveAndTakeButton}
      </ActionButton>
      <ActionButton
        type="button"
        variant="outline"
        disabled={areSaveButtonsOff}
        onClick={props.onSaveAndPreviewPressed}
      >
        {ptBR.itemEditor.saveAndPreviewButton}
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
      {props.isGraphicStillToBeChosen && (
        <p role="status" className="text-sm text-muted-foreground">
          {ptBR.itemEditor.saveNeedsAGraphic}
        </p>
      )}
      {hasSentACommandInThisOpening && (
        <CommandErrorMessage commandTypes={props.commandTypesSentInThisOpening} />
      )}
    </>
  );
}
