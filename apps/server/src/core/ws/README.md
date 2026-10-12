# apps/server/src/core/ws

The WebSocket hub at `/ws`, on the same port as HTTP. Start reading at
`webSocketHub.ts`: it takes over the HTTP server's upgrades, sends `hello`, broadcasts
a `slice` message for each changed slice, and answers each client message.

- `connectionActor.ts` — `/ws?role=renderer` is `renderer:<connection id>`, else `operador:<id>`.
- `clientMessageAnswers.ts` — checks a client message and runs its command. A renderer's
  `instanceStatus` becomes the `reportInstanceStatus` command, on the same command path. Every
  message gets one `commandResult`; outside the protocol: INVALID_MESSAGE, never a closed socket.
- `serverMessageBuilding.ts` — builds and validates every outgoing message; `hello` and
  `slice` carry `serverNowMs`, the server's clock, which renderers line their own up with.
- `heartbeat.ts` — pings every 15 s and drops clients that miss a ping.

The message shapes, with one JSON example each: `packages/shared/src/ws/README.md`.
