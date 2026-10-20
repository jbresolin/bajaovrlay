/**
 * A value read from a source, written for the operator in pt-BR (gate 2 of PR #18): the
 * one formatter of the item editor's "Valor agora", the bound fields of "Edição rápida"
 * and the correction dialog opened there, so the three never show the raw data
 * ("green", true, 4559052). The kind of value comes from the binding's path (its value
 * type, the clock's own fields by their path) or, for a field the whole clock fills, from
 * that field's clock role (a session clock path has one too, findClockRoleOfSessionPath).
 */
import {
  type BindingFieldValue,
  type ClockFieldKeysByRole,
  type ClockFieldRole,
  findClockRoleOfSessionPath,
  findValueTypeOfBinding,
  type SessionState,
  wholeClockBindingPath,
} from '@bajaovrlay/shared';

import { formatTimeOfDay } from '@/features/dataSources/timeOfDayText';
import { formatMillisecondsAsMinutesAndSeconds } from '@/features/schemaForm/minutesAndSeconds';
import { ptBR } from '@/i18n/ptBR';

/** How a source's value is written. */
export type SourceValueKind =
  | 'text'
  | 'number'
  | 'flag'
  | 'yesNo'
  | 'clockTime'
  | 'wallClockMoment'
  | 'clockMode'
  | 'clockReading'
  | 'list';

const editorTexts = ptBR.bindings.editor;
const sessionCardTexts = ptBR.dataSources.sessionCard;
const missingValueText = '—';

// The clock's fields by their role: integers, a switch and a text by value type, each
// with its own words.
const kindOfEachClockRole: Record<ClockFieldRole, SourceValueKind> = {
  clockTime: 'clockTime',
  wallClock: 'wallClockMoment',
  clockRunning: 'yesNo',
  clockMode: 'clockMode',
};

/**
 * The kind of the value a binding reads: a field of the session clock by its clock role
 * (the shared shape names them), anything else by its path's value type (after a
 * transform).
 */
export function findSourceValueKindOfBinding(binding: BindingFieldValue): SourceValueKind {
  const clockRole =
    binding.shapeKey === 'session' && binding.transformId === undefined
      ? findClockRoleOfSessionPath(binding.path)
      : undefined;
  if (clockRole !== undefined) {
    return kindOfEachClockRole[clockRole];
  }
  if (binding.shapeKey === 'session' && binding.path === wholeClockBindingPath) {
    return 'clockReading';
  }
  switch (findValueTypeOfBinding(binding)) {
    case 'stateEnum':
      return 'flag';
    case 'boolean':
      return 'yesNo';
    case 'integer':
    case 'number':
      return 'number';
    case 'clockGroup':
      return 'clockReading';
    case 'positionsEntries':
    case 'standingsEntries':
    case 'bracketsRounds':
      return 'list';
    case 'text':
    case undefined:
      return 'text';
  }
}

/** The kind of one of the four fields the whole clock fills, by its clock role. */
export function findSourceValueKindOfClockField(
  fieldKey: string,
  clockFieldKeys: ClockFieldKeysByRole,
): SourceValueKind {
  if (fieldKey === clockFieldKeys.clockTime) {
    return kindOfEachClockRole.clockTime;
  }
  if (fieldKey === clockFieldKeys.wallClock) {
    return kindOfEachClockRole.wallClock;
  }
  if (fieldKey === clockFieldKeys.clockRunning) {
    return kindOfEachClockRole.clockRunning;
  }
  return kindOfEachClockRole.clockMode;
}

/**
 * Writes one value of this kind for the operator. A value missing, or not of the kind's
 * type (a source that sent something unexpected), never breaks the line: a dash, or the
 * value as data.
 */
export function writeSourceValueForReading(value: unknown, kind: SourceValueKind): string {
  if (value === undefined || value === null) {
    return missingValueText;
  }
  switch (kind) {
    case 'flag':
      return typeof value === 'string' && Object.hasOwn(sessionCardTexts.flagStates, value)
        ? sessionCardTexts.flagStates[value as SessionState]
        : String(value);
    case 'yesNo':
      return value === true ? editorTexts.yes : value === false ? editorTexts.no : String(value);
    case 'clockTime':
      return typeof value === 'number'
        ? formatMillisecondsAsMinutesAndSeconds(value)
        : String(value);
    case 'wallClockMoment':
      return typeof value === 'number' ? formatTimeOfDay(value) : String(value);
    case 'clockMode':
      return value === 'elapsed' || value === 'remaining'
        ? sessionCardTexts.clockModes[value]
        : String(value);
    case 'clockReading':
      return writeClockReading(value);
    case 'number':
      return typeof value === 'number' ? value.toLocaleString('pt-BR') : String(value);
    case 'list':
      return Array.isArray(value) ? editorTexts.listOfEntries(value.length) : String(value);
    case 'text':
      return typeof value === 'string' ? value : JSON.stringify(value);
  }
}

/** The whole clock: its time as mm:ss and whether it runs. */
function writeClockReading(value: unknown): string {
  const isClockReading =
    typeof value === 'object' && value !== null && 'referenceTimeMs' in value && 'running' in value;
  if (!isClockReading) {
    return JSON.stringify(value);
  }
  const clockReading = value as { referenceTimeMs: number; running: boolean };
  const timeText = formatMillisecondsAsMinutesAndSeconds(clockReading.referenceTimeMs);
  return editorTexts.clockReading(timeText, clockReading.running);
}
