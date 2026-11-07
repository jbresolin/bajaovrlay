import { defaultItemColor, type ItemColor, ItemColorSchema, type Macro } from '@bajaovrlay/shared';
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ActionButton } from '@/features/connection/ActionButton';
import { chipClassForEachItemColor } from '@/features/items/itemColorChip';
import { DeleteItemButton } from '@/features/rundown/DeleteItemButton';
import { ptBR } from '@/i18n/ptBR';
import { useSendCommand, useServerState } from '@/state/ControlPageStateProvider';

import { buildCreateMacroCommand, buildUpdateMacroCommand } from './macroCommandsFromEditor';
import { listItemChoicesForMacroSteps } from './macroStepChoices';
import {
  buildEmptyMacroStepDraft,
  buildMacroStepDraftsFromSteps,
  buildMacroStepsFromDrafts,
  type MacroStepDraft,
} from './macroStepDrafts';
import { MacroStepList } from './MacroStepList';
import { listGraphicFieldsOfEachItem } from './takeStepTriggerFields';

/** What the macros tab gives the editor. */
export type MacroEditorPanelProps = {
  /** The stored macro to change, or null to prepare a new one. */
  macroBeingEdited: Macro | null;
  /** Called after the server accepted a save or a delete, and when the operator cancels. */
  onClose: () => void;
};

const texts = ptBR.quickFire.macroEditor;
const labelControlId = 'macro-editor-label';
const colorControlId = 'macro-editor-color';

/**
 * The macro editor: a label, a colour and the list of steps (MacroStepList.tsx), then
 * "Salvar macro", "Excluir macro" (a stored macro, two presses) and "Cancelar". The form
 * is this editor's own until the save; nothing is sent while the operator types.
 *
 * At "Salvar macro" the label and every row are checked at once, each wrong part with its
 * pt-BR message, and nothing is sent until all pass. A "Trocar cena do OBS" row whose
 * scene OBS does not list now still saves, with a warning on the row. A new macro is sent whole
 * (`createMacro`); a stored one sends only what changed (`updateMacro`), compared with
 * the macro as it was when the editor opened. The editor closes once the server accepts,
 * and stays open after a refusal, which the strip shows (QuickFireStrip.tsx).
 */
export function MacroEditorPanel(props: MacroEditorPanelProps) {
  const items = useServerState((state) => state.items);
  const rundowns = useServerState((state) => state.rundowns);
  const panels = useServerState((state) => state.quickFirePanels);
  const layers = useServerState((state) => state.layers);
  const obsSceneNames = useServerState((state) => state.obs.sceneNames);
  const graphics = useServerState((state) => state.graphics);
  const sendCommand = useSendCommand();

  // The macro as opened; kept, never replaced by a newer copy, because "what changed" is
  // judged against the values the editor was filled with.
  const [macroAsOpened] = useState(props.macroBeingEdited);
  // Each row gets an id of its own so a drag and React can follow it; a count is enough
  // because the ids never leave this editor. The stored steps take passo-1 to passo-N
  // when the editor opens, and every row added afterwards counts on from there.
  const [drafts, setDrafts] = useState<MacroStepDraft[]>(() => {
    let storedStepsNumberedSoFar = 0;
    function numberTheNextStoredStep(): string {
      storedStepsNumberedSoFar += 1;
      return `passo-${storedStepsNumberedSoFar}`;
    }
    return macroAsOpened === null
      ? []
      : buildMacroStepDraftsFromSteps(macroAsOpened.steps, numberTheNextStoredStep);
  });
  const rowsMadeSoFarRef = useRef(macroAsOpened?.steps.length ?? 0);
  // Called only from a press of "+ Passo", never while drawing.
  function createDraftIdForANewRow(): string {
    rowsMadeSoFarRef.current += 1;
    return `passo-${rowsMadeSoFarRef.current}`;
  }

  const [label, setLabel] = useState(macroAsOpened?.label ?? '');
  const [color, setColor] = useState<ItemColor>(macroAsOpened?.color ?? defaultItemColor);
  const [isLabelMissing, setIsLabelMissing] = useState(false);
  const [errorMessageByDraftId, setErrorMessageByDraftId] = useState<Record<string, string>>({});
  const [isWaitingForTheServer, setIsWaitingForTheServer] = useState(false);

  // Answers whether the server accepted; true also when there was nothing to send.
  async function checkThenSend(): Promise<boolean> {
    const isLabelBlank = label.trim() === '';
    const stepsFromDrafts = buildMacroStepsFromDrafts(drafts);
    setIsLabelMissing(isLabelBlank);
    setErrorMessageByDraftId(stepsFromDrafts.isValid ? {} : stepsFromDrafts.errorMessageByDraftId);
    if (isLabelBlank || !stepsFromDrafts.isValid) {
      return false;
    }

    const editorValues = { label, color, steps: stepsFromDrafts.steps };
    if (macroAsOpened === null) {
      return sendCommand(buildCreateMacroCommand(editorValues));
    }
    const updateCommand = buildUpdateMacroCommand({ ...editorValues, macroAsOpened });
    if (updateCommand === undefined) {
      return true;
    }
    return sendCommand(updateCommand);
  }

  // The save button is off while its command waits for an answer, so a second click
  // cannot create the macro twice.
  async function saveThenCloseIfAccepted(): Promise<void> {
    setIsWaitingForTheServer(true);
    try {
      const wasAcceptedOrNotNeeded = await checkThenSend();
      if (wasAcceptedOrNotNeeded) {
        props.onClose();
      }
    } finally {
      setIsWaitingForTheServer(false);
    }
  }

  async function deleteThenCloseIfAccepted(macroId: string): Promise<void> {
    const wasDeleted = await sendCommand({ type: 'deleteMacro', macroId });
    if (wasDeleted) {
      props.onClose();
    }
  }

  return (
    <section aria-label={texts.panelLabel}>
      <Card>
        <CardHeader>
          <CardTitle>
            <h3>{macroAsOpened === null ? texts.newMacroTitle : texts.editMacroTitle}</h3>
          </CardTitle>
        </CardHeader>
        {/* Enter in a field does nothing, as in every form of the page. */}
        <form onSubmit={(event) => event.preventDefault()} noValidate className="contents">
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={labelControlId}>{texts.labelField}</Label>
              <Input
                id={labelControlId}
                autoComplete="off"
                value={label}
                aria-invalid={isLabelMissing}
                onChange={(change) => setLabel(change.target.value)}
              />
              {isLabelMissing ? (
                <p className="text-sm text-destructive">{texts.fieldErrors.labelMissing}</p>
              ) : null}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={colorControlId}>{texts.colorField}</Label>
              <Select value={color} onValueChange={(chosen) => setColor(chosen as ItemColor)}>
                <SelectTrigger id={colorControlId} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ItemColorSchema.options.map((itemColor) => (
                    <SelectItem key={itemColor} value={itemColor}>
                      <span
                        aria-hidden="true"
                        className={`size-3 rounded-full ${chipClassForEachItemColor[itemColor]}`}
                      />
                      {ptBR.itemEditor.colorNames[itemColor]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <h4 className="text-sm font-medium">{texts.stepsTitle}</h4>
            <MacroStepList
              drafts={drafts}
              itemChoices={listItemChoicesForMacroSteps(items, rundowns, panels)}
              graphicFieldsOfEachItem={listGraphicFieldsOfEachItem(items, graphics)}
              layers={layers}
              obsSceneNames={obsSceneNames}
              errorMessageByDraftId={errorMessageByDraftId}
              onDraftsChanged={setDrafts}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="self-start"
              onClick={() =>
                setDrafts((draftsNow) => [
                  ...draftsNow,
                  buildEmptyMacroStepDraft(createDraftIdForANewRow(), 'takeItem'),
                ])
              }
            >
              {texts.addStepButton}
            </Button>
          </CardContent>
          <CardFooter className="flex flex-wrap items-center gap-2">
            <ActionButton
              type="button"
              size="sm"
              disabled={isWaitingForTheServer}
              onClick={() => void saveThenCloseIfAccepted()}
            >
              {texts.saveButton}
            </ActionButton>
            {macroAsOpened === null ? null : (
              <DeleteItemButton
                texts={{
                  deleteButton: texts.deleteButton,
                  confirmButton: texts.deleteConfirmButton,
                }}
                onDeleteConfirmed={() => void deleteThenCloseIfAccepted(macroAsOpened.id)}
              />
            )}
            <Button type="button" size="sm" variant="outline" onClick={props.onClose}>
              {texts.cancelButton}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </section>
  );
}
