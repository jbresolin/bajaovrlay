// The one place that says what an adapter is: the code that reads one kind of source
// (the simulator, a replay) and answers the canonical shapes. The poller calls it; the
// store's recordDataSourcePoll validates what it answers.
import type { DataShapeKey, DataSourceKind } from '@bajaovrlay/shared';
import type { z } from 'zod';

/**
 * What the poller hands an adapter for one poll: the server's clock (so tests and a
 * replay can hold or move time) and the signal that fires when the poll took too long,
 * which every adapter that waits on anything must pass on (see DataSourceAdapter).
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
 * The error an adapter rejects a poll with when the poll was called off (its signal
 * fired) while the adapter's preparation (prepareForPolling) was still running, such as
 * a replay still reading its recording. The poller records its message as the source's
 * error instead of "Tempo esgotado": the source is not too slow to answer, it is still
 * getting ready, and the operator should read that (gate 2 re-check on PR #16).
 */
export class StillPreparingForPollingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StillPreparingForPollingError';
  }
}

/**
 * An adapter for one kind of source, whose config is `Config` (the kind's schema in
 * @bajaovrlay/shared, decision D4).
 * - `configSchema` checks a config of this kind; the store already stores parsed ones.
 * - `listProducedShapes` says which shapes a source with this config answers, for the
 *   page's binding picker.
 * - `pollOnce` reads the source once and resolves with its shapes, or throws an Error
 *   whose message (pt-BR) the operator reads as the source's error. Every adapter must
 *   honour `context.signal`: one that waits on anything (a network read, a file) passes
 *   the signal on, `fetch(url, { signal: context.signal })`, or stops waiting when it
 *   fires. What goes wrong otherwise: the poll stays in flight past its timeout, the
 *   poller starts no next poll of that source until it settles (never two in flight),
 *   and only the stale watch marks the source late meanwhile. The simulator has nothing
 *   to wait on (a few ms of arithmetic), so it never needs to look at the signal.
 * - `prepareForPolling` (optional) starts any slow preparation, such as reading a
 *   recording into memory, so that polls do not pay for it inside their timeout. The
 *   poller calls it when a source's loop starts (turned on, or at boot) and when the
 *   source's config changes. It must return at once and must not throw: it only starts
 *   the work, and a failure of that work is answered by the polls (a poll that waits for
 *   it rejects with StillPreparingForPollingError when its signal fires first). The
 *   poller calls it from inside the store's listener, which is safe only because it
 *   sends no command and does not wait.
 */
export type DataSourceAdapter<Config> = {
  kind: DataSourceKind;
  configSchema: z.ZodType<Config>;
  listProducedShapes: (config: Config) => DataShapeKey[];
  pollOnce: (config: Config, context: DataSourcePollContext) => Promise<PolledShapes>;
  prepareForPolling?: ((config: Config) => void) | undefined;
};
