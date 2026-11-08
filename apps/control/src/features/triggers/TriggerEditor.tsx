import { type Trigger, type TriggerMode, whyTheDataRoleCannotAutomate } from '@bajaovrlay/shared';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ptBR } from '@/i18n/ptBR';
import { useSendCommandAndReadItsRefusal, useServerState } from '@/state/ControlPageStateProvider';
import { useIsTheDataRoleLoggedIn } from '@/state/operatorSessionContext';

import {
  buildEmptyTriggerFormValues,
  buildTriggerFormValues,
  readTriggerFormIntoCommand,
  type TriggerFormValues,
} from './triggerForm';
import { TriggerWhenControls } from './TriggerWhenControls';

const texts = ptBR.triggers.editor;
const modesInOrder: TriggerMode[] = ['ask', 'auto'];

/**
 * The editor of one trigger, inside "Gatilhos": its name and on/off, what it waits for
 * (TriggerWhenControls.tsx), its macro, mode and minimum interval in seconds. "Salvar
 * gatilho" sends createTrigger for a new one and updateTrigger, the whole trigger, for a
 * stored one (triggerForm.ts); "Excluir gatilho" asks once more before deleteTrigger. A
 * problem on the page or the server's refusal shows above the buttons; once the server
 * accepts, the editor closes (`onDone`) and the list shows the trigger as the server holds it.
 * For Dados (gate 2 of PR #51), "Automático" is greyed out unless the trigger already was;
 * on an auto trigger kept auto, its macro, what it waits for and switching it on are too,
 * each with the server's sentence. Set back to "Perguntar", they open again, as the server
 * judges the trigger as it would be after the save.
 */
export function TriggerEditor(props: { triggerBeingEdited: Trigger | null; onDone: () => void }) {
  const { triggerBeingEdited } = props;
  const macros = useServerState((state) => state.macros);
  const obsSceneNames = useServerState((state) => state.obs.sceneNames);
  const scheduleSlots = useServerState((state) => state.scheduleSlots);
  const sendCommandAndReadItsRefusal = useSendCommandAndReadItsRefusal();
  const [values, setValues] = useState<TriggerFormValues>(() =>
    triggerBeingEdited === null
      ? buildEmptyTriggerFormValues()
      : buildTriggerFormValues(triggerBeingEdited),
  );
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const [isWaitingForTheServer, setIsWaitingForTheServer] = useState(false);
  const [isDeleteArmed, setIsDeleteArmed] = useState(false);
  const triggerId = triggerBeingEdited?.id ?? null;
  const isTheDataRole = useIsTheDataRoleLoggedIn();
  const wasAutoWhenOpened = triggerBeingEdited?.mode === 'auto';
  const isAutoGreyedOut = isTheDataRole && !wasAutoWhenOpened;
  const isWhatItRunsLocked = isTheDataRole && wasAutoWhenOpened && values.mode === 'auto';
  const isSwitchingOnLocked = isWhatItRunsLocked && triggerBeingEdited?.isEnabled === false;

  function changeValues(changedParts: Partial<TriggerFormValues>): void {
    setValues({ ...values, ...changedParts });
  }

  /** Sends a command; closes the editor once the server accepts, else shows why not. */
  async function sendAndCloseOnSuccess(
    command: Parameters<typeof sendCommandAndReadItsRefusal>[0],
  ): Promise<void> {
    setIsWaitingForTheServer(true);
    const refusal = await sendCommandAndReadItsRefusal(command);
    setIsWaitingForTheServer(false);
    if (refusal === null) {
      props.onDone();
      return;
    }
    setProblem(refusal);
  }

  function saveTheTrigger(): void {
    const reading = readTriggerFormIntoCommand(values, triggerId);
    if (reading.status === 'problem') {
      setProblem(reading.message);
      return;
    }
    setProblem(undefined);
    void sendAndCloseOnSuccess(reading.command);
  }

  function pressDelete(): void {
    if (triggerId === null) {
      return;
    }
    if (!isDeleteArmed) {
      setIsDeleteArmed(true);
      return;
    }
    void sendAndCloseOnSuccess({ type: 'deleteTrigger', triggerId });
  }

  return (
    <section
      aria-label={
        triggerBeingEdited === null ? texts.newTitle : texts.editTitle(triggerBeingEdited.name)
      }
      className="flex flex-col gap-3"
    >
      <h3 className="text-sm font-semibold">
        {triggerBeingEdited === null ? texts.newTitle : texts.editTitle(triggerBeingEdited.name)}
      </h3>
      <div className="flex flex-col gap-1">
        <Label htmlFor="trigger-name" className="text-xs">
          {texts.nameLabel}
        </Label>
        <Input
          id="trigger-name"
          autoComplete="off"
          value={values.name}
          onChange={(change) => changeValues({ name: change.target.value })}
        />
      </div>
      <div className="flex items-center gap-2">
        <Switch
          id="trigger-enabled"
          disabled={isSwitchingOnLocked}
          checked={values.isEnabled}
          onCheckedChange={(isEnabled) => changeValues({ isEnabled })}
        />
        <Label htmlFor="trigger-enabled">{texts.enabledLabel}</Label>
      </div>

      <TriggerWhenControls
        values={values}
        onValuesChanged={changeValues}
        triggerId={triggerId}
        obsSceneNames={obsSceneNames}
        scheduleSlots={scheduleSlots}
        isLocked={isWhatItRunsLocked}
      />

      {/* Named on screen like the name and the interval (BAJAOVRLAY-59): the two selects
          showed "Escolha…" and "Perguntar" with nothing saying what they choose. */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <Label htmlFor="trigger-macro" className="text-xs">
            {texts.macroLabel}
          </Label>
          <Select
            value={values.macroId}
            disabled={isWhatItRunsLocked}
            onValueChange={(macroId) => changeValues({ macroId })}
          >
            <SelectTrigger
              id="trigger-macro"
              size="sm"
              className="w-full"
              aria-label={texts.macroLabel}
            >
              <SelectValue placeholder={texts.nothingChosenPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {macros.map((macro) => (
                <SelectItem key={macro.id} value={macro.id}>
                  {macro.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <Label htmlFor="trigger-mode" className="text-xs">
            {texts.modeLabel}
          </Label>
          <Select
            value={values.mode}
            onValueChange={(mode) => changeValues({ mode: mode as TriggerMode })}
          >
            <SelectTrigger
              id="trigger-mode"
              size="sm"
              className="w-full"
              aria-label={texts.modeLabel}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {modesInOrder.map((mode) => (
                <SelectItem key={mode} value={mode} disabled={mode === 'auto' && isAutoGreyedOut}>
                  {texts.modeNames[mode]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {isAutoGreyedOut ? (
        <p className="text-xs text-muted-foreground">
          {whyTheDataRoleCannotAutomate.settingATriggerToAuto}
        </p>
      ) : null}
      {isWhatItRunsLocked ? (
        <p className="text-xs text-muted-foreground">
          {whyTheDataRoleCannotAutomate.changingAnAutoTrigger}
        </p>
      ) : null}
      <div className="flex flex-col gap-1">
        <Label htmlFor="trigger-interval" className="text-xs">
          {texts.intervalLabel}
        </Label>
        <Input
          id="trigger-interval"
          autoComplete="off"
          inputMode="numeric"
          value={values.minimumIntervalSecondsText}
          onChange={(change) => changeValues({ minimumIntervalSecondsText: change.target.value })}
        />
      </div>

      {problem === undefined ? null : (
        <p role="alert" className="text-sm text-destructive">
          {problem}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={isWaitingForTheServer} onClick={saveTheTrigger}>
          {texts.saveButton}
        </Button>
        {triggerId === null ? null : (
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={isWaitingForTheServer}
            onClick={pressDelete}
          >
            {isDeleteArmed ? texts.deleteConfirmButton : texts.deleteButton}
          </Button>
        )}
        <Button type="button" size="sm" variant="ghost" onClick={props.onDone}>
          {texts.backButton}
        </Button>
      </div>
    </section>
  );
}
