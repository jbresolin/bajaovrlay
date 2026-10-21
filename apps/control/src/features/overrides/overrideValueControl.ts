/**
 * How the correction dialog asks for a corrected value, field by field: a dropdown of the
 * shape's own values for the flag, a car's status and the kind of session (labelled as
 * the "Fontes" page labels them), a number for the leader's laps, mm:ss for the scheduled
 * duration (as every clock field of the item editor is typed), text for everything else.
 * And the typed text read back as the value sent, and a value in force written as text.
 */
import { PositionStatusSchema, SessionKindSchema, SessionStateSchema } from '@bajaovrlay/shared';

import {
  convertMinutesAndSecondsToMilliseconds,
  formatMillisecondsAsMinutesAndSeconds,
} from '@/features/schemaForm/minutesAndSeconds';
import { ptBR } from '@/i18n/ptBR';

/** One choice of a dropdown: the value the shapes use, and its pt-BR label. */
export type OverrideValueChoice = { value: string; label: string };

/** The control a field's corrected value is typed or chosen in. */
export type OverrideValueControl =
  | { kind: 'choice'; choices: OverrideValueChoice[] }
  | { kind: 'number' }
  | { kind: 'duration' }
  | { kind: 'text' };

// The correctable fields that hold a plain number, and the one that holds a duration in
// milliseconds (override.ts lists the correctable fields).
const numberFields = ['lapsCompletedByLeader'];
const durationFields = ['scheduledDurationMs'];

/** The control of one correctable field. */
export function chooseOverrideValueControl(field: string): OverrideValueControl {
  const dataSourceTexts = ptBR.dataSources;
  if (field === 'state') {
    return {
      kind: 'choice',
      choices: SessionStateSchema.options.map((flag) => ({
        value: flag,
        label: dataSourceTexts.sessionCard.flagStates[flag],
      })),
    };
  }
  if (field === 'status') {
    return {
      kind: 'choice',
      choices: PositionStatusSchema.options.map((status) => ({
        value: status,
        label: dataSourceTexts.positionsTable.statuses[status],
      })),
    };
  }
  if (field === 'sessionKind') {
    return {
      kind: 'choice',
      choices: SessionKindSchema.options.map((sessionKind) => ({
        value: sessionKind,
        label: ptBR.bindings.overrides.sessionKinds[sessionKind] ?? sessionKind,
      })),
    };
  }
  if (durationFields.includes(field)) {
    return { kind: 'duration' };
  }
  return numberFields.includes(field) ? { kind: 'number' } : { kind: 'text' };
}

/** A correction in force written as the dialog's control shows it: a duration as mm:ss. */
export function writeOverrideValueAsText(field: string, value: unknown): string {
  if (durationFields.includes(field) && typeof value === 'number') {
    return formatMillisecondsAsMinutesAndSeconds(value);
  }
  return String(value);
}

/**
 * The value sent for what the operator typed or chose: a number field's text read as a
 * number ("35"), a duration's mm:ss as milliseconds ("240:00" is 14 400 000), each left as
 * text when it cannot be read so the shared check names it; any other field's text as it is.
 */
export function readOverrideValueFromText(field: string, text: string): unknown {
  if (durationFields.includes(field)) {
    return convertMinutesAndSecondsToMilliseconds(text) ?? text;
  }
  if (!numberFields.includes(field)) {
    return text;
  }
  const textWithDecimalPoint = text.trim().replace(',', '.');
  const number = Number(textWithDecimalPoint);
  return textWithDecimalPoint === '' || Number.isNaN(number) ? text : number;
}
