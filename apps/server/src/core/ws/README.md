# apps/server/src/core/ws

The WebSocket hub at `/ws`, on the same port as HTTP. Start reading at
`webSocketHub.ts`: it takes over the HTTP server's upgrades, sends `hello`, broadcasts one
message per state change (`slices`, or `slice` when one slice changed), answers each client message.
A changed snapshot is the exception: an operator gets one `dataSnapshot` per source whose
snapshot changed, just before that `slice`/`slices`, which never carry `dataSnapshots`.

- `connectionActor.ts` — `/ws?role=renderer` is `renderer:<connection id>`, `/ws?role=monitor`
  is `monitor:<id>` (the control page's frames, which may send nothing), else `operador:<id>`.
- `slicesSentToScreens.ts` — renderers and monitors get only `layers`, `graphics`, `instances` and
  `previewClearedLayerIds` (the rest `[]` in hello, left out of changes, no `dataSnapshot`); GET /api/v1/state?role= too.
  A screen is sent a changed slice only when its copy differs from the text it was last sent.
- `clientMessageAnswers.ts` — checks a client message and runs its command (a renderer's `instanceStatus`
  becomes `reportInstanceStatus`); one `commandResult` each; outside the protocol: INVALID_MESSAGE, socket kept.
- `serverMessageBuilding.ts` — builds and validates every outgoing message (`hello` also names the build); `hello`, `slice`,
  `slices`, `dataSnapshot` and `time` carry `serverNowMs`, the server's clock, which pages line their own up with;
  `serverTimeBroadcast.ts` sends `time` to every client every 10 s (the timer is injectable).
- `heartbeat.ts` — pings every 15 s and drops clients that miss a ping.

The message shapes, with one JSON example each: `packages/shared/src/ws/README.md`. Pages
reload themselves when the server's build changes: `hello` carries `buildId` (read from
`build-id.json` by `startServer` once at boot and handed to the hub, so it names the build
this process runs; `pnpm build` writes that file only once every package has built, so a
rebuild with the server up changes nothing until the restart), and a page from another
build reloads, at most once per announced build. A page loaded between a finished build
and the restart carries the new id against the old one, and reloads once for the old id,
then not again until the restart announces another build; restart right after `pnpm build`
all the same, since that page runs the new bundle against the old server meanwhile. Pages opened before PR #17 still need one reload by hand.
