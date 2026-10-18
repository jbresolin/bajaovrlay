import {
  type SimulatorConfig,
  SimulatorConfigSchema,
  type SimulatorDataSource,
} from '@bajaovrlay/shared';
import type { FieldErrors, ResolverResult } from 'react-hook-form';

import { ptBR } from '@/i18n/ptBR';

import { readNumberFromFieldText, writeNumberAsFieldText } from './numberFieldText';
import {
  defaultPollIntervalMs,
  findErrorsOfLabelAndPollInterval,
  type InvalidSourceFormReading,
  type LabelAndPollIntervalFormValues,
  readPollIntervalMs,
  type ValidSourceFormReading,
} from './sourceFormReading';

/**
 * The simulator form's values and how they are read. Fields hold text, as inputs do, in
 * the operator's units (seconds, minutes, a decimal comma); reading converts them and
 * checks the config with the shared SimulatorConfigSchema, the same schema the server
 * checks, so the page and the server agree on what is valid (decision D4).
 */

/** What the simulator form holds. */
export type SimulatorSourceFormValues = LabelAndPollIntervalFormValues & {
  seed: string;
  carCount: string;
  /** Minutes, as typed: "240" for the four-hour enduro. */
  sessionDurationMinutes: string;
  lapLengthKm: string;
  speed: string;
  isFailing: boolean;
};

/**
 * The config the form sends: every field but the moment the race started, which only the
 * server sets (when the source is turned on) and keeps across edits.
 */
export type SimulatorConfigFromForm = Omit<SimulatorConfig, 'simulatedStartAtMs'>;

/** What reading the simulator form answers. */
export type SimulatorSourceFormReading =
  | ValidSourceFormReading<SimulatorConfigFromForm>
  | InvalidSourceFormReading<keyof SimulatorSourceFormValues>;

const millisecondsPerSecond = 1_000;
const millisecondsPerMinute = 60_000;

/** Fills the form from a stored simulator, or with the schema's defaults for a new one. */
export function buildSimulatorSourceFormValues(
  source: SimulatorDataSource | null,
): SimulatorSourceFormValues {
  const config = source?.config ?? SimulatorConfigSchema.parse({});
  const pollIntervalMs = source?.pollIntervalMs ?? defaultPollIntervalMs;
  return {
    label: source?.label ?? '',
    pollIntervalSeconds: writeNumberAsFieldText(pollIntervalMs / millisecondsPerSecond),
    seed: String(config.seed),
    carCount: String(config.carCount),
    sessionDurationMinutes: writeNumberAsFieldText(
      config.sessionDurationMs / millisecondsPerMinute,
    ),
    lapLengthKm: writeNumberAsFieldText(config.lapLengthKm),
    speed: String(config.speed),
    isFailing: config.isFailing,
  };
}

/** Names the form field behind a config field the schema refused, with its pt-BR message. */
function findFormFieldOfConfigField(configField: PropertyKey | undefined): {
  formField: keyof SimulatorSourceFormValues;
  message: string;
} {
  const fieldErrors = ptBR.dataSources.form.fieldErrors;
  switch (configField) {
    case 'seed':
      return { formField: 'seed', message: fieldErrors.seedOutOfRange };
    case 'carCount':
      return { formField: 'carCount', message: fieldErrors.carCountOutOfRange };
    case 'sessionDurationMs':
      return {
        formField: 'sessionDurationMinutes',
        message: fieldErrors.sessionDurationOutOfRange,
      };
    case 'lapLengthKm':
      return { formField: 'lapLengthKm', message: fieldErrors.lapLengthNotPositive };
    default:
      // The speed is the one number field left; isFailing is a switch and cannot be wrong.
      return { formField: 'speed', message: fieldErrors.simulatorSpeedOutOfRange };
  }
}

/** Reads the form: a simulator ready to send, or a pt-BR message per wrong field. */
export function readSimulatorSourceForm(
  values: SimulatorSourceFormValues,
): SimulatorSourceFormReading {
  const errorMessageByField: Partial<Record<keyof SimulatorSourceFormValues, string>> =
    findErrorsOfLabelAndPollInterval(values);

  const configAsTyped = {
    seed: readNumberFromFieldText(values.seed),
    carCount: readNumberFromFieldText(values.carCount),
    // Rounded so that 1,5 min is exactly 90 000 ms and not 90 000.000…1.
    sessionDurationMs: Math.round(
      readNumberFromFieldText(values.sessionDurationMinutes) * millisecondsPerMinute,
    ),
    lapLengthKm: readNumberFromFieldText(values.lapLengthKm),
    speed: readNumberFromFieldText(values.speed),
    isFailing: values.isFailing,
  };
  const parsedConfig = SimulatorConfigSchema.safeParse(configAsTyped);
  if (!parsedConfig.success) {
    for (const issue of parsedConfig.error.issues) {
      const { formField, message } = findFormFieldOfConfigField(issue.path[0]);
      errorMessageByField[formField] = message;
    }
  }

  const hasWrongFields = Object.keys(errorMessageByField).length > 0;
  if (hasWrongFields || !parsedConfig.success) {
    return { isValid: false, errorMessageByField };
  }
  return {
    isValid: true,
    label: values.label.trim(),
    pollIntervalMs: readPollIntervalMs(values.pollIntervalSeconds),
    config: parsedConfig.data,
  };
}

/**
 * The bridge between readSimulatorSourceForm and react-hook-form: the values when the
 * form is valid, otherwise one message per wrong field in react-hook-form's shape.
 */
export function resolveSimulatorSourceForm(
  values: SimulatorSourceFormValues,
): ResolverResult<SimulatorSourceFormValues> {
  const reading = readSimulatorSourceForm(values);
  if (reading.isValid) {
    return { values, errors: {} };
  }
  const errors: FieldErrors<SimulatorSourceFormValues> = {};
  for (const [fieldName, message] of Object.entries(reading.errorMessageByField)) {
    errors[fieldName as keyof SimulatorSourceFormValues] = { type: 'validation', message };
  }
  return { values: {}, errors };
}
