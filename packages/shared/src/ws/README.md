# packages/shared/src/ws — the WebSocket protocol

Schemas for every message on the WebSocket at `/ws`. Start reading at
`serverMessages.ts` (what the server sends) and `clientMessages.ts` (what a client
sends). The server lives in `apps/server/src/core/ws/`. `protocolReadmeExamples.test.ts`
checks that every JSON example below passes its schema, so this page cannot drift.

Every message is one JSON object, told apart by its `type` field:

- `hello` (server → client): every slice, sent once right after the client connects, and
  the server's build (`buildId`, optional; see "Pages reload themselves" below).
- `slice` (server → client): the one slice a state change changed, sent to every client.
- `slices` (server → client): instead of `slice`, when one state change changed more than
  one slice: every changed slice by name (a part of `hello`'s `slices`, each checked by
  its own schema), so a client takes them in ONE step and never shows the moment between
  them. Every accepted command changes its own slice and `eventLog`, so it sends `slices`
  to an operator; a refused one changes `eventLog` alone and sends `slice`. A screen is
  never sent `eventLog` (below), so it gets fewer slices of the same change. Neither
  `slice` nor `slices` ever carries `dataSnapshots`: after the hello, snapshots travel
  source by source in `dataSnapshot`.
  All three carry `serverNowMs`: the server's wall clock, in whole milliseconds since 1970,
  when the message was built. A renderer subtracts its own clock from it and keeps the
  median of the last five differences, so the race clock on air counts on the server's
  clock (`../clock/serverAlignedTime.ts`). On `hello` and `slice` the schema lets a
  message leave it out (test stand-ins do); the server always sends it, and `slices`
  must. `commandResult` does not carry it. A message without it gives a page no sample at
  all; it is never read as "the clocks agree".
- `dataSnapshot` (server → every operator connection): one source's last good data changed.
  It carries `sourceId`, `snapshot` (the source's new snapshot, or `null` when the source
  was deleted and has none any more) and `serverNowMs` (required). The page replaces that
  source's entry in its `dataSnapshots` list, adds it when it is new, or removes it on
  `null`. Each source whose snapshot changed gets its own message, sent just before the
  `slice` or `slices` of the same change, so a 60-car poll of one source never resends
  another source's data. A poll that changes nothing (the same data on a healthy source)
  sends no message at all, and a failed poll sends the source's new health but no
  `dataSnapshot`: the last good data stays (rule 4).
- `time` (server → every client, every 10 s): `serverNowMs` and nothing else, so a page
  keeps getting samples while no slice changes. Here the field is required. A page
  records the sample and does nothing more with the message.
- `command` (client → server): the only way an operator changes state. `requestId` is
  optional and is echoed in the `commandResult`.
- `instanceStatus` (renderer → server): what really happened to an instance on screen,
  `on-air` after its play finished or `failed` (with an optional `detail`) after an
  import, load or play that did not work. The server turns it into the
  `reportInstanceStatus` command, which only a renderer may send: a connection is a
  renderer when it connects to `/ws?role=renderer`, a monitor when it connects to
  `/ws?role=monitor` (the control page's "Programa" and "Prévia" frames, which may send
  nothing), and an operator otherwise. It carries no `requestId`, so its `commandResult`
  comes back with `requestId: null`.
- `commandResult` (server → the client that sent the command): `ok: true` (with
  `createdItemId` after a `createItem`), or `ok: false` with an `error` carrying a stable
  `code` and a pt-BR `message`. The
  `slice` or `slices` message a command causes is sent before its `commandResult`. An
  accepted command that changes nothing (a second `instanceStatus` for an instance already
  on air, a late one for an instance already cleared, a clear of an empty stage) causes no
  `slice` or `slices` message at all, not even for `eventLog`, and leaves no event-log
  entry; its sender still gets `ok: true`.

A screen connection, renderer (`/ws?role=renderer`) or monitor (`/ws?role=monitor`), is
sent only the four slices it draws: `layers`, `graphics`, `instances` and
`previewClearedLayerIds`. Every other slice is an empty list in its `hello`, is left out
of every change it is sent, and it is never sent a `dataSnapshot`. An accepted command
usually changes its own slice and `eventLog`; a screen gets only the drawn slices among
them, so a take arrives as a single `slice` of `instances`. A change of no drawn slice (a
poll, which changes `dataSources` and a snapshot, or a refused command, which changes
`eventLog` alone) sends a screen nothing. Graphics get resolved data only, a 60-car
snapshot every 2 s is a frame-drop risk in OBS, and a slice a screen never receives can
never make an older screen refuse its `hello`. `GET /api/v1/state?role=renderer` (or
`monitor`) answers the same copy, for a page whose `hello` is late. Every other
connection, the control page itself, gets every slice.

A message that is not JSON or not in the protocol is answered with an error
`commandResult` (code `INVALID_MESSAGE`, `requestId` echoed when it could be read) and
logged; the socket stays open. The server pings every 15 s and drops a socket that did
not answer the previous ping.

**Pages reload themselves when the server's build changes.** An open page only reconnects
its WebSocket when the server restarts; it keeps the bundle it loaded, with that bundle's
schemas, and drops a message they refuse without a word (an older control page dropped
every `dataSnapshot`, its source tables frozen under "Em dia"). So `hello` names the
server's build (`buildId`, the id both Vite builds embed, which `pnpm build` copies to
`build-id.json` once every package has built and the server reads once at boot), and a
page loaded from another build reloads itself, at most once per announced build
(once a minute only when sessionStorage cannot keep that build; `../build/`). The
page reads `buildId` before its own schema checks the rest of the hello, so even a hello it
refuses can make it reload. The field is optional: a server with no `build-id.json` (development) sends
none, a page from the Vite dev server has none, and nothing is compared then. A page
opened before PR #17 knows nothing of `buildId`, so it needs one reload by hand after this
upgrade; every later upgrade reloads the pages by itself. A screen is spared the
data-source kinds anyway: it gets only the slices it draws, `dataSources` reaching it as an
empty list, so a source of a kind it does not know cannot make it refuse its `hello`.

## hello

```json
{
  "type": "hello",
  "slices": {
    "layers": [
      {
        "id": "bug",
        "name": "Logo",
        "zIndex": 10,
        "replacePolicy": "out-then-in",
        "persistent": true
      },
      {
        "id": "clock",
        "name": "Relógio",
        "zIndex": 30,
        "replacePolicy": "out-then-in",
        "persistent": true
      }
    ],
    "graphics": [
      {
        "id": "race-clock",
        "manifest": {
          "id": "baja-race-clock",
          "name": "Relógio de prova",
          "main": "race-clock.js"
        },
        "defaultLayerId": "clock",
        "category": "clock",
        "thumbnailUrl": null,
        "defaultFields": {}
      }
    ],
    "instances": [],
    "previewClearedLayerIds": [],
    "instanceBindings": [],
    "overrides": [],
    "rundowns": [
      {
        "id": "sessao-principal",
        "name": "Sessão principal",
        "sessionLabel": "",
        "cursorItemId": null
      }
    ],
    "items": [],
    "quickFirePanels": [{ "id": "atalhos", "name": "Atalhos", "order": 0 }],
    "macros": [],
    "macroRuns": [],
    "dataSources": [],
    "dataSnapshots": [],
    "recordings": [],
    "events": [],
    "eventRules": [],
    "eventLog": []
  },
  "serverNowMs": 1791550800000,
  "buildId": "2026-10-19T07:40:02.518Z"
}
```

## slice

```json
{
  "type": "slice",
  "name": "instances",
  "slice": [
    {
      "id": "7d3c1a52-4f0e-4b8e-9a51-2f6f1e0c9b11",
      "layerId": "clock",
      "graphicId": "race-clock",
      "target": "program",
      "resolvedData": { "sessionName": "Enduro de Resistência", "state": "green" },
      "currentStep": 0,
      "status": "loading",
      "takenAt": "2026-10-09T13:00:00.000Z"
    }
  ],
  "serverNowMs": 1791550800250
}
```

## slices

What "Prévia: limpar" on the clock layer sends while a preview is shown there: the
preview leaves `instances`, the marker joins `previewClearedLayerIds`, and the event log
gets its line, all in one message.

```json
{
  "type": "slices",
  "slices": {
    "instances": [
      {
        "id": "7d3c1a52-4f0e-4b8e-9a51-2f6f1e0c9b11",
        "layerId": "clock",
        "graphicId": "race-clock",
        "target": "program",
        "resolvedData": { "sessionName": "Enduro de Resistência", "state": "green" },
        "currentStep": 0,
        "status": "on-air",
        "takenAt": "2026-10-09T13:00:00.000Z"
      }
    ],
    "previewClearedLayerIds": ["clock"],
    "eventLog": [
      {
        "id": 18,
        "ts": "2026-10-09T13:05:00.000Z",
        "actor": "operador:3f2a9c1e",
        "command": "previewClearLayer",
        "payload": { "type": "previewClearLayer", "layerId": "clock" },
        "result": { "status": "ok" }
      }
    ]
  },
  "serverNowMs": 1791551100000
}
```

## dataSnapshot

What a good poll of the seeded simulator sends the control page: its new data alone.

```json
{
  "type": "dataSnapshot",
  "sourceId": "simulador-enduro",
  "snapshot": {
    "sourceId": "simulador-enduro",
    "receivedAtMs": 1791550802000,
    "shapes": {
      "session": {
        "sessionId": "enduro-2026-nacional",
        "eventName": "Baja SAE Brasil 2026 — Etapa Nacional",
        "sessionName": "Enduro de Resistência",
        "sessionKind": "enduro",
        "state": "green",
        "clock": {
          "clockMode": "remaining",
          "referenceTimeMs": 12475000,
          "referenceWallClockMs": 1791550802000,
          "running": true
        },
        "lapsCompletedByLeader": 6,
        "updatedAtMs": 1791550802000
      }
    }
  },
  "serverNowMs": 1791550802004
}
```

## dataSnapshot (source deleted)

```json
{
  "type": "dataSnapshot",
  "sourceId": "simulador-enduro",
  "snapshot": null,
  "serverNowMs": 1791551400000
}
```

## time

```json
{ "type": "time", "serverNowMs": 1791550810000 }
```

## command

```json
{
  "type": "command",
  "requestId": "pedido-17",
  "command": {
    "type": "takeItem",
    "itemId": "b1f7c2d0-93a4-4e1b-8c55-0d2a6f3e7a10"
  }
}
```

Everything on air or in preview comes from an item (`takeItem`, `takeNext`, `previewItem`,
a macro). The commands that took or previewed a graphic with hand-typed data,
`takeGraphic` and `previewGraphic`, were removed in BAJAOVRLAY-37 and are refused as
unknown (`INVALID_COMMAND`, naming `type`).

## command (update in place)

`data` carries only the fields that change; the instance keeps its id, so the graphic
stays on screen. It works on a preview instance as well ("Atualizar prévia"). A field sent
as `null` is taken off air. The command accepts an optional `takeTimeFieldKeys` (a list of
field names, such as `["referenceWallClockMs"]`): the server writes the command's own
moment, in wall-clock milliseconds, into each of them, so a client never sends its own
clock. On an instance of an item, the fields sent that now differ from the item are listed
in the instance's `fieldsChangedOnAir`; `saveOnAirChangesIntoItem` (`instanceId`,
`wallClockFields`: `"keepMoment"` or `"atTake"`) writes them into the item.

```json
{
  "type": "command",
  "requestId": "pedido-19",
  "command": {
    "type": "updateInstanceData",
    "instanceId": "7d3c1a52-4f0e-4b8e-9a51-2f6f1e0c9b11",
    "data": { "state": "yellow" }
  }
}
```

## command (preview, then take)

`previewItem` shows an item on the preview output of its layer; `takePreview` then sends
exactly what was previewed on
that layer to program, and `stopPreview` throws it away (`"layerId": null` for every layer).
`"origin"` is optional: `"manual"` when left out; `"auto"` ("Prévia automática") also
discards every other preview that was made with `"auto"`.

```json
{
  "type": "command",
  "requestId": "pedido-20",
  "command": {
    "type": "previewItem",
    "itemId": "b1f7c2d0-93a4-4e1b-8c55-0d2a6f3e7a10",
    "origin": "auto"
  }
}
```

```json
{
  "type": "command",
  "requestId": "pedido-21",
  "command": { "type": "takePreview", "layerId": "clock" }
}
```

## command (Prévia shows the result, then Tomar tudo)

`previewClearLayer` marks a layer "will be cleared": Prévia shows it empty, and the
`previewClearedLayerIds` slice lists it. `previewMacro` shows a macro's end state on the
preview output. `takeAllPreviews` then takes every preview and clears every marked layer
in one state change, or is refused with `NOTHING_IN_PREVIEW` when there is nothing to take.

```json
{
  "type": "command",
  "requestId": "pedido-22",
  "command": { "type": "previewClearLayer", "layerId": "lower-third" }
}
```

```json
{
  "type": "command",
  "requestId": "pedido-23",
  "command": { "type": "takeAllPreviews" }
}
```

## instanceStatus (on air)

```json
{
  "type": "instanceStatus",
  "instanceId": "7d3c1a52-4f0e-4b8e-9a51-2f6f1e0c9b11",
  "status": "on-air"
}
```

## instanceStatus (failed)

```json
{
  "type": "instanceStatus",
  "instanceId": "7d3c1a52-4f0e-4b8e-9a51-2f6f1e0c9b11",
  "status": "failed",
  "detail": "Failed to fetch dynamically imported module: /graphics/race-clock/race-clock.js"
}
```

## commandResult (ok)

```json
{ "type": "commandResult", "requestId": "pedido-17", "ok": true }
```

## commandResult (ok, after a createItem)

The answer to an accepted `createItem` names the item the server made, so the page can
take or preview it next ("Salvar e disparar", "Salvar e prévia").

```json
{
  "type": "commandResult",
  "requestId": "pedido-22",
  "ok": true,
  "createdItemId": "5e8a2c1d-9f3b-4a7e-b6d4-2c1f0e9a8b7c"
}
```

## commandResult (error)

```json
{
  "type": "commandResult",
  "requestId": "pedido-18",
  "ok": false,
  "error": { "code": "LAYER_NOT_FOUND", "message": "A camada \"placar\" não existe." }
}
```
