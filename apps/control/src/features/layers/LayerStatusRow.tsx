import type { Instance, Layer } from '@bajaovrlay/shared';

import { ActionButton } from '@/features/connection/ActionButton';
import { formatRelativeTimePtBR } from '@/i18n/formatRelativeTimePtBR';
import { ptBR } from '@/i18n/ptBR';

import { InstanceStatusBadge } from './InstanceStatusBadge';

/** What one row needs: its layer, what is on it (if anything), and how to clear it. */
export type LayerStatusRowProps = {
  layer: Layer;
  /** The instance on this layer's program output, or undefined when the layer is empty. */
  instanceOnProgram: Instance | undefined;
  /** The on-air graphic's display name; ignored when the layer is empty. */
  graphicName: string;
  currentTime: Date;
  onClearPressed: () => void;
};

/**
 * One line of the layer panel: the layer's name, what is on it and since when, its
 * status badge, and the "Limpar" button. An empty layer says "vazia". A graphic that
 * failed stays on its row until the operator clears the layer or takes again.
 */
export function LayerStatusRow(props: LayerStatusRowProps) {
  const { layer, instanceOnProgram, graphicName, currentTime, onClearPressed } = props;

  return (
    <li aria-label={layer.name} className="flex items-center justify-between gap-3 py-3">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-sm font-medium">{layer.name}</span>
        {instanceOnProgram === undefined ? (
          <span className="text-sm text-muted-foreground">{ptBR.layers.emptyLayer}</span>
        ) : (
          <span className="flex flex-wrap items-center gap-2 text-sm">
            <span className="truncate">{graphicName}</span>
            <span className="text-muted-foreground">
              {formatRelativeTimePtBR(new Date(instanceOnProgram.takenAt), currentTime)}
            </span>
            <InstanceStatusBadge
              status={instanceOnProgram.status}
              statusDetail={instanceOnProgram.statusDetail}
            />
          </span>
        )}
      </div>
      {/* Always pressable when connected, even on an empty layer: clearing an empty
          layer is harmless, and a panic press must never find a dead button. */}
      <ActionButton variant="outline" size="sm" onClick={onClearPressed}>
        {ptBR.layers.clearLayerButton}
      </ActionButton>
    </li>
  );
}
