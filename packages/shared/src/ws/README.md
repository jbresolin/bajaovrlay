# packages/shared/src/ws — the WebSocket protocol

Schemas for every message on the WebSocket at `/ws`. Start reading at
`serverMessages.ts` (what the server sends) and `clientMessages.ts` (what a client
sends). The server lives in `apps/server/src/core/ws/`. `protocolReadmeExamples.test.ts`
checks that every JSON example below passes its schema, so this page cannot drift.

Every message is one JSON object, told apart by its `type` field:

- `hello` (server → client): every slice, sent once right after the client connects.
- `slice` (server → client): one slice that changed, sent to every client.
- `command` (client → server): the only way a client changes state. `requestId` is
  optional and is echoed in the `commandResult`.
- `commandResult` (server → the client that sent the command): `ok: true`, or
  `ok: false` with an `error` carrying a stable `code` and a pt-BR `message`. The
  `slice` messages a command causes are sent before its `commandResult`.

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
