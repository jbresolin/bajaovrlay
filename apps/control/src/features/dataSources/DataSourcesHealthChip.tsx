import { hashOfEachPage } from '@/app/currentPage';
import { Badge } from '@/components/ui/badge';
import { ptBR } from '@/i18n/ptBR';
import { useServerState } from '@/state/ControlPageStateProvider';

import { countEnabledDataSourcesByHealth } from './dataSourceHealth';
import { useServerAlignedTimeMs } from './useServerAlignedTimeMs';

// A late source turns "com erro" once it has failed for a minute; reading the clock once a
// second keeps the header within a second of the row chips.
const millisecondsBetweenDraws = 1_000;

/**
 * The header's chip for the data sources: "Fontes: 2 ok · 1 atrasada · 1 com erro", a
 * link that opens the "Fontes" page in a new tab (João's ruling 2 at gate 2 of PR #16),
 * so a late feed is noticed from the console and the console stays mounted. Only sources
 * that are on are counted, by the rows' rule (a source failing for a minute is "com
 * erro"); counts of zero are left out, and the chip is not drawn while no source is on.
 * Its colour is the worst health counted: red with any error, amber with any late
 * source, green otherwise. Its name for screen readers carries the counts.
 */
export function DataSourcesHealthChip() {
  const texts = ptBR.dataSources.healthChip;
  const dataSources = useServerState((state) => state.dataSources);
  // On the server's clock, as `lastOkAtMs` is (useServerAlignedTimeMs.ts).
  const nowMs = useServerAlignedTimeMs(millisecondsBetweenDraws);
  const { okCount, staleCount, errorCount } = countEnabledDataSourcesByHealth(dataSources, nowMs);

  const enabledCount = okCount + staleCount + errorCount;
  if (enabledCount === 0) {
    return null;
  }

  const countTexts: string[] = [];
  if (okCount > 0) {
    countTexts.push(texts.okCount(okCount));
  }
  if (staleCount > 0) {
    countTexts.push(texts.staleCount(staleCount));
  }
  if (errorCount > 0) {
    countTexts.push(texts.errorCount(errorCount));
  }
  const countsText = texts.countsText(countTexts);
  let variant: 'success' | 'warning' | 'destructive' = 'success';
  if (errorCount > 0) {
    variant = 'destructive';
  } else if (staleCount > 0) {
    variant = 'warning';
  }

  return (
    <span role="status" aria-label={texts.label(countsText)} className="inline-flex">
      <Badge asChild variant={variant}>
        <a href={hashOfEachPage.dataSources} target="_blank" rel="noopener">
          {texts.text(countsText)}
        </a>
      </Badge>
    </span>
  );
}
