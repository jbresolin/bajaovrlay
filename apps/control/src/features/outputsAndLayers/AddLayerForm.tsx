import type { CommandInput, Layer, Output } from '@bajaovrlay/shared';
import { useId, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ActionButton } from '@/features/connection/ActionButton';
import { makeRecordId } from '@/features/entityLibrary/recordId';
import { ptBR } from '@/i18n/ptBR';

import { findHeightOfANewLayer } from './heightOfANewLayer';

const texts = ptBR.outputs;

/** What the form needs: its output, that output's layers, and how its card sends. */
export type AddLayerFormProps = {
  output: Output;
  layersOfTheOutput: Layer[];
  /** Sends a command from this card; answers whether the server accepted it. */
  sendFromTheCard: (command: CommandInput) => Promise<boolean>;
};

/**
 * "Adicionar camada": a name, and the layer goes on top of the output
 * (findHeightOfANewLayer), swapped "out-then-in" and not persistent, the seed's safest
 * defaults; the row's own controls change them afterwards. The id is made here, as an
 * entity's is (decision recorded in docs/decisions.md), so it never depends on the name.
 */
export function AddLayerForm(props: AddLayerFormProps) {
  const nameFieldId = useId();
  const [layerName, setLayerName] = useState('');
  const isReadyToAdd = layerName.trim() !== '';

  async function addTheLayer(): Promise<void> {
    const isAccepted = await props.sendFromTheCard({
      type: 'createLayer',
      layerId: makeRecordId(),
      outputId: props.output.outputId,
      name: layerName.trim(),
      zIndex: findHeightOfANewLayer(props.layersOfTheOutput),
      replacePolicy: 'out-then-in',
      persistent: false,
    });
    if (isAccepted) {
      setLayerName('');
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={nameFieldId} className="sr-only">
        {texts.newLayerNameLabel(props.output.name)}
      </Label>
      <div className="flex items-center gap-2">
        <Input
          id={nameFieldId}
          value={layerName}
          placeholder={texts.newLayerNamePlaceholder}
          onChange={(change) => setLayerName(change.target.value)}
        />
        <ActionButton size="sm" disabled={!isReadyToAdd} onClick={() => void addTheLayer()}>
          {texts.addLayerButton}
        </ActionButton>
      </div>
      <p className="text-muted-foreground text-xs">{texts.addLayerHint}</p>
    </div>
  );
}
