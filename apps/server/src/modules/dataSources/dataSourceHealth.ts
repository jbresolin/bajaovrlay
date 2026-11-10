// What "healthy", "stale" and "failing" mean for a source's status, in one place, for the
// reducers that set a status (create, update, enable, the poll results).
import type { DataSourceStatus } from '@bajaovrlay/shared';

// A source is stale after three poll intervals without a good poll (the brief's default):
// one missed poll is a hiccup, three in a row is data the operator should not trust.
const pollIntervalsBeforeStale = 3;

/** How long without a good poll before a source polled at this interval is stale. */
export function computeStaleAfterMs(pollIntervalMs: number): number {
  return pollIntervalsBeforeStale * pollIntervalMs;
}

/** The status of a source that was never polled: no error, not stale. */
export function buildStatusOfANewSource(pollIntervalMs: number): DataSourceStatus {
  return {
    lastError: null,
    consecutiveFailures: 0,
    isStale: false,
    staleAfterMs: computeStaleAfterMs(pollIntervalMs),
    recordingError: null,
  };
}

/** Whether a source's last poll was good: not stale, no error, no failure counted. */
export function isSourceHealthy(status: DataSourceStatus): boolean {
  return !status.isStale && status.lastError === null && status.consecutiveFailures === 0;
}

/**
 * The same status without failingSinceMs, for a source that is no longer failing (a good
 * poll, or turned on or off). The field is removed rather than set to undefined, so the
 * stored JSON and the slice sent to the pages carry no trace of it.
 */
export function removeFailingSinceFromStatus(status: DataSourceStatus): DataSourceStatus {
  const statusThatIsNotFailing = { ...status };
  delete statusThatIsNotFailing.failingSinceMs;
  return statusThatIsNotFailing;
}

/**
 * The same status without isNextPollAFirstPoll, once a good poll has used it up (gate 2
 * of PR #61). Removed rather than set to false, as failingSinceMs is.
 */
export function removeFirstPollMarkFromStatus(status: DataSourceStatus): DataSourceStatus {
  const statusAfterItsFirstPoll = { ...status };
  delete statusAfterItsFirstPoll.isNextPollAFirstPoll;
  return statusAfterItsFirstPoll;
}
