# packages/shared/src/ws — the WebSocket protocol

Schemas for every message on the WebSocket at `/ws`. Start reading at
`serverMessages.ts` (what the server sends) and `clientMessages.ts` (what a client
sends). The server lives in `apps/server/src/core/ws/`. `protocolReadmeExamples.test.ts`
checks that every JSON example below passes its schema, so this page cannot drift.

Every message is one JSON object, told apart by its `type` field:

- `hello` (server → client): every slice, sent once right after the client connects.
- `slice` (server → client): one slice that changed, sent to every client.
  Both carry `serverNowMs`: the server's wall clock, in whole milliseconds since 1970, when
  the message was built. A renderer subtracts its own clock from it and keeps the median of
  the last five differences, so the race clock on air counts on the server's clock
  (`../clock/serverAlignedTime.ts`). The schema lets a message leave it out (test
  stand-ins do); the server always sends it. `commandResult` does not carry it. A message
  without it gives a page no sample at all; it is never read as "the clocks agree".
- `time` (server → every client, every 10 s): `serverNowMs` and nothing else, so a page
  keeps getting samples while no slice changes. Here the field is required. A page
  records the sample and does nothing more with the message.
- `command` (client → server): the only way an operator changes state. `requestId` is
  optional and is echoed in the `commandResult`.
- `instanceStatus` (renderer → server): what really happened to an instance on screen,
  `on-air` after its play finished or `failed` (with an optional `detail`) after an
  import, load or play that did not work. The server turns it into the
  `reportInstanceStatus` command, which only a renderer may send: a connection is a
  renderer when it connects to `/ws?role=renderer`, and an operator otherwise. It
  carries no `requestId`, so its `commandResult` comes back with `requestId: null`.
- `commandResult` (server → the client that sent the command): `ok: true`, or
  `ok: false` with an `error` carrying a stable `code` and a pt-BR `message`. The
  `slice` messages a command causes are sent before its `commandResult`. An accepted
  command that changes nothing (a second `instanceStatus` for an instance already on
  air, a late one for an instance already cleared, a clear of an empty stage) causes no
  `slice` message at all, not even `eventLog`,
  and leaves no event-log entry; its sender still gets `ok: true`.

A message that is not JSON or not in the protocol is answered with an error
`commandResult` (code `INVALID_MESSAGE`, `requestId` echoed when it could be read) and
logged; the socket stays open. The server pings every 15 s and drops a socket that did
not answer the previous ping.

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
    "eventLog": []
  },
  "serverNowMs": 1791550800000
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
    "type": "takeGraphic",
    "graphicId": "race-clock",
    "layerId": "clock",
    "data": { "sessionName": "Enduro de Resistência", "state": "green" }
  }
}
```

## command (update in place)

`data` carries only the fields that change; the instance keeps its id, so the graphic
stays on screen. A field sent as `null` is taken off air. Both this command and
`takeGraphic` accept an optional `takeTimeFieldKeys` (a list of field names, such as
`["referenceWallClockMs"]`): the server writes the command's own moment, in wall-clock
milliseconds, into each of them, so a client never sends its own clock.

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

`previewItem` shows an item on the preview output of its layer (`previewGraphic` does
the same for hand-typed data); `takePreview` then sends exactly what was previewed on
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

## commandResult (error)

```json
{
  "type": "commandResult",
  "requestId": "pedido-18",
  "ok": false,
  "error": { "code": "LAYER_NOT_FOUND", "message": "A camada \"placar\" não existe." }
}
```
