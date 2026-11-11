import type { DataSource } from '@bajaovrlay/shared';

import { findHealthOfDataSource } from '@/features/dataSources/dataSourceHealth';
import { ptBR } from '@/i18n/ptBR';

/**
 * What "Verificar servidor" says of the data sources that are on (BAJAOVRLAY-32): the late
 * ones and the ones in error by label, by the rule the "Fontes" rows follow, or that they
 * are all ok. Nothing when no source is on: the sentence would only be noise then.
 */
export function describeTheDataSourcesThatAreOn(dataSources: DataSource[], nowMs: number): string {
  const lateLabels: string[] = [];
  const labelsInError: string[] = [];
  let enabledCount = 0;
  for (const source of dataSources) {
    const health = findHealthOfDataSource(source, nowMs);
    if (health === 'off') {
      continue;
    }
    enabledCount += 1;
    if (health === 'stale') {
      lateLabels.push(source.label);
    }
    if (health === 'error') {
      labelsInError.push(source.label);
    }
  }

  if (enabledCount === 0) {
    return '';
  }
  const sentences: string[] = [];
  if (lateLabels.length > 0) {
    sentences.push(ptBR.serverHealth.lateSources(lateLabels));
  }
  if (labelsInError.length > 0) {
    sentences.push(ptBR.serverHealth.sourcesInError(labelsInError));
  }
  if (sentences.length === 0) {
    sentences.push(ptBR.serverHealth.everySourceOk);
  }
  return sentences.join(' ');
}
