import type { Graphic, Instance, Layer } from '@bajaovrlay/shared';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BoundSourceChips } from '@/features/bindings/BoundSourceChips';
import { ActionButton } from '@/features/connection/ActionButton';
import { EventMarkOnLayer } from '@/features/events/EventMarkOnLayer';
import { ItemLabelOnAir } from '@/features/layers/ItemLabelOnAir';
import { UndoOnLayerButton } from '@/features/undo/UndoOnLayerButton';
import { formatRelativeTimePtBR } from '@/i18n/formatRelativeTimePtBR';
import { ptBR } from '@/i18n/ptBR';

import { ChangedOnAirChip } from './ChangedOnAirChip';
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
  /** The on-air graphic as the server lists it, or undefined (for its clock fields). */
  graphicOnProgram: Graphic | undefined;
  currentTime: Date;
  onClearPressed: () => void;
  /**
   * What "Desfazer" brings back ("Volta: "Tarja – Ana Souza"", BAJAOVRLAY-30), for its
   * tooltip; undefined when the server remembers no change of this layer, and then the
   * row offers no "Desfazer".
   */
  whatUndoBringsBack: string | undefined;
  /** "Desfazer": put back what the layer's program showed before its last change. */
  onUndoPressed: () => void;
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
  /**
   * The titles of the fields changed on air on the instance on program; empty when
   * nothing was, and then no chip "alterado no ar" is drawn.
   */
  changedFieldTitles: string[];
  /**
   * The titles of the fields changed with "Atualizar prévia" on the layer's preview; the
   * chip beside "em prévia" only informs (the list goes to program with "Tomar").
   */
  changedInPreviewFieldTitles: string[];
  /** true while this row's "Salvar no item" waits for the server: the button is off. */
  isSaveIntoItemWaiting: boolean;
  /**
   * "Salvar no item": keep the change on air in the item. Undefined when nothing was
   * changed, or when the item was deleted ("item excluído": there is nothing to save into).
   */
  onSaveIntoItemPressed: (() => void) | undefined;
  /** "Salvar como item": only for an instance on program with no item ("sem item"). */
  onSaveAsItemPressed: (() => void) | undefined;
  /**
   * Where a graphic shown in steps is ("Passo 2 de 4", counting from 1), for the instance
   * on program; undefined for a graphic of one step or an empty layer (BAJAOVRLAY-47).
   */
  stepOnProgram: { stepNumber: number; stepCount: number } | undefined;
  /** "Próximo": the next step; undefined on the last one, where the button is off. */
  onNextStepPressed: (() => void) | undefined;
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
 * Every row with something on air names its item (ItemLabelOnAir.tsx). One changed on
 * air carries the chip "alterado no ar" and offers "Salvar no item"; one with no item
 * offers "Salvar como item" (BAJAOVRLAY-37). A preview changed with "Atualizar prévia"
 * carries the chip beside "em prévia", for information only. A row whose instance reads a
 * source live says when that source is late, failing or deleted, and when a correction
 * changed a bound value (features/bindings/BoundSourceChips.tsx, BAJAOVRLAY-20).
 * A graphic shown in steps (the podium) says where it is, "Passo 2 de 4", and offers
 * "Próximo" (nextOnLayer, BAJAOVRLAY-47), off on its last step. A layer with a change to
 * undo offers "Desfazer" beside "Limpar", its tooltip saying what comes back (BAJAOVRLAY-30).
 * Deliberate: the preview gets no status badge, because its status stays "loading" for
 * good (the pages that draw previews never report), so a badge would read "Carregando"
 * and mean nothing.
 */
export function LayerStatusRow(props: LayerStatusRowProps) {
  const { layer, instanceOnProgram, graphicName, currentTime, onClearPressed } = props;

  return (
    // One line where it fits (BAJAOVRLAY-59): the layer, what is on air, the row's small
    // buttons, then "Limpar" at the right end. Each part keeps its own content together.
    <li aria-label={layer.name} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
      {/* 5rem wide at least, so what is on air starts at the same place on the rows of the
          seeded layers ("Tela cheia" is the longest name). */}
      <span className="flex min-w-20 items-center gap-2">
        <span className="text-sm font-medium">{layer.name}</span>
        {props.isHoldingAPreview ? (
          <Badge variant="secondary">{ptBR.layers.inPreviewChip}</Badge>
        ) : null}
        {props.changedInPreviewFieldTitles.length === 0 ? null : (
          <ChangedOnAirChip
            changedFieldTitles={props.changedInPreviewFieldTitles}
            output="preview"
          />
        )}
        {props.isMarkedToBeCleared ? (
          <Badge variant="secondary">{ptBR.layers.willClearChip}</Badge>
        ) : null}
      </span>
      {/* Counted as 12rem when the row decides what fits on its first line, then grows
          into the room the buttons leave: so the buttons stay on the first line, "Limpar"
          at the same place on every row, and a long label or chip wraps inside this part
          instead of pushing them down. In a column too narrow even for that, the buttons
          wrap whole onto the next line. */}
      {instanceOnProgram === undefined ? (
        <span className="grow basis-48 text-sm text-muted-foreground">
          {ptBR.layers.emptyLayer}
        </span>
      ) : (
        <span className="flex min-w-0 grow basis-48 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <ItemLabelOnAir itemId={instanceOnProgram.itemId} />
          <EventMarkOnLayer eventId={instanceOnProgram.eventId} />
          <span className="truncate">{graphicName}</span>
          {props.changedFieldTitles.length === 0 ? null : (
            <ChangedOnAirChip changedFieldTitles={props.changedFieldTitles} output="program" />
          )}
          <span className="text-muted-foreground">
            {formatRelativeTimePtBR(new Date(instanceOnProgram.takenAt), currentTime)}
          </span>
          <InstanceStatusBadge
            status={instanceOnProgram.status}
            statusDetail={instanceOnProgram.statusDetail}
          />
          <BoundSourceChips instance={instanceOnProgram} graphic={props.graphicOnProgram} />
          {props.stepOnProgram === undefined ? null : (
            <span className="text-muted-foreground">
              {ptBR.layers.stepOfSteps(
                props.stepOnProgram.stepNumber,
                props.stepOnProgram.stepCount,
              )}
            </span>
          )}
        </span>
      )}
      {/* The row's buttons, at its right end: the small ones, then "Desfazer" and "Limpar".
          They move to the next line together, never one by one, and split only in a
          column too narrow for all of them. */}
      <span className="ml-auto flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
        <span className="flex items-center gap-1">
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
            <ActionButton
              size="xs"
              variant="ghost"
              commandType="previewClearLayer"
              onClick={props.onPreviewClearPressed}
            >
              {ptBR.layers.previewClearLayerButton}
            </ActionButton>
          )}
          {props.onSaveIntoItemPressed === undefined ? null : (
            <ActionButton
              size="xs"
              variant="ghost"
              commandType="saveOnAirChangesIntoItem"
              disabled={props.isSaveIntoItemWaiting}
              onClick={props.onSaveIntoItemPressed}
            >
              {ptBR.layers.saveIntoItemButton}
            </ActionButton>
          )}
          {props.onSaveAsItemPressed === undefined ? null : (
            <Button size="xs" variant="ghost" onClick={props.onSaveAsItemPressed}>
              {ptBR.layers.saveAsItemButton}
            </Button>
          )}
        </span>
        <span className="flex items-center gap-2">
          {/* Off on the last step rather than gone, so the operator sees the graphic is done
            and that "Limpar" is what comes next. */}
          {props.stepOnProgram === undefined ? null : (
            <ActionButton
              variant="outline"
              size="sm"
              commandType="nextOnLayer"
              disabledReason={
                props.onNextStepPressed === undefined
                  ? ptBR.layers.nextStepOffOnTheLastStep
                  : undefined
              }
              onClick={props.onNextStepPressed}
            >
              {ptBR.layers.nextStepButton}
            </ActionButton>
          )}
          {props.whatUndoBringsBack === undefined ? null : (
            <UndoOnLayerButton
              whatComesBack={props.whatUndoBringsBack}
              onPressed={props.onUndoPressed}
            />
          )}
          {/* Always pressable when connected, even on an empty layer: clearing an empty
            layer is harmless, and a panic press must never find a dead button. */}
          <ActionButton variant="outline" size="sm" commandType="clearLayer" onClick={onClearPressed}>
            {ptBR.layers.clearLayerButton}
          </ActionButton>
        </span>
      </span>
    </li>
  );
}
