/**
 * A trigger in words, for the list of "Gatilhos": what it waits for, then its macro, mode,
 * interval and whether it is on. Pure, read from the slices as they are.
 */
import type { Macro, ScheduleSlot, Trigger, TriggerWhen } from '@bajaovrlay/shared';

import { ptBR } from '@/i18n/ptBR';

const texts = ptBR.triggers;
const millisecondsPerSecond = 1_000;

/**
 * What a trigger waits for, in words: "Entrou na cena "Box"", "10 min antes de Enduro",
 * "A cada 30 min, das 08:00 às 18:00".
 */
export function describeWhenOfTrigger(when: TriggerWhen, scheduleSlots: ScheduleSlot[]): string {
  switch (when.kind) {
    case 'obsScene':
      return texts.whenText.obsScene(when.change, when.sceneName);
    case 'http':
      return texts.whenText.http;
    case 'dataEvent':
      return texts.whenText.dataEvent(texts.editor.dataEventKindNames[when.eventKind]);
    case 'schedule': {
      const moment = when.moment;
      if (moment.kind === 'timeOfDay') {
        return texts.whenText.timeOfDay(moment.timeOfDay);
      }
      if (moment.kind === 'everyMinutes') {
        if (moment.window === null) {
          return texts.whenText.everyMinutes(moment.everyMinutes);
        }
        return texts.whenText.everyMinutesBetween(
          moment.everyMinutes,
          moment.window.from,
          moment.window.to,
        );
      }
      const slotName = describeSlotOfTrigger(moment.slotId, scheduleSlots);
      const minutes = Math.abs(moment.minutesFromStart);
      return texts.whenText.slotStart(minutes, moment.minutesFromStart < 0, slotName);
    }
  }
}

/** The slot a schedule trigger names, by its session's name; "cada sessão" for every slot. */
function describeSlotOfTrigger(slotId: string | null, scheduleSlots: ScheduleSlot[]): string {
  if (slotId === null) {
    return texts.whenText.everySlot;
  }
  const slot = scheduleSlots.find((candidate) => candidate.slotId === slotId);
  return slot?.sessionName ?? texts.whenText.slotMissing;
}

/** A macro's label by its id, or "macro excluída" when it is gone. */
export function readLabelOfMacro(macroId: string, macros: Macro[]): string {
  return macros.find((macro) => macro.id === macroId)?.label ?? texts.dialog.macroMissing;
}

/**
 * One row of the list, after the trigger's name: "Entrou na cena "Box" → Abrir a sessão ·
 * Automático · a cada 10 s no mínimo · Ligado".
 */
export function describeTriggerForTheList(
  trigger: Trigger,
  macros: Macro[],
  scheduleSlots: ScheduleSlot[],
): string {
  const whenText = describeWhenOfTrigger(trigger.when, scheduleSlots);
  const macroLabel = readLabelOfMacro(trigger.macroId, macros);
  const modeName = texts.editor.modeNames[trigger.mode];
  const intervalText = texts.dialog.intervalText(trigger.minimumIntervalMs / millisecondsPerSecond);
  const onOffWord = trigger.isEnabled ? texts.dialog.enabledWord : texts.dialog.disabledWord;
  return `${whenText} → ${macroLabel} · ${modeName} · ${intervalText} · ${onOffWord}`;
}
