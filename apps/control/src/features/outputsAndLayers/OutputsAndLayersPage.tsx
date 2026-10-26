import { listLayersOfOutputBottomToTop, listOutputsProgramFirst } from '@bajaovrlay/shared';

import { ptBR } from '@/i18n/ptBR';
import { useServerState } from '@/state/ControlPageStateProvider';

import { AddOutputForm } from './AddOutputForm';
import { OutputCard } from './OutputCard';

const texts = ptBR.outputs;

/**
 * "Saídas e camadas" (#/saidas, BAJAOVRLAY-49): the outputs OBS loads as browser sources,
 * program first, each in a card with its address and its layers, and the form that adds
 * one. Everything here is read from the server's slices and changed by commands; the
 * page keeps nothing of its own, so another operator's edit shows at once.
 */
export function OutputsAndLayersPage() {
  const outputs = useServerState((state) => state.outputs);
  const layers = useServerState((state) => state.layers);
  const graphics = useServerState((state) => state.graphics);

  return (
    <main className="flex max-w-5xl flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{texts.pageTitle}</h1>
        <p className="text-muted-foreground text-sm">{texts.pageIntro}</p>
      </div>
      <AddOutputForm />
      {listOutputsProgramFirst(outputs).map((output) => (
        <OutputCard
          key={output.outputId}
          output={output}
          layersBottomToTop={listLayersOfOutputBottomToTop(layers, output.outputId)}
          graphics={graphics}
        />
      ))}
    </main>
  );
}
