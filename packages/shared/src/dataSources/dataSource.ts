import { z } from 'zod';

import { PollIntervalMsSchema } from './pollInterval.js';
import { ReplayConfigSchema } from './replayConfig.js';
import { SimulatorConfigSchema } from './simulatorConfig.js';

/**
 * How a source is doing, as its poll results left it. Only the server changes it, through
 * the poll results (recordDataSourcePoll) and the operator's commands.
 */
export const DataSourceStatusSchema = z.object({
  /** When the last poll, good or failed, was made. Missing until the first poll. */
  lastAttemptAtMs: z.number().int().optional(),
  /** When the last good poll was made. Missing until the first one. */
  lastOkAtMs: z.number().int().optional(),
  /** Why the last poll failed, in pt-BR; null after a good poll. */
  lastError: z.string().nullable(),
  /** How many polls in a row have failed. */
  consecutiveFailures: z.number().int().min(0),
  /**
   * The data shown is late ("atrasada"): the last poll failed, or nothing good came for
   * longer than staleAfterMs. A source that is off is never stale; it is off.
   */
  isStale: z.boolean(),
  /** How long without a good poll before the source is stale: three poll intervals. */
  staleAfterMs: z.number().int().positive(),
  /** Why the last recording stopped on its own (a write failed), in pt-BR; null otherwise. */
  recordingError: z.string().nullable(),
});

/** A source status that has passed DataSourceStatusSchema. */
export type DataSourceStatus = z.infer<typeof DataSourceStatusSchema>;

// What every kind of source carries; each kind adds its own config below.
const DataSourceFieldsOfEveryKindSchema = z.object({
  id: z.string().min(1),
  /** The name the operator reads on the "Fontes" page. */
  label: z.string().min(1),
  /** How often the server polls the source: from twice a second to once a minute. */
  pollIntervalMs: PollIntervalMsSchema,
  /** Whether the server polls it. */
  isEnabled: z.boolean(),
  /** Whether every good poll is being appended to a recording. */
  isRecording: z.boolean(),
  /**
   * When an operator last pressed "Atualizar agora". The poller sees this change and
   * polls at once: a command reaches the poller only through state (decision D7).
   */
  pollNowRequestedAtMs: z.number().int().optional(),
  status: DataSourceStatusSchema,
});

/** A source of kind `simulator`, with the simulator's config. */
export const SimulatorDataSourceSchema = DataSourceFieldsOfEveryKindSchema.extend({
  kind: z.literal('simulator'),
  config: SimulatorConfigSchema,
});

/** A simulator source that has passed SimulatorDataSourceSchema. */
export type SimulatorDataSource = z.infer<typeof SimulatorDataSourceSchema>;

/** A source of kind `replay`, with the replay's config. */
export const ReplayDataSourceSchema = DataSourceFieldsOfEveryKindSchema.extend({
  kind: z.literal('replay'),
  config: ReplayConfigSchema,
});

/** A replay source that has passed ReplayDataSourceSchema. */
export type ReplayDataSource = z.infer<typeof ReplayDataSourceSchema>;

/**
 * One entry of the `dataSources` slice: a source the server polls for race data, told
 * apart by `kind`, so its config is always the one of its kind.
 */
export const DataSourceSchema = z.discriminatedUnion('kind', [
  SimulatorDataSourceSchema,
  ReplayDataSourceSchema,
]);

/** A data source that has passed DataSourceSchema. */
export type DataSource = z.infer<typeof DataSourceSchema>;
