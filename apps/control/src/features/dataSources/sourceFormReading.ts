import { PollIntervalMsSchema } from '@bajaovrlay/shared';

import { ptBR } from '@/i18n/ptBR';

import { readNumberFromFieldText } from './numberFieldText';

/**
 * What both source forms (simulator and replay) have in common: a label and a poll
 * interval in seconds, and the answer of reading a form — either a source ready to send,
 * or a pt-BR message per wrong field. The kind's own fields are read in
 * simulatorSourceForm.ts and replaySourceForm.ts.
 */

/** The two fields every source form has. */
export type LabelAndPollIntervalFormValues = {
  label: string;
  /** Seconds, as typed: "2", "0,5". */
  pollIntervalSeconds: string;
};

/** A form whose every field passed: what the commands are built from. */
export type ValidSourceFormReading<Config> = {
  isValid: true;
  label: string;
  pollIntervalMs: number;
  config: Config;
};

/** A form with wrong fields: one pt-BR message per wrong field. */
export type InvalidSourceFormReading<FieldName extends string> = {
  isValid: false;
  errorMessageByField: Partial<Record<FieldName, string>>;
};

/** The interval a new source starts with: what the seeded simulator uses. */
export const defaultPollIntervalMs = 2_000;

const millisecondsPerSecond = 1_000;

/** Converts the interval field's seconds into ms; NaN when the field is not a number. */
export function readPollIntervalMs(pollIntervalSecondsText: string): number {
  return Math.round(readNumberFromFieldText(pollIntervalSecondsText) * millisecondsPerSecond);
}

/**
 * Checks the label (not blank) and the interval (the shared PollIntervalMsSchema, 0,5 to
 * 60 s) and returns a message for each one that is wrong.
 */
export function findErrorsOfLabelAndPollInterval(
  values: LabelAndPollIntervalFormValues,
): Partial<Record<keyof LabelAndPollIntervalFormValues, string>> {
  const fieldErrors = ptBR.dataSources.form.fieldErrors;
  const errorMessageByField: Partial<Record<keyof LabelAndPollIntervalFormValues, string>> = {};

  if (values.label.trim() === '') {
    errorMessageByField.label = fieldErrors.labelMissing;
  }
  const pollIntervalMs = readPollIntervalMs(values.pollIntervalSeconds);
  if (!PollIntervalMsSchema.safeParse(pollIntervalMs).success) {
    errorMessageByField.pollIntervalSeconds = fieldErrors.pollIntervalOutOfRange;
  }
  return errorMessageByField;
}
