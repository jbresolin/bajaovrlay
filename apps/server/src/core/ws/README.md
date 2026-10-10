# apps/server/src/core/ws

The WebSocket hub at `/ws`, on the same port as HTTP. Start reading at
`webSocketHub.ts`: it takes over the HTTP server's upgrades, sends `hello`, broadcasts
a `slice` message for each changed slice, and answers each client message.

- `connectionActor.ts` — names a connection: `/ws?role=renderer` is
  `renderer:<connection id>`, anything else `operador:<connection id>`.
- `clientMessageAnswers.ts` — checks a client message and runs its command. A renderer's
  `instanceStatus` becomes the `reportInstanceStatus` command, on the same command path.
  Every message gets exactly one `commandResult` (`requestId` is `null` for
  `instanceStatus`, which carries none); anything outside the protocol gets
  INVALID_MESSAGE, never a closed socket.
- `serverMessageBuilding.ts` — builds and validates every outgoing message.
- `heartbeat.ts` — pings every 15 s and drops clients that miss a ping.

The message shapes, with one JSON example each, are in
`packages/shared/src/ws/README.md`.
