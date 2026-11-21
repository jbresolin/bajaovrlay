import { Badge } from '@/components/ui/badge';
import { ptBR } from '@/i18n/ptBR';

import type { SourceReadingOfQuickCarPick } from './quickCarPickStart';

const texts = ptBR.quickCarPick;

/**
 * The line of "Escolher carros" (BAJAOVRLAY-82) naming the source the cars are read from
 * and whether they stay live, with Camadas' own "fonte atrasada" chip while its data is
 * stale (the read-out and the suggestions are then the last good data, not the race now).
 * With no source it says why: none sends positions, or several do and the item reads none.
 */
export function QuickCarPickSourceLine(props: {
  sourceReading: SourceReadingOfQuickCarPick;
  isSourceStale: boolean;
}) {
  const { sourceReading } = props;
  if (sourceReading.status === 'noSourceWithPositions') {
    return <p className="text-xs text-muted-foreground">{texts.noSourceWithPositions}</p>;
  }
  if (sourceReading.status === 'severalSourcesWithPositions') {
    return <p className="text-xs text-muted-foreground">{texts.severalSourcesWithPositions}</p>;
  }
  const { source } = sourceReading;
  return (
    <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span>{texts.sourceLine(source.sourceLabel, source.isLive)}</span>
      {props.isSourceStale ? (
        <Badge variant="warning">{ptBR.bindings.chips.sourceLate}</Badge>
      ) : null}
    </p>
  );
}
