import type { DataSnapshotShapes } from '@bajaovrlay/shared';
import { useId, useState } from 'react';

import { Button } from '@/components/ui/button';
import { ptBR } from '@/i18n/ptBR';

/**
 * "Exibir JSON": the selected source's data exactly as the server holds it, for checking
 * a feed field by field (what a binding will point at). Hidden until asked for: a
 * 60-car snapshot is long.
 */
export function RawSnapshotJson(props: { shapes: DataSnapshotShapes }) {
  const texts = ptBR.dataSources.detail;
  const [isShown, setIsShown] = useState(false);
  const jsonBlockId = useId();

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="outline"
        size="sm"
        className="w-fit"
        aria-expanded={isShown}
        aria-controls={jsonBlockId}
        onClick={() => setIsShown(!isShown)}
      >
        {isShown ? texts.hideJsonButton : texts.showJsonButton}
      </Button>
      {isShown && (
        <pre
          id={jsonBlockId}
          className="max-h-96 overflow-auto rounded-md bg-muted p-3 font-mono text-xs"
        >
          {JSON.stringify(props.shapes, null, 2)}
        </pre>
      )}
    </div>
  );
}
