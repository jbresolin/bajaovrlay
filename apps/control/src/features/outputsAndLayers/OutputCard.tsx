import {
  type CommandInput,
  type Graphic,
  type Layer,
  type Output,
  programOutputId,
} from '@bajaovrlay/shared';
import { useId, useState } from 'react';

import { DeleteItemButton } from '@/features/rundown/DeleteItemButton';
import { ptBR } from '@/i18n/ptBR';
import { useSendCommandAndReadItsRefusal } from '@/state/ControlPageStateProvider';

import { AddLayerForm } from './AddLayerForm';
import { NameEditor } from './NameEditor';
import { OutputLayerList } from './OutputLayerList';
import { RendererAddressField } from './RendererAddressField';
import { buildRendererAddressOfOutput } from './rendererAddressOfOutput';

const texts = ptBR.outputs;

/** What one output's card needs. */
export type OutputCardProps = {
  output: Output;
  layersBottomToTop: Layer[];
  graphics: Graphic[];
};

/**
 * One output: its name (with "Renomear"), the address to paste into OBS, "Excluir saída"
 * (two presses; program has none and says why), its layers, and "Adicionar camada". Every
 * command sent from the card goes through sendFromTheCard, which keeps the refusal of the
 * newest one to show under the card's name, so a refusal is read next to what caused it
 * and never in another card.
 */
export function OutputCard(props: OutputCardProps) {
  const { output } = props;
  const headingId = useId();
  const sendCommandAndReadItsRefusal = useSendCommandAndReadItsRefusal();
  const [refusal, setRefusal] = useState<string | null>(null);
  const isProgram = output.outputId === programOutputId;

  async function sendFromTheCard(command: CommandInput): Promise<boolean> {
    const refusalOfTheCommand = await sendCommandAndReadItsRefusal(command);
    setRefusal(refusalOfTheCommand);
    return refusalOfTheCommand === null;
  }

  return (
    <section
      aria-label={output.name}
      aria-labelledby={headingId}
      className="flex flex-col gap-3 rounded-lg border p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={headingId} className="text-lg font-semibold">
          {output.name}
        </h2>
        {isProgram ? (
          <p className="text-muted-foreground text-xs">{texts.programCannotBeDeleted}</p>
        ) : (
          <DeleteItemButton
            texts={{
              deleteButton: texts.deleteOutputButton,
              confirmButton: texts.deleteOutputConfirmButton,
            }}
            onDeleteConfirmed={() =>
              void sendFromTheCard({ type: 'deleteOutput', outputId: output.outputId })
            }
          />
        )}
      </div>
      {refusal !== null && (
        <p role="alert" className="text-destructive text-sm">
          {refusal}
        </p>
      )}
      <NameEditor
        key={output.name}
        currentName={output.name}
        fieldLabel={texts.renameOutputLabel(output.name)}
        saveButtonText={texts.renameOutputButton}
        inputClassName="h-8 w-60"
        onSave={(newName) =>
          void sendFromTheCard({ type: 'renameOutput', outputId: output.outputId, name: newName })
        }
      />
      <RendererAddressField
        address={buildRendererAddressOfOutput(window.location.origin, output.outputId)}
      />
      <h3 className="text-sm font-medium">{texts.layersHeading}</h3>
      <OutputLayerList
        output={output}
        layersBottomToTop={props.layersBottomToTop}
        graphics={props.graphics}
        sendFromTheCard={sendFromTheCard}
      />
      <AddLayerForm
        output={output}
        layersOfTheOutput={props.layersBottomToTop}
        sendFromTheCard={sendFromTheCard}
      />
    </section>
  );
}
