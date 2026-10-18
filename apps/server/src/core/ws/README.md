# apps/server/src/core/ws

The WebSocket hub at `/ws`, on the same port as HTTP. Start reading at
`webSocketHub.ts`: it takes over the HTTP server's upgrades, sends `hello`, broadcasts one
message per state change (`slices`, or `slice` when one slice changed), answers each client message.
A changed snapshot is the exception: an operator gets one `dataSnapshot` per source whose
snapshot changed, just before that `slice`/`slices`, which never carry `dataSnapshots`.

- `connectionActor.ts` — `/ws?role=renderer` is `renderer:<connection id>`, `/ws?role=monitor`
  is `monitor:<id>` (the control page's frames, which may send nothing), else `operador:<id>`.
- `slicesHiddenFromScreens.ts` — renderers and monitors never get `dataSnapshots` or `eventLog`
  (`[]` in hello, left out of changes, no `dataSnapshot`); GET /api/v1/state?role= uses the same filter.
- `clientMessageAnswers.ts` — checks a client message and runs its command (a renderer's `instanceStatus`
  becomes `reportInstanceStatus`); one `commandResult` each; outside the protocol: INVALID_MESSAGE, socket kept.
- `serverMessageBuilding.ts` — builds and validates every outgoing message; `hello`, `slice`,
  `slices`, `dataSnapshot` and `time` carry `serverNowMs`, the server's clock, which pages line their own up with;
  `serverTimeBroadcast.ts` sends `time` to every client every 10 s (the timer is injectable).
- `heartbeat.ts` — pings every 15 s and drops clients that miss a ping.

The message shapes, with one JSON example each: `packages/shared/src/ws/README.md`.
