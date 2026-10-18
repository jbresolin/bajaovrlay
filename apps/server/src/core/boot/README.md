# apps/server/src/core/boot

Booting and stopping the whole server. Start reading at `startServer.ts`: open the
database (migrations; fail closed) → load or seed the store → start the auto-out
scheduler (`../store/autoOut.ts`), the macro runner and the data-source service
(`modules/dataSources/service.ts`: polls every source that is on) → build the HTTP app
→ listen → attach the WebSocket hub to the same port. `close()` undoes it all, stopping
the data-source poller and calling off pending auto-outs first.

`src/main.ts` only reads the environment, works out the paths (the database file and
the data folder, DATA_DIR, both read from the repository root when relative), and calls
`startServer`; it exits non-zero with a logged error if the boot rejects.
