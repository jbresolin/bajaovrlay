import { type Output, programOutputId } from '@bajaovrlay/shared';
import type { ReactNode } from 'react';

import { ptBR } from '@/i18n/ptBR';

/**
 * The rows of one output in Camadas, once the show has more than one (BAJAOVRLAY-49).
 * Program's group is always open: it is what OBS's main source shows, and the operator
 * must never have to unfold it to see what is on air. Each other output is a <details>
 * group, open when the page opens, that the operator may fold away with a click on its
 * name; the folding is the browser's own, so it is kept only until the page reloads.
 */
export function LayerGroupOfOutput(props: { output: Output; children: ReactNode }) {
  const groupLabel = ptBR.outputs.layerGroupLabel(props.output.name);
  const rows = <ul className="flex flex-col divide-y">{props.children}</ul>;
  if (props.output.outputId === programOutputId) {
    return (
      <div role="group" aria-label={groupLabel} className="flex flex-col gap-1">
        <h3 className="pt-1 text-xs font-semibold uppercase text-muted-foreground">
          {props.output.name}
        </h3>
        {rows}
      </div>
    );
  }
  return (
    <details open aria-label={groupLabel} className="flex flex-col gap-1 border-t pt-1">
      <summary className="cursor-pointer text-xs font-semibold uppercase text-muted-foreground">
        {props.output.name}
      </summary>
      {rows}
    </details>
  );
}
