# apps/server/src/core/boot

Booting and stopping the whole server. Start reading at `startServer.ts`: open the
database (migrations; fail closed) → load or seed the store → start the auto-out
scheduler (`../store/autoOut.ts`) → build the HTTP app → listen → attach the WebSocket
hub to the same port. `close()` undoes it all, calling off pending auto-outs first.

`src/main.ts` only reads the environment, works out the paths, and calls
`startServer`; it exits non-zero with a logged error if the boot rejects.
