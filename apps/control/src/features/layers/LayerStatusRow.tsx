import type { Instance, Layer } from '@bajaovrlay/shared';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ActionButton } from '@/features/connection/ActionButton';
import { ItemLabelOnAir } from '@/features/layers/ItemLabelOnAir';
import { formatRelativeTimePtBR } from '@/i18n/formatRelativeTimePtBR';
import { ptBR } from '@/i18n/ptBR';

import { InstanceStatusBadge } from './InstanceStatusBadge';

/** What one row needs: its layer, what is on it (if anything), and how to clear it. */
export type LayerStatusRowProps = {
  layer: Layer;
  /** The instance on this layer's program output, or undefined when the layer is empty. */
  instanceOnProgram: Instance | undefined;
  /** true while the layer holds something on the preview output, whatever is on air. */
  isHoldingAPreview: boolean;
  /** true while the next take clears this layer ("vai limpar", previewClearedLayerIds). */
  isMarkedToBeCleared: boolean;
  /** The on-air graphic's display name; ignored when the layer is empty. */
  graphicName: string;
  currentTime: Date;
  onClearPressed: () => void;
  /**
   * "Prévia: limpar": mark the layer so Prévia shows it empty. Offered only with something
   * on air and while the layer is not marked yet.
   */
  onPreviewClearPressed: () => void;
  /**
   * "Editar": load the instance on air into "Edição rápida". Undefined when there is none,
   * or when the server no longer lists its graphic, whose form could not be drawn.
   */
  onEditProgramInstancePressed: (() => void) | undefined;
  /** "Editar prévia": load this layer's preview into "Edição rápida"; undefined when there is none. */
  onEditPreviewInstancePressed: (() => void) | undefined;
};

/**
 * One line of the layer panel: the layer's name, what is on it and since when, its
 * status badge, and the "Limpar" button. An empty layer says "vazia". A graphic that
 * failed stays on its row until the operator clears the layer or takes again.
 *
 * A layer that holds a preview gets the chip "em prévia" beside its name, and a layer the
 * next take clears gets "vai limpar"; the rest of the row is about the program output.
 * A row with something on air and no mark yet offers "Prévia: limpar", which only marks
 * the layer: the air changes when that preview is taken (features/outputMonitors).
 * "Editar" loads the instance on air into "Edição rápida", and "Editar prévia" the
 * layer's preview; that is the only way an instance gets there
 * (features/playout/QuickEditChoiceProvider.tsx).
 * Deliberate: the preview gets no status badge, because its status stays "loading" for
 * good (the pages that draw previews never report), so a badge would read "Carregando"
 * and mean nothing.
 */
export function LayerStatusRow(props: LayerStatusRowProps) {
  const { layer, instanceOnProgram, graphicName, currentTime, onClearPressed } = props;

  return (
    <li aria-label={layer.name} className="flex items-center justify-between gap-3 py-3">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="flex items-center gap-2">
          <span className="text-sm font-medium">{layer.name}</span>
          {props.isHoldingAPreview ? (
            <Badge variant="secondary">{ptBR.layers.inPreviewChip}</Badge>
          ) : null}
          {props.isMarkedToBeCleared ? (
            <Badge variant="secondary">{ptBR.layers.willClearChip}</Badge>
          ) : null}
        </span>
        {instanceOnProgram === undefined ? (
          <span className="text-sm text-muted-foreground">{ptBR.layers.emptyLayer}</span>
        ) : (
          <span className="flex flex-wrap items-center gap-2 text-sm">
            <ItemLabelOnAir itemId={instanceOnProgram.itemId} />
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
        <span className="flex flex-wrap items-center gap-1">
          {props.onEditProgramInstancePressed === undefined ? null : (
            <Button size="xs" variant="ghost" onClick={props.onEditProgramInstancePressed}>
              {ptBR.layers.editInstanceButton}
            </Button>
          )}
          {props.onEditPreviewInstancePressed === undefined ? null : (
            <Button size="xs" variant="ghost" onClick={props.onEditPreviewInstancePressed}>
              {ptBR.layers.editPreviewInstanceButton}
            </Button>
          )}
          {instanceOnProgram === undefined || props.isMarkedToBeCleared ? null : (
            <ActionButton size="xs" variant="ghost" onClick={props.onPreviewClearPressed}>
              {ptBR.layers.previewClearLayerButton}
            </ActionButton>
          )}
        </span>
      </div>
      {/* Always pressable when connected, even on an empty layer: clearing an empty
          layer is harmless, and a panic press must never find a dead button. */}
      <ActionButton variant="outline" size="sm" onClick={onClearPressed}>
        {ptBR.layers.clearLayerButton}
      </ActionButton>
    </li>
  );
}
