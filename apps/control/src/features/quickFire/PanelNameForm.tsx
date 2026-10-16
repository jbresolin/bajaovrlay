import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ActionButton } from '@/features/connection/ActionButton';
import { ptBR } from '@/i18n/ptBR';

/** What the form needs: its words, the name it starts with, and what to do with the name. */
export type PanelNameFormProps = {
  /** The id of the text field, so its label points at it. */
  controlId: string;
  /** "Nome do novo painel" or "Novo nome do painel". */
  fieldLabel: string;
  /** "Criar painel" or "Salvar nome". */
  submitButtonText: string;
  initialName: string;
  /** Called with the name trimmed, only when it is not empty. */
  onNameSubmitted: (panelName: string) => void;
  onCancel: () => void;
};

/**
 * The one-line form that names a panel, for "+ Painel" and for "Renomear". An empty name
 * (or spaces only) is refused here with a pt-BR message instead of being sent, because
 * the server would refuse it too. Like the other forms of the page, Enter in the field
 * does nothing; only the button sends. The form closes when its parent decides to (after
 * the press); it does not wait for the server's answer, whose refusal is shown in the strip.
 */
export function PanelNameForm(props: PanelNameFormProps) {
  const [panelName, setPanelName] = useState(props.initialName);
  const [isNameMissing, setIsNameMissing] = useState(false);
  const errorMessageId = `${props.controlId}-error`;

  function submitTheNameIfThereIsOne(): void {
    const trimmedName = panelName.trim();
    if (trimmedName === '') {
      setIsNameMissing(true);
      return;
    }
    props.onNameSubmitted(trimmedName);
  }

  return (
    <form
      onSubmit={(event) => event.preventDefault()}
      noValidate
      className="flex flex-col gap-2 rounded-md border p-2"
    >
      <Label htmlFor={props.controlId}>{props.fieldLabel}</Label>
      <Input
        id={props.controlId}
        autoComplete="off"
        value={panelName}
        aria-invalid={isNameMissing}
        aria-describedby={isNameMissing ? errorMessageId : undefined}
        onChange={(change) => setPanelName(change.target.value)}
      />
      {isNameMissing ? (
        <p id={errorMessageId} className="text-sm text-destructive">
          {ptBR.quickFire.panelNameMissing}
        </p>
      ) : null}
      <div className="flex gap-2">
        <ActionButton type="button" size="sm" onClick={submitTheNameIfThereIsOne}>
          {props.submitButtonText}
        </ActionButton>
        <Button type="button" size="sm" variant="outline" onClick={props.onCancel}>
          {ptBR.quickFire.cancelButton}
        </Button>
      </div>
    </form>
  );
}
