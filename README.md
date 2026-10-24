# BajaOvrLay

Stream graphics for Baja SAE Brasil live streams. Read `CLAUDE.md` first: it is the
contract for how this repository is built, and it summarises the design authority.

- `apps/server` — Node server that owns all state (start here).
- `apps/control` — the operator's control page.
- `apps/renderer` — the page OBS loads as a browser source.
- `packages/shared` — Zod schemas shared by all of the above.
- `packages/graphics` — OGraf graphics, one package each.
- `docs/` — design docs, task briefs and `testing-style.md` (how every test is written).

Needs Node 22 (`.nvmrc`) and pnpm (`corepack enable` once), then `pnpm install` and
`pnpm dev`. CI runs `pnpm lint`, `typecheck`, `test`, `build` and the browser tests in
four parallel jobs, on a PR once it is marked ready for review (`docs/ci.md`).

`pnpm verify` runs the same checks on your machine, in order, and stops at the first one
that fails, naming it; `pnpm verify --quick` leaves out the browser tests. Run it before
every push (`docs/testing-style.md`, "Before you push").
