# @bajaovrlay/shared

Zod schemas and the TypeScript types inferred from them, shared by the server, the
control page and the renderer. Anything that crosses a boundary (HTTP, WebSocket,
commands) is described here once and validated on both sides.

Start reading at `src/index.ts`, which lists every export. Each concept has its own
folder (`src/health/` today; slices, commands and the WS protocol later).

**How other packages import it.** `package.json` exports the source file under the
custom condition `@bajaovrlay/source` and the built `dist/` otherwise. Typecheck, Vitest,
Vite and `pnpm dev` all turn that condition on, so they read the TypeScript source and
never need a build first. Only the built server (`pnpm build`, `pnpm start`) uses
`dist/`, which `pnpm build` produces before building the server.
