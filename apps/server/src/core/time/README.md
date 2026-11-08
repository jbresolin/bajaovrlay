# apps/server/src/core/time

The server clock: the one time source for every moment used in clock math. Start at
`serverClock.ts`: monotonic time (`performance.timeOrigin + performance.now()`), set to
the wall clock once at boot, so a step of the wall clock (WSL2's and Docker Desktop's
time sync, about a second every thirty under load) never moves it. `readServerTime` is
the default `readCurrentTime` of the store, the WebSocket hub, the login, the triggers,
the poller and the event runner.

Read from the server clock: a race clock's `referenceWallClockMs`, take-time fields,
`serverNowMs` in messages, a replay's moved moments, an inbox event's `atMs`, and,
because they share the command's one moment, the event log's `ts` and the history.
Read from the wall clock (listed with reasons in `wallClockReadsInTheServer.test.ts`):
backup file names and "Cópia feita às", and the log window of D200 polls.

`serverClockReanchoring.ts` covers the slow drift between the two clocks: once a minute,
50 ms at most, and never while a clock runs on an output (`clocksRunningOnAnOutput.ts`).
