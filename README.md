# BajaOvrLay

Stream graphics for Baja SAE Brasil live streams. Read `CLAUDE.md` first: it is the
contract for how this repository is built, and it summarises the design authority.

- `apps/server` — Node server that owns all state (start here).
- `apps/control` — the operator's control page.
- `apps/renderer` — the page OBS loads as a browser source.
- `packages/shared` — Zod schemas shared by all of the above.
- `packages/graphics` — OGraf graphics, one package each.
- `docs/` — design docs, task briefs and `testing-style.md` (how every test is written).

Requirements: Node 22 (`.nvmrc`) and pnpm (version pinned in `package.json`; run
`corepack enable` once). Then `pnpm install` and `pnpm dev`.

Checks, all run by CI on every pull request: `pnpm lint`, `pnpm typecheck`, `pnpm test`,
`pnpm build`, `pnpm test:e2e`.
