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
import { Switch } from '@/components/ui/switch';
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
 * while OBS is closed. A schedule is a time of day, minutes before or after one slot of
 * Programação or every slot, or every N minutes, all day or between two times of the day
 * (BAJAOVRLAY-64). An HTTP trigger shows its address (HttpTriggerAddress.tsx).
 */
export function TriggerWhenControls(props: {
  values: TriggerFormValues;
  onValuesChanged: (changedParts: Partial<TriggerFormValues>) => void;
  /** The stored trigger's id, for an HTTP trigger's address; null while it is new. */
  triggerId: string | null;
  obsSceneNames: string[];
  scheduleSlots: ScheduleSlot[];
  /** True while Dados edits an auto trigger: what it waits for is the Produtor's. */
  isLocked: boolean;
}) {
  const { values, onValuesChanged } = props;
  // A disabled fieldset greys out every control inside it, the dropdowns' buttons too.
  return (
    <fieldset disabled={props.isLocked} className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
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
    </fieldset>
  );
}

/**
 * Every N minutes: the minutes, the hint that the count starts at the switch-on, and
 * "Só entre dois horários" with its two times, shown only while it is on.
 */
function EveryMinutesControls(props: {
  values: TriggerFormValues;
  onValuesChanged: (changedParts: Partial<TriggerFormValues>) => void;
}) {
  const { values, onValuesChanged } = props;
  return (
    <>
      <EditorTextField
        id="trigger-every-minutes"
        label={texts.everyMinutesLabel}
        value={values.everyMinutesText}
        inputMode="numeric"
        onChange={(everyMinutesText) => onValuesChanged({ everyMinutesText })}
      />
      <p className="text-xs text-muted-foreground">{texts.everyMinutesHint}</p>
      <div className="flex items-center gap-2">
        <Switch
          id="trigger-day-window"
          checked={values.isDayWindowOn}
          onCheckedChange={(isDayWindowOn) => onValuesChanged({ isDayWindowOn })}
        />
        <Label htmlFor="trigger-day-window" className="text-xs">
          {texts.dayWindowLabel}
        </Label>
      </div>
      {values.isDayWindowOn ? (
        <div className="grid grid-cols-2 gap-2">
          <EditorTextField
            id="trigger-window-from"
            label={texts.windowFromLabel}
            value={values.windowFromText}
            inputMode="numeric"
            onChange={(windowFromText) => onValuesChanged({ windowFromText })}
          />
          <EditorTextField
            id="trigger-window-to"
            label={texts.windowToLabel}
            value={values.windowToText}
            inputMode="numeric"
            onChange={(windowToText) => onValuesChanged({ windowToText })}
          />
        </div>
      ) : null}
    </>
  );
}

/** A schedule's controls: a time of day, minutes before or after a slot, or every N minutes. */
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
        <SelectItem value="everyMinutes">{texts.scheduleMomentKindNames.everyMinutes}</SelectItem>
      </EditorDropdown>
      {values.scheduleMomentKind === 'everyMinutes' ? (
        <EveryMinutesControls values={values} onValuesChanged={onValuesChanged} />
      ) : null}
      {values.scheduleMomentKind === 'timeOfDay' ? (
        <EditorTextField
          id="trigger-time-of-day"
          label={texts.timeOfDayLabel}
          value={values.timeOfDay}
          inputMode="numeric"
          onChange={(timeOfDay) => onValuesChanged({ timeOfDay })}
        />
      ) : null}
      {values.scheduleMomentKind === 'slotStart' ? (
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
      ) : null}
    </>
  );
}
