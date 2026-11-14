# @bajaovrlay/shared

Zod schemas and their inferred TypeScript types, shared by the server, the control page
and the renderer. Anything that crosses a boundary (HTTP, WebSocket, commands) is
described here once and validated on both sides.

Start reading at `src/index.ts`, which lists every export. One folder per concept, most
with a README of their own: `health/`, `slices/` (the state the server owns), `commands/`
(the only way state changes), `rundown/`, `quickFire/`, `macros/`, `preview/`, `ws/`,
`clock/`, `raceTimeText/` (lap times and gaps written to the tenth, cut; a Zod-free entry
like `clock/`), `build/` (a page reloading itself when the server's build changes),
`dataShapes/` (the canonical shapes), `dataSources/` (polled sources, recordings),
`transforms/` (the registry of named pure transforms a mapping or a binding applies),
`flexMapping/` (how a flex source's JSON becomes the canonical shapes), `bindings/` (item
fields read from a source, and reading them), `overrides/` (an operator's corrections of a
source's values), `programHistory/` (what each layer showed before its last changes, and the
two undo commands), `eventLogReading/` (each event-log row as a pt-BR sentence, and the
history's filters, for the server and the page alike), `operatorLogin/` (the two roles,
the login body and session answer, and the sentence for a command Dados may not send) and
`consoles/` (a console's id, and what it saw on air at a take, for two consoles on one layer).

**How other packages import it.** `package.json` exports the source file under the
custom condition `@bajaovrlay/source` and the built `dist/` otherwise. Typecheck, Vitest,
Vite and `pnpm dev` turn that condition on, so they read the TypeScript source and need
no build first. Only the built server (`pnpm build`, `pnpm start`) uses `dist/`.
