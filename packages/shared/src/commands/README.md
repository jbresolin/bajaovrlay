# packages/shared/src/commands

Commands are the only way state changes. Start reading at `command.ts`, the union of
every command the server accepts; each command has its own file with its input
schema (`takeGraphic.ts`, `clearLayer.ts`, `clearAll.ts`).

`commandError.ts` lists every error code the server can answer with; the pt-BR
messages themselves live in the server's catalog (apps/server/src/core/messages/).

The rules each command follows live in the server's reducers
(apps/server/src/core/store/reducers/), one file per command.
