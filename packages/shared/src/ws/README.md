# packages/shared/src/ws — the WebSocket protocol

Schemas for every message on the WebSocket at `/ws`. Start reading at
`serverMessages.ts` (what the server sends) and `clientMessages.ts` (what a client
sends). The server lives in `apps/server/src/core/ws/`. `protocolReadmeExamples.test.ts`
checks that every JSON example below passes its schema, so this page cannot drift.

Every message is one JSON object, told apart by its `type` field:

- `hello` (server → client): every slice, sent once right after the client connects.
- `slice` (server → client): one slice that changed, sent to every client.
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
    "eventLog": []
  }
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
  ]
}
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
stays on screen.

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
