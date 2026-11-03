import type { ScheduleSlot, TriggerDataEventKind, TriggerWhen } from '@bajaovrlay/shared';
import type { ReactNode } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ptBR } from '@/i18n/ptBR';

import { HttpTriggerAddress } from './HttpTriggerAddress';
import { everySlotChoice, type TriggerFormValues } from './triggerForm';

const texts = ptBR.triggers.editor;

// The four kinds, in the order the "Quando" dropdown lists them.
const kindsInOrder: TriggerWhen['kind'][] = ['obsScene', 'http', 'dataEvent', 'schedule'];
const dataEventKindsInOrder: TriggerDataEventKind[] = [
  'penalty',
  'fastestLap',
  'leaderChange',
  'incident',
];

/** A dropdown of the editor: its label is its accessible name, the options as given. */
function EditorDropdown(props: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <Select value={props.value} onValueChange={props.onValueChange}>
      <SelectTrigger size="sm" className="w-full" aria-label={props.label}>
        <SelectValue placeholder={texts.nothingChosenPlaceholder} />
      </SelectTrigger>
      <SelectContent>{props.children}</SelectContent>
    </Select>
  );
}

/** A text field of the editor with its label above. */
function EditorTextField(props: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  inputMode?: 'numeric' | 'text';
  list?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={props.id} className="text-xs">
        {props.label}
      </Label>
      <Input
        id={props.id}
        autoComplete="off"
        inputMode={props.inputMode ?? 'text'}
        list={props.list}
        value={props.value}
        onChange={(change) => props.onChange(change.target.value)}
      />
    </div>
  );
}

/**
 * The "Quando" part of the trigger editor: the kind, then what that kind needs. A scene is
 * typed, with OBS's scenes offered as suggestions (a datalist), so a trigger can be set up
 * while OBS is closed. A schedule is a time of day, or minutes before or after one slot of
 * Programação or every slot. An HTTP trigger shows its address (HttpTriggerAddress.tsx).
 */
export function TriggerWhenControls(props: {
  values: TriggerFormValues;
  onValuesChanged: (changedParts: Partial<TriggerFormValues>) => void;
  /** The stored trigger's id, for an HTTP trigger's address; null while it is new. */
  triggerId: string | null;
  obsSceneNames: string[];
  scheduleSlots: ScheduleSlot[];
}) {
  const { values, onValuesChanged } = props;
  return (
    <div className="flex flex-col gap-2">
      <EditorDropdown
        label={texts.kindLabel}
        value={values.kind}
        onValueChange={(kind) => onValuesChanged({ kind: kind as TriggerWhen['kind'] })}
      >
        {kindsInOrder.map((kind) => (
          <SelectItem key={kind} value={kind}>
            {texts.kindNames[kind]}
          </SelectItem>
        ))}
      </EditorDropdown>

      {values.kind === 'obsScene' ? (
        <>
          <EditorDropdown
            label={texts.sceneChangeLabel}
            value={values.sceneChange}
            onValueChange={(sceneChange) =>
              onValuesChanged({ sceneChange: sceneChange as TriggerFormValues['sceneChange'] })
            }
          >
            <SelectItem value="entered">{texts.sceneChangeNames.entered}</SelectItem>
            <SelectItem value="left">{texts.sceneChangeNames.left}</SelectItem>
          </EditorDropdown>
          <EditorTextField
            id="trigger-scene-name"
            label={texts.sceneNameLabel}
            value={values.sceneName}
            list="trigger-obs-scene-names"
            onChange={(sceneName) => onValuesChanged({ sceneName })}
          />
          <datalist id="trigger-obs-scene-names">
            {props.obsSceneNames.map((sceneName) => (
              <option key={sceneName} value={sceneName} />
            ))}
          </datalist>
          <p className="text-xs text-muted-foreground">{texts.sceneNameHint}</p>
        </>
      ) : null}

      {values.kind === 'http' ? <HttpTriggerAddress triggerId={props.triggerId} /> : null}

      {values.kind === 'dataEvent' ? (
        <EditorDropdown
          label={texts.dataEventKindLabel}
          value={values.dataEventKind}
          onValueChange={(dataEventKind) =>
            onValuesChanged({ dataEventKind: dataEventKind as TriggerDataEventKind })
          }
        >
          {dataEventKindsInOrder.map((dataEventKind) => (
            <SelectItem key={dataEventKind} value={dataEventKind}>
              {texts.dataEventKindNames[dataEventKind]}
            </SelectItem>
          ))}
        </EditorDropdown>
      ) : null}

      {values.kind === 'schedule' ? (
        <ScheduleControls
          values={values}
          onValuesChanged={onValuesChanged}
          scheduleSlots={props.scheduleSlots}
        />
      ) : null}
    </div>
  );
}

/** A schedule's controls: a time of day, or minutes before or after a slot. */
function ScheduleControls(props: {
  values: TriggerFormValues;
  onValuesChanged: (changedParts: Partial<TriggerFormValues>) => void;
  scheduleSlots: ScheduleSlot[];
}) {
  const { values, onValuesChanged } = props;
  return (
    <>
      <EditorDropdown
        label={texts.scheduleMomentKindLabel}
        value={values.scheduleMomentKind}
        onValueChange={(scheduleMomentKind) =>
          onValuesChanged({
            scheduleMomentKind: scheduleMomentKind as TriggerFormValues['scheduleMomentKind'],
          })
        }
      >
        <SelectItem value="timeOfDay">{texts.scheduleMomentKindNames.timeOfDay}</SelectItem>
        <SelectItem value="slotStart">{texts.scheduleMomentKindNames.slotStart}</SelectItem>
      </EditorDropdown>
      {values.scheduleMomentKind === 'timeOfDay' ? (
        <EditorTextField
          id="trigger-time-of-day"
          label={texts.timeOfDayLabel}
          value={values.timeOfDay}
          inputMode="numeric"
          onChange={(timeOfDay) => onValuesChanged({ timeOfDay })}
        />
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <EditorTextField
            id="trigger-minutes"
            label={texts.minutesLabel}
            value={values.minutesText}
            inputMode="numeric"
            onChange={(minutesText) => onValuesChanged({ minutesText })}
          />
          <EditorDropdown
            label={texts.slotDirectionLabel}
            value={values.slotDirection}
            onValueChange={(slotDirection) =>
              onValuesChanged({
                slotDirection: slotDirection as TriggerFormValues['slotDirection'],
              })
            }
          >
            <SelectItem value="before">{texts.slotDirectionNames.before}</SelectItem>
            <SelectItem value="after">{texts.slotDirectionNames.after}</SelectItem>
          </EditorDropdown>
          <EditorDropdown
            label={texts.slotLabel}
            value={values.slotChoice}
            onValueChange={(slotChoice) => onValuesChanged({ slotChoice })}
          >
            <SelectItem value={everySlotChoice}>{texts.everySlot}</SelectItem>
            {props.scheduleSlots.map((slot) => (
              <SelectItem key={slot.slotId} value={slot.slotId}>
                {slot.sessionName}
              </SelectItem>
            ))}
          </EditorDropdown>
        </div>
      )}
    </>
  );
}
