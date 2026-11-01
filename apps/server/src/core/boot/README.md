# apps/server/src/core/boot

Booting and stopping the whole server. Start reading at `startServer.ts`: open the
database (migrations; fail closed) → load or seed the store → start the auto-out
scheduler (`../store/autoOut.ts`), the macro runner and the data-source service
(`modules/dataSources/service.ts`: polls every source that is on) → build the HTTP app
→ listen → attach the WebSocket hub to the same port. `close()` undoes it all, stopping
the data-source poller and calling off pending auto-outs first.

`src/main.ts` only reads the environment, works out the paths (the database file and
the data folder, DATA_DIR, both read from the repository root when relative), and calls
`startServer` with the parsed BAJAOVRLAY_SOURCE_ALLOWED_HOSTS, which startServer hands to
the store, the data-source service and the HTTP app; it exits non-zero with a logged error
if the boot rejects. On SIGTERM or SIGINT it calls `shutDownTheServer.ts`: close, then
exit 0, or 1 with the error logged if closing fails.
Tests: `startServer.test.ts` (boot and close), `shutDownTheServer.test.ts` (the exit codes), `startServerRestart.test.ts` (a restart
keeps the last good data), `startServerSourceHostAllowlist.test.ts` (the host list wired
through, and the boot warning without it); shared options in `bootedServer.testSupport.ts`.
