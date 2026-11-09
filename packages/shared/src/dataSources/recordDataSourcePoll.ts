// The command the server's poller sends after every poll of a source, good or failed, so
// the `dataSources` and `dataSnapshots` slices change only through commands like every
// other slice. Only the poller of that very source may send it (actor
// `sistema:fonte:<sourceId>`); operators and renderers are refused. A control page never
// sends it.
import { z } from 'zod';

import { YouTubeQuotaUsageSchema } from './youtubeLiveChatConfig.js';

/**
 * A good poll: the shapes the source produced, by shape name. Left unchecked here on
 * purpose: the server checks each against its canonical shape, and a bad one turns the
 * whole poll into a failure with a pt-BR error naming the path, instead of a refusal.
 */
const GoodPollResultSchema = z.object({
  ok: z.literal(true),
  shapes: z.record(z.string(), z.unknown()),
  /** When the poll was made. */
  receivedAtMs: z.number().int(),
  /** A YouTube source's quota spent today, after this poll (BAJAOVRLAY-35). */
  youTubeQuota: YouTubeQuotaUsageSchema.optional(),
});

/**
 * A failed poll: the pt-BR reason the operator reads, and when the poll was tried. The
 * reason may be empty (an adapter that threw `new Error()`): refusing that here would turn
 * every such poll into an INVALID_COMMAND row and the source would never go stale, so the
 * server takes it and shows a pt-BR fallback instead.
 */
const FailedPollResultSchema = z.object({
  ok: z.literal(false),
  error: z.string(),
  attemptedAtMs: z.number().int(),
  /** A YouTube source's quota spent today, after this poll (BAJAOVRLAY-35). */
  youTubeQuota: YouTubeQuotaUsageSchema.optional(),
});

/**
 * Records the result of one poll of a source. The result sits under its own field
 * because the command list is told apart by `type`, and the result by `ok`.
 */
export const RecordDataSourcePollCommandSchema = z.object({
  type: z.literal('recordDataSourcePoll'),
  sourceId: z.string().min(1),
  result: z.discriminatedUnion('ok', [GoodPollResultSchema, FailedPollResultSchema]),
});

/** A recordDataSourcePoll command after validation. */
export type RecordDataSourcePollCommand = z.infer<typeof RecordDataSourcePollCommandSchema>;
