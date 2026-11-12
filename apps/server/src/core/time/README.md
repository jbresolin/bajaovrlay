# apps/server/src/core/time

The server clock: the one time source for clock math, kept on real time from NTP
(BAJAOVRLAY-62). Start at `serverClock.ts`: monotonic time times a rate (ramped to over a
minute), plus a slew of at most 0.5%, plus counted steps; it never reads the wall clock
after it starts. `readServerTime` is every `readCurrentTime`'s default.
`serverClockDiscipline.ts` polls NTP (every 16 s, then 64 s: `serverClockPollIntervals.ts`)
through `ntpPolls.ts` (DNS, 2 s between questions) and `ntpClient.ts` (one connected UDP
question, bad answers refused), on the servers of `ntpSettings.ts`. It ramps to the rate of
`realTimeRate.ts`, slews under 1 s, and steps a confirmed 1 s or more unless the step would
make something on air jump (`timeCountedOnAnOutput.ts`); never over 24 h on its own.
While NTP is quiet for a full poll interval (64 s), `httpDateClient.ts` feeds the same
discipline from HTTPS Date headers (BAJAOVRLAY-76; `httpHeadRequest.ts` makes the requests,
`httpTimeSettings.ts` reads the servers); `serverClockSourceFollowed.ts` keeps which source
is followed and whether the clock is without sync, `realTimeRateWindow.ts` the rate's window.
`serverClockControl.ts` is what /health, the `time` message and "Acertar relógio agora" see.
On the server clock: reference moments, take times, `serverNowMs`, a replay's moments, an
inbox event's `atMs`, the event log and the history. On the wall clock (with reasons in
`wallClockReadsInTheServer.test.ts`): backup file names, and the D200 poll log window.
