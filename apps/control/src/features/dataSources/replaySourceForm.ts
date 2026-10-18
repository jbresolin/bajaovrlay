import { type ReplayConfig, ReplayConfigSchema, type ReplayDataSource } from '@bajaovrlay/shared';
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
 * The replay form's values and how they are read. The recording and the speed are
 * chosen from lists; the start offset is typed in seconds and may stay empty. Reading
 * checks the config with the shared ReplayConfigSchema, the one the server checks (D4).
 */

/** What the replay form holds. */
export type ReplaySourceFormValues = LabelAndPollIntervalFormValues & {
  /** An id from the `recordings` slice; empty until one is chosen. */
  recordingId: string;
  /** One of replaySpeeds, as the dropdown holds it: "10". */
  speed: string;
  isLooping: boolean;
  /** Seconds into the recording, as typed; empty means "from the top". */
  startOffsetSeconds: string;
};

/**
 * The config the form sends: every field but the moment the replay started, which only
 * the server sets (each time the source is turned on).
 */
export type ReplayConfigFromForm = Omit<ReplayConfig, 'replayStartedAtMs'>;

/** What reading the replay form answers. */
export type ReplaySourceFormReading =
  | ValidSourceFormReading<ReplayConfigFromForm>
  | InvalidSourceFormReading<keyof ReplaySourceFormValues>;

const millisecondsPerSecond = 1_000;

/** Fills the form from a stored replay, or with the schema's defaults and no recording. */
export function buildReplaySourceFormValues(
  source: ReplayDataSource | null,
): ReplaySourceFormValues {
  const startOffsetMs = source?.config.startOffsetMs;
  return {
    label: source?.label ?? '',
    pollIntervalSeconds: writeNumberAsFieldText(
      (source?.pollIntervalMs ?? defaultPollIntervalMs) / millisecondsPerSecond,
    ),
    recordingId: source?.config.recordingId ?? '',
    speed: String(source?.config.speed ?? 1),
    isLooping: source?.config.isLooping ?? false,
    startOffsetSeconds:
      startOffsetMs === undefined
        ? ''
        : writeNumberAsFieldText(startOffsetMs / millisecondsPerSecond),
  };
}

/** Names the form field behind a config field the schema refused, with its pt-BR message. */
function findFormFieldOfConfigField(configField: PropertyKey | undefined): {
  formField: keyof ReplaySourceFormValues;
  message: string;
} {
  const fieldErrors = ptBR.dataSources.form.fieldErrors;
  switch (configField) {
    case 'recordingId':
      return { formField: 'recordingId', message: fieldErrors.recordingMissing };
    case 'speed':
      return { formField: 'speed', message: fieldErrors.replaySpeedNotOffered };
    default:
      // The start offset is the one typed field left; isLooping is a switch.
      return { formField: 'startOffsetSeconds', message: fieldErrors.startOffsetInvalid };
  }
}

/** Reads the form: a replay ready to send, or a pt-BR message per wrong field. */
export function readReplaySourceForm(values: ReplaySourceFormValues): ReplaySourceFormReading {
  const errorMessageByField: Partial<Record<keyof ReplaySourceFormValues, string>> =
    findErrorsOfLabelAndPollInterval(values);

  // An empty offset is left out: optional means "not given", never 0.
  const configAsTyped: Record<string, unknown> = {
    recordingId: values.recordingId,
    speed: Number(values.speed),
    isLooping: values.isLooping,
  };
  const isStartOffsetGiven = values.startOffsetSeconds.trim() !== '';
  if (isStartOffsetGiven) {
    const startOffsetSeconds = readNumberFromFieldText(values.startOffsetSeconds);
    configAsTyped.startOffsetMs = Math.round(startOffsetSeconds * millisecondsPerSecond);
  }
  const parsedConfig = ReplayConfigSchema.safeParse(configAsTyped);
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
 * The bridge between readReplaySourceForm and react-hook-form: the values when the form
 * is valid, otherwise one message per wrong field in react-hook-form's shape.
 */
export function resolveReplaySourceForm(
  values: ReplaySourceFormValues,
): ResolverResult<ReplaySourceFormValues> {
  const reading = readReplaySourceForm(values);
  if (reading.isValid) {
    return { values, errors: {} };
  }
  const errors: FieldErrors<ReplaySourceFormValues> = {};
  for (const [fieldName, message] of Object.entries(reading.errorMessageByField)) {
    errors[fieldName as keyof ReplaySourceFormValues] = { type: 'validation', message };
  }
  return { values: {}, errors };
}
