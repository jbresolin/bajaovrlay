# @bajaovrlay/shared

Zod schemas and their inferred TypeScript types, shared by the server, the control page
and the renderer. Anything that crosses a boundary (HTTP, WebSocket, commands) is
described here once and validated on both sides.

Start reading at `src/index.ts`, which lists every export. One folder per concept, most
with a README of their own: `health/`, `slices/` (the state the server owns), `commands/`
(the only way state changes), `rundown/`, `quickFire/`, `macros/`, `preview/`, `ws/`,
`clock/`, `dataShapes/` (the canonical shapes), `dataSources/` (polled sources, recordings),
`transforms/` (the registry of named pure transforms a mapping applies), `flexMapping/` (how
a flex source's JSON becomes the canonical shapes).

**How other packages import it.** `package.json` exports the source file under the
custom condition `@bajaovrlay/source` and the built `dist/` otherwise. Typecheck, Vitest,
Vite and `pnpm dev` turn that condition on, so they read the TypeScript source and need
no build first. Only the built server (`pnpm build`, `pnpm start`) uses `dist/`.
