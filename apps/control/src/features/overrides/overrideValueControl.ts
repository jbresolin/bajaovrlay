/**
 * How the correction dialog asks for a corrected value, field by field: a dropdown of the
 * shape's own values for the flag, a car's status and the kind of session (labelled as
 * the "Fontes" page labels them), a number for points and durations (a decimal comma
 * accepted), text for everything else. And the typed text read back as the value sent.
 */
import { PositionStatusSchema, SessionKindSchema, SessionStateSchema } from '@bajaovrlay/shared';

import { ptBR } from '@/i18n/ptBR';

/** One choice of a dropdown: the value the shapes use, and its pt-BR label. */
export type OverrideValueChoice = { value: string; label: string };

/** The control a field's corrected value is typed or chosen in. */
export type OverrideValueControl =
  { kind: 'choice'; choices: OverrideValueChoice[] } | { kind: 'number' } | { kind: 'text' };

// The correctable fields that hold a number (override.ts lists the correctable fields).
const numberFields = ['points', 'scheduledDurationMs', 'lapsCompletedByLeader'];

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
  return numberFields.includes(field) ? { kind: 'number' } : { kind: 'text' };
}

/**
 * The value sent for what the operator typed or chose: a number field's text read as a
 * number ("512,5" is 512.5), left as text when it is not one so the shared check names
 * it; any other field's text as it is.
 */
export function readOverrideValueFromText(field: string, text: string): unknown {
  if (!numberFields.includes(field)) {
    return text;
  }
  const textWithDecimalPoint = text.trim().replace(',', '.');
  const number = Number(textWithDecimalPoint);
  return textWithDecimalPoint === '' || Number.isNaN(number) ? text : number;
}
