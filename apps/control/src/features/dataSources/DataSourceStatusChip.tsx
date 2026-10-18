import type { DataSource } from '@bajaovrlay/shared';
import { useId } from 'react';

import { Badge } from '@/components/ui/badge';
import { ptBR } from '@/i18n/ptBR';

import {
  type DataSourceHealth,
  describeTimeSinceLastGoodData,
  findHealthOfDataSource,
} from './dataSourceHealth';
import { useServerAlignedTimeMs } from './useServerAlignedTimeMs';

const badgeVariantForEachHealth = {
  ok: 'success',
  stale: 'warning',
  error: 'destructive',
  off: 'secondary',
} as const satisfies Record<DataSourceHealth, string>;

// "Atrasada (há 40 s)" counts seconds, so the chip is drawn again once a second.
const millisecondsBetweenDraws = 1_000;

/** Writes the chip's word; a late source adds how long ago its last good data came. */
function writeStatusChipText(health: DataSourceHealth, source: DataSource, nowMs: number): string {
  const texts = ptBR.dataSources.statusChip;
  const lastOkAtMs = source.status.lastOkAtMs;
  if (health === 'stale' && lastOkAtMs !== undefined) {
    return texts.staleSince(describeTimeSinceLastGoodData(lastOkAtMs, nowMs));
  }
  return texts[health];
}

/**
 * The status chip of one source: green "Ok", amber "Atrasada (há 40 s)", red "Erro" or
 * grey "Desligada" (dataSourceHealth.ts says which). A late or failing source carries the
 * server's reason (`status.lastError`) in a tooltip.
 */
export function DataSourceStatusChip(props: { source: DataSource }) {
  const { source } = props;
  // On the server's clock, as `lastOkAtMs` is the server's: a tablet a few seconds off
  // would otherwise show the operator a wrong lateness.
  const nowMs = useServerAlignedTimeMs(millisecondsBetweenDraws);
  // Ties the reason to the chip for screen readers; unused when there is no reason.
  const failureReasonId = useId();

  const health = findHealthOfDataSource(source);
  const chipText = writeStatusChipText(health, source, nowMs);
  const isFailing = health === 'stale' || health === 'error';
  const failureReason = isFailing ? source.status.lastError : null;

  if (failureReason === null) {
    return <Badge variant={badgeVariantForEachHealth[health]}>{chipText}</Badge>;
  }
  // The same CSS-only tooltip as the layer panel's "Falhou" (features/layers/
  // InstanceStatusBadge.tsx), not the Radix one: that one uses up Esc while open, and
  // the console's chip shares this page's header. Shown on mouse over or keyboard focus
  // of the area around the chip, which is what makes it reachable with Tab.
  return (
    <span
      tabIndex={0}
      aria-describedby={failureReasonId}
      className="group relative inline-flex rounded-full"
    >
      <Badge variant={badgeVariantForEachHealth[health]}>{chipText}</Badge>
      <span
        id={failureReasonId}
        role="tooltip"
        className="absolute top-full left-0 z-50 mt-1 hidden w-max max-w-xs rounded-md bg-primary px-3 py-1.5 text-xs text-balance text-primary-foreground group-hover:block group-focus-visible:block"
      >
        {failureReason}
      </span>
    </span>
  );
}
