# apps/server/src/core/time

The server clock: the one time source for clock math, kept on real time from NTP
(BAJAOVRLAY-62). Start at `serverClock.ts`: monotonic time times a rate, plus a slew of at
most 0.5%, plus steps; it never reads the wall clock after it starts, so a time sync's
step never moves it. `readServerTime` is every `readCurrentTime`'s default.
`serverClockDiscipline.ts` polls NTP every 64 s (`ntpPolls.ts`, `ntpClient.ts`, the servers
of `ntpSettings.ts`), runs at the rate of `realTimeRate.ts`, slews under 1 s and steps a
confirmed 1 s or more unless something on air counts time (`timeCountedOnAnOutput.ts`);
the boot steps first. `serverClockControl.ts` is what /health, the `time` message and
"Acertar relógio agora" see.
On the server clock: reference moments, take times, `serverNowMs`, a replay's moments, an
inbox event's `atMs`, the event log and the history. On the wall clock (with reasons in
`wallClockReadsInTheServer.test.ts`): backup file names, and the D200 poll log window.
