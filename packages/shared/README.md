# @bajaovrlay/shared

Zod schemas and their inferred TypeScript types, shared by the server, the control page
and the renderer. Anything that crosses a boundary (HTTP, WebSocket, commands) is
described here once and validated on both sides.

Start reading at `src/index.ts`, which lists every export. One folder per concept:
`src/health/`, `src/slices/` (the state the server owns), `src/commands/` (the only way
state changes), `src/rundown/` (rundowns, items and their home, their commands),
`src/quickFire/` (quick-fire panels), `src/macros/` (macros, runs, their commands),
`src/preview/` (the preview commands), `src/ws/` (the WebSocket protocol), `src/clock/`
(clock arithmetic).

**How other packages import it.** `package.json` exports the source file under the
custom condition `@bajaovrlay/source` and the built `dist/` otherwise. Typecheck, Vitest,
Vite and `pnpm dev` turn that condition on, so they read the TypeScript source and need
no build first. Only the built server (`pnpm build`, `pnpm start`) uses `dist/`.
