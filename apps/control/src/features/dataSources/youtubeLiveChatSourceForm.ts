import {
  PollIntervalMsSchema,
  type YouTubeLiveChatConfig,
  YouTubeLiveChatConfigSchema,
  type YouTubeLiveChatDataSource,
  youTubeLiveChatDefaultPollIntervalMs,
  youTubeLiveChatShortestPollIntervalMs,
} from '@bajaovrlay/shared';
import type { FieldErrors, ResolverResult } from 'react-hook-form';

import { ptBR } from '@/i18n/ptBR';

import { writeNumberAsFieldText } from './numberFieldText';
import {
  type InvalidSourceFormReading,
  type LabelAndPollIntervalFormValues,
  readPollIntervalMs,
  type ValidSourceFormReading,
} from './sourceFormReading';

/**
 * The YouTube live chat form's values and how they are read (BAJAOVRLAY-35). The address is
 * checked with the shared YouTubeLiveChatConfigSchema, the one the server checks (D4). The
 * interval has its own floor, 10 s, since every reading spends quota: the shared
 * PollIntervalMsSchema's 0,5 s would run the day's quota out in under an hour.
 */

/** What the YouTube form holds. */
export type YouTubeLiveChatSourceFormValues = LabelAndPollIntervalFormValues & {
  /** The live's address as pasted: youtube.com/watch?v=…, youtu.be/… or youtube.com/live/…. */
  liveAddress: string;
};

/** What reading the YouTube form answers. */
export type YouTubeLiveChatSourceFormReading =
  | ValidSourceFormReading<YouTubeLiveChatConfig>
  | InvalidSourceFormReading<keyof YouTubeLiveChatSourceFormValues>;

const millisecondsPerSecond = 1_000;

/** Fills the form from a stored YouTube source, or empty at 30 s for a new one. */
export function buildYouTubeLiveChatSourceFormValues(
  source: YouTubeLiveChatDataSource | null,
): YouTubeLiveChatSourceFormValues {
  const pollIntervalMs = source?.pollIntervalMs ?? youTubeLiveChatDefaultPollIntervalMs;
  return {
    label: source?.label ?? '',
    pollIntervalSeconds: writeNumberAsFieldText(pollIntervalMs / millisecondsPerSecond),
    liveAddress: source?.config.liveAddress ?? '',
  };
}

/** Reads the form: a YouTube source ready to send, or a pt-BR message per wrong field. */
export function readYouTubeLiveChatSourceForm(
  values: YouTubeLiveChatSourceFormValues,
): YouTubeLiveChatSourceFormReading {
  const fieldErrors = ptBR.dataSources.form.fieldErrors;
  const errorMessageByField: Partial<Record<keyof YouTubeLiveChatSourceFormValues, string>> = {};

  if (values.label.trim() === '') {
    errorMessageByField.label = fieldErrors.labelMissing;
  }
  const pollIntervalMs = readPollIntervalMs(values.pollIntervalSeconds);
  const isWithinEverySourcesRange = PollIntervalMsSchema.safeParse(pollIntervalMs).success;
  const isSlowEnoughForTheQuota = pollIntervalMs >= youTubeLiveChatShortestPollIntervalMs;
  if (!isWithinEverySourcesRange || !isSlowEnoughForTheQuota) {
    errorMessageByField.pollIntervalSeconds = fieldErrors.youTubePollIntervalOutOfRange;
  }
  const parsedConfig = YouTubeLiveChatConfigSchema.safeParse({ liveAddress: values.liveAddress });
  if (!parsedConfig.success) {
    // The schema's one rule is the address's, and its message is already pt-BR.
    errorMessageByField.liveAddress = parsedConfig.error.issues[0]?.message;
  }

  const hasWrongFields = Object.keys(errorMessageByField).length > 0;
  if (hasWrongFields || !parsedConfig.success) {
    return { isValid: false, errorMessageByField };
  }
  return {
    isValid: true,
    label: values.label.trim(),
    pollIntervalMs,
    config: parsedConfig.data,
  };
}

/**
 * The bridge between readYouTubeLiveChatSourceForm and react-hook-form: the values when the
 * form is valid, otherwise one message per wrong field in react-hook-form's shape.
 */
export function resolveYouTubeLiveChatSourceForm(
  values: YouTubeLiveChatSourceFormValues,
): ResolverResult<YouTubeLiveChatSourceFormValues> {
  const reading = readYouTubeLiveChatSourceForm(values);
  if (reading.isValid) {
    return { values, errors: {} };
  }
  const errors: FieldErrors<YouTubeLiveChatSourceFormValues> = {};
  for (const [fieldName, message] of Object.entries(reading.errorMessageByField)) {
    errors[fieldName as keyof YouTubeLiveChatSourceFormValues] = { type: 'validation', message };
  }
  return { values: {}, errors };
}
