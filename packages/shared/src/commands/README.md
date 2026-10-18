# packages/shared/src/commands

Commands are the only way state changes. Start reading at `command.ts`, the union of
every command the server accepts; each command has its own file with its input
schema: `updateInstanceData.ts` (change what an instance shows, in place, on air or in
preview), `reportInstanceStatus.ts` (the renderer saying on-air or failed; it arrives as
an `instanceStatus` WebSocket message, see ../ws/), `clearLayer.ts`, `clearAll.ts`.
In the `data` of an update a top-level `null` is a cleared field (taken off air), and a
field named in `takeTimeFieldKeys` (default `[]`) is written by the server with the
command's moment in wall-clock milliseconds. No command puts a graphic up by itself:
since BAJAOVRLAY-37 everything on air or in preview comes from an item (`takeGraphic` and
`previewGraphic` were removed).
`commandError.ts` lists every error code the server can answer with; the pt-BR
messages themselves live in the server's catalog (apps/server/src/core/messages/).
The rules each command follows live in the server's reducers, one file per command.
The item and rundown commands (`createItem`, `takeItem`, `saveOnAirChangesIntoItem`, ...)
and the preview commands
(`previewItem`, `takePreview`, ...) are in the same union; their schemas live in `../rundown/` and `../preview/`.
