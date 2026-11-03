/**
 * The trigger editor's values, and the createTrigger or updateTrigger they become. The
 * editor holds every control any kind needs (scene, event kind, time, slot…), so switching
 * the kind back and forth loses nothing typed; only what the kind needs is sent. Pure, so
 * each rule is tested without a page; the server checks the command again.
 */
import {
  type CreateTriggerCommand,
  defaultTriggerMinimumIntervalMs,
  type Trigger,
  type TriggerDataEventKind,
  triggerMinimumIntervalLimitsMs,
  type TriggerMode,
  type TriggerWhen,
  type UpdateTriggerCommand,
} from '@bajaovrlay/shared';

import { ptBR } from '@/i18n/ptBR';

const problems = ptBR.triggers.editor.problems;
const millisecondsPerSecond = 1_000;

/** The slot dropdown's value for "Todas as sessões": a Select cannot hold the empty text. */
export const everySlotChoice = 'todas';

/** The farthest a trigger may be from a slot's start, in minutes (the server's limit). */
const furthestMinutesFromSlotStart = 720;

/** A time of day on a 24-hour clock, two digits each, as the server reads it. */
const timeOfDayPattern = /^([01]\d|2[0-3]):[0-5]\d$/;

/** What the editor holds while the operator edits one trigger: numbers as typed text. */
export type TriggerFormValues = {
  name: string;
  isEnabled: boolean;
  kind: TriggerWhen['kind'];
  sceneChange: 'entered' | 'left';
  sceneName: string;
  dataEventKind: TriggerDataEventKind;
  scheduleMomentKind: 'timeOfDay' | 'slotStart';
  timeOfDay: string;
  /** A slot's id, or everySlotChoice. */
  slotChoice: string;
  minutesText: string;
  slotDirection: 'before' | 'after';
  /** The macro's id; empty while none is chosen. */
  macroId: string;
  mode: TriggerMode;
  minimumIntervalSecondsText: string;
};

/**
 * A new trigger's values: on, a scene entered, asking first (a new trigger never puts
 * anything on air by surprise), 10 s apart, 10 minutes before every slot once switched to
 * a schedule.
 */
export function buildEmptyTriggerFormValues(): TriggerFormValues {
  return {
    name: '',
    isEnabled: true,
    kind: 'obsScene',
    sceneChange: 'entered',
    sceneName: '',
    dataEventKind: 'penalty',
    scheduleMomentKind: 'slotStart',
    timeOfDay: '',
    slotChoice: everySlotChoice,
    minutesText: '10',
    slotDirection: 'before',
    macroId: '',
    mode: 'ask',
    minimumIntervalSecondsText: String(defaultTriggerMinimumIntervalMs / millisecondsPerSecond),
  };
}

/** A stored trigger's values, its kind's controls filled, the others left as for a new one. */
export function buildTriggerFormValues(trigger: Trigger): TriggerFormValues {
  const values: TriggerFormValues = {
    ...buildEmptyTriggerFormValues(),
    name: trigger.name,
    isEnabled: trigger.isEnabled,
    kind: trigger.when.kind,
    macroId: trigger.macroId,
    mode: trigger.mode,
    minimumIntervalSecondsText: String(trigger.minimumIntervalMs / millisecondsPerSecond),
  };
  const when = trigger.when;
  switch (when.kind) {
    case 'obsScene':
      return { ...values, sceneChange: when.change, sceneName: when.sceneName };
    case 'http':
      return values;
    case 'dataEvent':
      return { ...values, dataEventKind: when.eventKind };
    case 'schedule':
      if (when.moment.kind === 'timeOfDay') {
        return { ...values, scheduleMomentKind: 'timeOfDay', timeOfDay: when.moment.timeOfDay };
      }
      return {
        ...values,
        scheduleMomentKind: 'slotStart',
        slotChoice: when.moment.slotId ?? everySlotChoice,
        minutesText: String(Math.abs(when.moment.minutesFromStart)),
        slotDirection: when.moment.minutesFromStart < 0 ? 'before' : 'after',
      };
  }
}

/** What reading the editor gives: the command to send, or the first problem in pt-BR. */
export type TriggerFormReading =
  | { status: 'ready'; command: CreateTriggerCommand | UpdateTriggerCommand }
  | { status: 'problem'; message: string };

/** What reading the kind's controls gives: the trigger's `when`, or the problem. */
type WhenReading = { status: 'ready'; when: TriggerWhen } | { status: 'problem'; message: string };

/** The `when` of the kind chosen, from that kind's controls only. */
function readWhenFromValues(values: TriggerFormValues): WhenReading {
  switch (values.kind) {
    case 'obsScene': {
      const sceneName = values.sceneName.trim();
      if (sceneName === '') {
        return { status: 'problem', message: problems.sceneMissing };
      }
      return {
        status: 'ready',
        when: { kind: 'obsScene', change: values.sceneChange, sceneName },
      };
    }
    case 'http':
      return { status: 'ready', when: { kind: 'http' } };
    case 'dataEvent':
      return { status: 'ready', when: { kind: 'dataEvent', eventKind: values.dataEventKind } };
    case 'schedule':
      return readScheduleWhenFromValues(values);
  }
}

/** A schedule's `when`: a time of day, or minutes before or after one slot or every slot. */
function readScheduleWhenFromValues(values: TriggerFormValues): WhenReading {
  if (values.scheduleMomentKind === 'timeOfDay') {
    const timeOfDay = values.timeOfDay.trim();
    if (!timeOfDayPattern.test(timeOfDay)) {
      return { status: 'problem', message: problems.timeOfDayInvalid };
    }
    return {
      status: 'ready',
      when: { kind: 'schedule', moment: { kind: 'timeOfDay', timeOfDay } },
    };
  }
  const minutesText = values.minutesText.trim();
  const minutes = Number(minutesText);
  const areMinutesValid = /^\d+$/.test(minutesText) && minutes <= furthestMinutesFromSlotStart;
  if (!areMinutesValid) {
    return { status: 'problem', message: problems.minutesInvalid };
  }
  // Zero minutes stays a plain 0 either way: "0 minutos antes" is the start itself.
  const isBeforeTheStart = values.slotDirection === 'before' && minutes > 0;
  const minutesFromStart = isBeforeTheStart ? -minutes : minutes;
  const slotId = values.slotChoice === everySlotChoice ? null : values.slotChoice;
  return {
    status: 'ready',
    when: { kind: 'schedule', moment: { kind: 'slotStart', slotId, minutesFromStart } },
  };
}

/** Whole seconds within the trigger's limits, as ms; undefined when the text is not that. */
function readIntervalSecondsAsMs(secondsText: string): number | undefined {
  const trimmedText = secondsText.trim();
  if (!/^\d+$/.test(trimmedText)) {
    return undefined;
  }
  const milliseconds = Number(trimmedText) * millisecondsPerSecond;
  const isWithinLimits =
    milliseconds >= triggerMinimumIntervalLimitsMs.shortest &&
    milliseconds <= triggerMinimumIntervalLimitsMs.longest;
  return isWithinLimits ? milliseconds : undefined;
}

/**
 * Reads the editor into createTrigger (`triggerId` null: a new trigger) or into
 * updateTrigger carrying the whole trigger, the interval sent in ms. In this order: the
 * name, the kind's controls, the macro, the interval; the first problem is reported.
 */
export function readTriggerFormIntoCommand(
  values: TriggerFormValues,
  triggerId: string | null,
): TriggerFormReading {
  const name = values.name.trim();
  if (name === '') {
    return { status: 'problem', message: problems.nameMissing };
  }
  const whenReading = readWhenFromValues(values);
  if (whenReading.status === 'problem') {
    return whenReading;
  }
  if (values.macroId === '') {
    return { status: 'problem', message: problems.macroMissing };
  }
  const minimumIntervalMs = readIntervalSecondsAsMs(values.minimumIntervalSecondsText);
  if (minimumIntervalMs === undefined) {
    return { status: 'problem', message: problems.intervalInvalid };
  }
  const triggerParts = {
    name,
    isEnabled: values.isEnabled,
    when: whenReading.when,
    macroId: values.macroId,
    mode: values.mode,
    minimumIntervalMs,
  };
  if (triggerId === null) {
    return { status: 'ready', command: { type: 'createTrigger', ...triggerParts } };
  }
  return { status: 'ready', command: { type: 'updateTrigger', triggerId, ...triggerParts } };
}
