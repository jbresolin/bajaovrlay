import { hashOfEachPage } from '@/app/currentPage';
import { Badge } from '@/components/ui/badge';
import { ptBR } from '@/i18n/ptBR';
import { useServerState } from '@/state/ControlPageStateProvider';

import { countEnabledDataSourcesByHealth } from './dataSourceHealth';

/**
 * The header's chip for the data sources: "Fontes: 2 ok · 1 atrasada", a link to the
 * "Fontes" page, so a late feed is noticed from the console. Only sources that are on
 * are counted, counts of zero are left out, and the chip is not drawn while no source is
 * on. Its colour is the worst health counted: red with any error, amber with any late
 * source, green otherwise.
 */
export function DataSourcesHealthChip() {
  const texts = ptBR.dataSources.healthChip;
  const dataSources = useServerState((state) => state.dataSources);
  const { okCount, staleCount, errorCount } = countEnabledDataSourcesByHealth(dataSources);

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
  let variant: 'success' | 'warning' | 'destructive' = 'success';
  if (errorCount > 0) {
    variant = 'destructive';
  } else if (staleCount > 0) {
    variant = 'warning';
  }

  return (
    <span role="status" aria-label={texts.label} className="inline-flex">
      <Badge asChild variant={variant}>
        <a href={hashOfEachPage.dataSources}>{texts.text(countTexts)}</a>
      </Badge>
    </span>
  );
}
