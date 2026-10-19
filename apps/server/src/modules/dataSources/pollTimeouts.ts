// How long the server waits for a data source to answer. It lives in a file of its own
// so the poller and the "Buscar da fonte" sample share one number without importing
// each other.

/**
 * The longest a poll may take, whatever the interval: a source that has not answered in
 * ten seconds is down, and the operator should see it soon (the brief's number).
 */
export const longestPollTimeoutInMilliseconds = 10_000;
