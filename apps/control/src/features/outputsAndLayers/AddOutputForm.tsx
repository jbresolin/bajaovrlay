import { useId, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ActionButton } from '@/features/connection/ActionButton';
import { ptBR } from '@/i18n/ptBR';
import { useSendCommandAndReadItsRefusal } from '@/state/ControlPageStateProvider';

import { suggestOutputIdFromName } from './outputIdFromName';

const texts = ptBR.outputs;

/**
 * "Nova saída": a name and the address it gets in OBS. The address follows the name
 * (suggestOutputIdFromName) until the operator types one of their own. "Adicionar
 * saída" sends createOutput; an accepted one empties the form, a refused one shows the
 * server's reason under it.
 */
export function AddOutputForm() {
  const nameFieldId = useId();
  const addressFieldId = useId();
  const sendCommandAndReadItsRefusal = useSendCommandAndReadItsRefusal();
  const [outputName, setOutputName] = useState('');
  const [addressTypedByHand, setAddressTypedByHand] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);

  const outputId = addressTypedByHand ?? suggestOutputIdFromName(outputName);
  const isReadyToAdd = outputName.trim() !== '' && outputId !== '';

  async function addTheOutput(): Promise<void> {
    const refusalOfTheCommand = await sendCommandAndReadItsRefusal({
      type: 'createOutput',
      outputId,
      name: outputName.trim(),
    });
    setRefusal(refusalOfTheCommand);
    if (refusalOfTheCommand === null) {
      setOutputName('');
      setAddressTypedByHand(null);
    }
  }

  return (
    <section
      aria-label={texts.newOutputHeading}
      className="flex flex-col gap-2 rounded-lg border p-4"
    >
      <h2 className="text-lg font-semibold">{texts.newOutputHeading}</h2>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor={nameFieldId}>{texts.outputNameLabel}</Label>
          <Input
            id={nameFieldId}
            value={outputName}
            placeholder={texts.outputNamePlaceholder}
            onChange={(change) => setOutputName(change.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={addressFieldId}>{texts.outputIdLabel}</Label>
          <Input
            id={addressFieldId}
            value={outputId}
            className="font-mono"
            onChange={(change) => setAddressTypedByHand(change.target.value)}
          />
        </div>
        <ActionButton size="sm" disabled={!isReadyToAdd} onClick={() => void addTheOutput()}>
          {texts.addOutputButton}
        </ActionButton>
      </div>
      <p className="text-muted-foreground text-xs">{texts.outputIdHint}</p>
      {refusal !== null && (
        <p role="alert" className="text-destructive text-sm">
          {refusal}
        </p>
      )}
    </section>
  );
}
