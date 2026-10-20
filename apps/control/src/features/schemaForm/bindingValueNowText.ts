/**
 * The line under a field set to "Fonte": what the field would get if the item were taken
 * now, or why it would get nothing, in the operator's words. Pure: the panel hands it the
 * shared resolution of the binding against the slices the page holds.
 */
import { type BindingResolution, formatClockTimeAsHoursMinutesSeconds } from '@bajaovrlay/shared';

import { ptBR } from '@/i18n/ptBR';

const editorTexts = ptBR.bindings.editor;

/**
 * Writes the value of now: a text as it is, a number in pt-BR digits, yes/no in words, a
 * list by its length, and the whole clock as its time and whether it runs, followed by
 * "(corrigido)" when an override changed it. An absent value and a binding that cannot be
 * read say so with the shared pt-BR reason.
 */
export function describeBindingValueNow(resolution: BindingResolution): string {
  if (resolution.status === 'valueAbsent') {
    return editorTexts.valueAbsentNow(resolution.problem);
  }
  if (resolution.status === 'unresolvable') {
    return editorTexts.cannotReadNow(resolution.problem);
  }
  const valueText = writeValueForTheOperator(resolution.value);
  const withCorrection = resolution.isOverridden
    ? `${valueText} ${editorTexts.correctedMark}`
    : valueText;
  return editorTexts.valueNowLabel(withCorrection);
}

/** One value as the operator reads it. */
function writeValueForTheOperator(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number') {
    return value.toLocaleString('pt-BR');
  }
  if (typeof value === 'boolean') {
    return value ? editorTexts.yes : editorTexts.no;
  }
  if (Array.isArray(value)) {
    return editorTexts.listOfEntries(value.length);
  }
  if (typeof value === 'object' && value !== null && 'referenceTimeMs' in value) {
    const clockReading = value as {
      referenceTimeMs: number;
      running: boolean;
      clockMode: 'elapsed' | 'remaining';
    };
    const timeText = formatClockTimeAsHoursMinutesSeconds(
      clockReading.referenceTimeMs,
      clockReading.clockMode,
    );
    return editorTexts.clockReading(timeText, clockReading.running);
  }
  return JSON.stringify(value);
}
