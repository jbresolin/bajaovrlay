# @bajaovrlay/control

The operator's control page (Vite + React + Tailwind v4 + shadcn/ui). It keeps the rundown, takes
its items and the race clock to air, updates the clock in place, clears layers, and shows what is on
every layer and whether the renderer confirmed it. Start at `src/main.tsx`, `src/app/AppShell.tsx`.

- `src/app/` — the header and the three-column layout.
- `src/features/<name>/` — `connection`, `items`, `layers`, `playout`, `programMonitor`, `rundown`, `serverHealth`.
- `src/state/` — the WebSocket client and the store; the only place server state lives.
- `src/i18n/` — every string the operator reads (`ptBR.ts`). No inline UI text.
- `src/keyboard/`, `src/logging/` — shortcuts (Esc, Backspace, Space, →) and the JSON console log.
- `src/components/ui/` — shadcn/ui components, styled with semantic tokens only.
- `e2e/` — Playwright against the real server on a new SQLite file (`pnpm test:e2e`).

`pnpm build` once (the server only offers built graphics), then `pnpm dev` serves it at
http://localhost:5173, forwarding `/api`, `/ws`, `/health`, `/render`, `/graphics`.
