// The one place that says what an adapter is: the code that reads one kind of source
// (the simulator, a replay) and answers the canonical shapes. The poller calls it; the
// store's recordDataSourcePoll validates what it answers.
import type { DataShapeKey, DataSourceKind } from '@bajaovrlay/shared';
import type { z } from 'zod';

/**
 * What the poller hands an adapter for one poll: the server's clock (so tests and a
 * replay can hold or move time) and the signal that fires when the poll took too long.
 */
export type DataSourcePollContext = {
  readCurrentTime: () => Date;
  signal: AbortSignal;
};

/**
 * What one good poll answers: some of the four canonical shapes, not yet validated. The
 * store validates every one (recordDataSourcePoll); one bad shape fails the whole poll.
 */
export type PolledShapes = {
  shapes: Partial<Record<DataShapeKey, unknown>>;
};

/**
 * An adapter for one kind of source, whose config is `Config` (the kind's schema in
 * @bajaovrlay/shared, decision D4).
 * - `configSchema` checks a config of this kind; the store already stores parsed ones.
 * - `listProducedShapes` says which shapes a source with this config answers, for the
 *   page's binding picker.
 * - `pollOnce` reads the source once and resolves with its shapes, or throws an Error
 *   whose message (pt-BR) the operator reads as the source's error. It should stop when
 *   `context.signal` fires; one that does not stays in flight, and the poller's stale
 *   watch marks the source late meanwhile.
 */
export type DataSourceAdapter<Config> = {
  kind: DataSourceKind;
  configSchema: z.ZodType<Config>;
  listProducedShapes: (config: Config) => DataShapeKey[];
  pollOnce: (config: Config, context: DataSourcePollContext) => Promise<PolledShapes>;
};
