# packages/shared/src/commands

Commands are the only way state changes. Start reading at `command.ts`, the union of
every command the server accepts; each command has its own file with its input
schema: `takeGraphic.ts`, `updateInstanceData.ts` (change what an instance shows, in
place), `reportInstanceStatus.ts` (the renderer saying on-air or failed; it arrives as
an `instanceStatus` WebSocket message, see ../ws/), `clearLayer.ts`, `clearAll.ts`.
In the `data` of a take or an update a top-level `null` is a cleared field (left out of
a take, taken off air by an update), and a field named in `takeTimeFieldKeys` (default
`[]`) is written by the server with the command's moment in wall-clock milliseconds.
`commandError.ts` lists every error code the server can answer with; the pt-BR
messages themselves live in the server's catalog (apps/server/src/core/messages/).
The rules each command follows live in the server's reducers, one file per command.
The item and rundown commands (`createItem`, `takeItem`, ...) and the preview commands
(`previewItem`, `takePreview`, ...) are in the same union; their schemas live in `../rundown/` and `../preview/`.
