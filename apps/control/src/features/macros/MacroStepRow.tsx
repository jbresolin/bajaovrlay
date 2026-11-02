import type { Layer, MacroStep, ObsSceneTarget } from '@bajaovrlay/shared';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from 'cn';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LayerChoiceOptions } from '@/features/outputsAndLayers/LayerChoiceOptions';
import { ptBR } from '@/i18n/ptBR';

import type { ItemChoiceForMacroStep } from './macroStepChoices';
import { isTheSceneOfTheRowMissingFromObsNow, type MacroStepDraft } from './macroStepDrafts';

/** What one step row needs. */
export type MacroStepRowProps = {
  draft: MacroStepDraft;
  /** The row's place in the list, counted from 1: "Passo 2". */
  stepNumber: number;
  itemChoices: ItemChoiceForMacroStep[];
  layers: Layer[];
  /** The scenes OBS lists now (the obs slice), in OBS's order; empty without OBS. */
  obsSceneNames: string[];
  /** The pt-BR message for this row after a press of "Salvar macro", if it is wrong. */
  errorMessage: string | undefined;
  onDraftChanged: (changedDraft: MacroStepDraft) => void;
  onRemovePressed: () => void;
};

const texts = ptBR.quickFire.macroEditor;
// The five kinds, in the order the kind dropdown lists them (as MacroStepSchema does).
const stepKindsInOrder: MacroStep['kind'][] = [
  'takeItem',
  'clearLayer',
  'clearAll',
  'obsScene',
  'wait',
];
// OBS's two outputs, in the order the target dropdown lists them.
const obsTargetsInOrder: ObsSceneTarget[] = ['program', 'preview'];

/**
 * One step of the macro editor: a handle to drag it by, its kind, then what that kind
 * needs (an item, a layer, one of OBS's scenes and its output with a note that the
 * macro's Prévia leaves OBS alone, a wait in seconds, or nothing for "Limpar tudo"),
 * "Remover",
 * and the row's message once a save found it wrong. Every control is named with the
 * step's number, so the third step's "Remover" is not the first's. Must be drawn inside
 * MacroStepList, which owns the dragging.
 * The row keeps the item, the layer and the wait text even while its kind does not use
 * them, so switching the kind back and forth loses nothing; only what the kind needs is
 * saved (macroStepDrafts.ts).
 */
export function MacroStepRow(props: MacroStepRowProps) {
  const { draft, stepNumber, itemChoices, layers, obsSceneNames, errorMessage } = props;
  const hasObsScenes = obsSceneNames.length > 0;
  const errorMessageId = `macro-step-${draft.draftId}-error`;
  const sceneWarningId = `macro-step-${draft.draftId}-scene-warning`;
  const isTheSceneMissingFromObs = isTheSceneOfTheRowMissingFromObsNow(draft, obsSceneNames);
  // A scene OBS does not list now is still offered, after OBS's own, so the picker shows
  // the step's scene instead of looking empty.
  const sceneNamesToOffer = isTheSceneMissingFromObs
    ? [...obsSceneNames, draft.sceneName]
    : obsSceneNames;
  const scenePickerDescriptionIds = [
    errorMessage === undefined ? undefined : errorMessageId,
    isTheSceneMissingFromObs ? sceneWarningId : undefined,
  ].filter((descriptionId) => descriptionId !== undefined);

  // dnd-kit's hook for one row of a sortable list, as in the rundown (RundownItemRow.tsx).
  // Unlike the rundown, the order lives in the editor until the save, so a drop really
  // moves the row.
  const {
    attributes: dragHandleAttributes,
    listeners: dragHandleListeners,
    setNodeRef: setRowElement,
    setActivatorNodeRef: setDragHandleElement,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: draft.draftId,
    attributes: { roleDescription: texts.dragAndDrop.handleRoleDescription },
  });

  function changeDraft(changedParts: Partial<MacroStepDraft>): void {
    props.onDraftChanged({ ...draft, ...changedParts });
  }

  return (
    <li
      ref={setRowElement}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      aria-label={texts.stepRowLabel(stepNumber)}
      className={cn(
        'flex flex-col gap-1.5 rounded-md border bg-card p-2',
        isDragging && 'relative z-10 opacity-70 shadow-md',
      )}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          ref={setDragHandleElement}
          {...dragHandleAttributes}
          {...dragHandleListeners}
          aria-label={texts.moveStepHandle(stepNumber)}
          className="cursor-grab touch-none rounded-sm px-1 text-sm text-muted-foreground outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {stepNumber}
        </button>
        <Select
          value={draft.kind}
          onValueChange={(kind) => changeDraft({ kind: kind as MacroStepDraft['kind'] })}
        >
          <SelectTrigger size="sm" className="flex-1" aria-label={texts.stepKindLabel(stepNumber)}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {stepKindsInOrder.map((kind) => (
              <SelectItem key={kind} value={kind}>
                {texts.stepKindNames[kind]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          size="xs"
          variant="ghost"
          aria-label={texts.removeStepButton(stepNumber)}
          onClick={props.onRemovePressed}
        >
          {texts.removeStepSymbol}
        </Button>
      </div>

      {draft.kind === 'takeItem' ? (
        <Select value={draft.itemId} onValueChange={(itemId) => changeDraft({ itemId })}>
          <SelectTrigger
            size="sm"
            className="w-full"
            aria-label={texts.itemPickerLabel(stepNumber)}
            aria-invalid={errorMessage !== undefined}
            aria-describedby={errorMessage === undefined ? undefined : errorMessageId}
          >
            <SelectValue placeholder={texts.nothingChosenPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            {itemChoices.map((choice) => (
              <SelectItem key={choice.itemId} value={choice.itemId}>
                {choice.optionName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      {draft.kind === 'clearLayer' ? (
        <Select value={draft.layerId} onValueChange={(layerId) => changeDraft({ layerId })}>
          <SelectTrigger
            size="sm"
            className="w-full"
            aria-label={texts.layerPickerLabel(stepNumber)}
            aria-invalid={errorMessage !== undefined}
            aria-describedby={errorMessage === undefined ? undefined : errorMessageId}
          >
            <SelectValue placeholder={texts.nothingChosenPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            <LayerChoiceOptions layers={layers} />
          </SelectContent>
        </Select>
      ) : null}

      {draft.kind === 'obsScene' ? (
        <>
          <div className="flex gap-2">
            <Select
              value={draft.sceneName}
              onValueChange={(sceneName) => changeDraft({ sceneName })}
            >
              <SelectTrigger
                size="sm"
                className="flex-1"
                aria-label={texts.scenePickerLabel(stepNumber)}
                aria-invalid={errorMessage !== undefined}
                aria-describedby={
                  scenePickerDescriptionIds.length === 0
                    ? undefined
                    : scenePickerDescriptionIds.join(' ')
                }
              >
                <SelectValue
                  placeholder={
                    hasObsScenes ? texts.nothingChosenPlaceholder : texts.noObsScenesPlaceholder
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {sceneNamesToOffer.map((sceneName) => (
                  <SelectItem key={sceneName} value={sceneName}>
                    {sceneName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={draft.obsTarget}
              onValueChange={(obsTarget) => changeDraft({ obsTarget: obsTarget as ObsSceneTarget })}
            >
              <SelectTrigger size="sm" aria-label={texts.obsTargetLabel(stepNumber)}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {obsTargetsInOrder.map((obsTarget) => (
                  <SelectItem key={obsTarget} value={obsTarget}>
                    {texts.obsTargetNames[obsTarget]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {isTheSceneMissingFromObs ? (
            <Badge id={sceneWarningId} variant="warning" className="w-fit">
              {texts.sceneNotFoundInObsNow}
            </Badge>
          ) : null}
          <p className="text-xs text-muted-foreground">{texts.obsSceneStepPreviewNote}</p>
        </>
      ) : null}

      {draft.kind === 'wait' ? (
        <Input
          autoComplete="off"
          inputMode="decimal"
          aria-label={texts.waitSecondsLabel(stepNumber)}
          aria-invalid={errorMessage !== undefined}
          aria-describedby={errorMessage === undefined ? undefined : errorMessageId}
          value={draft.waitSecondsText}
          onChange={(change) => changeDraft({ waitSecondsText: change.target.value })}
        />
      ) : null}

      {errorMessage === undefined ? null : (
        <p id={errorMessageId} className="text-sm text-destructive">
          {errorMessage}
        </p>
      )}
    </li>
  );
}
