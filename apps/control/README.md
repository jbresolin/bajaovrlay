# @bajaovrlay/control

The operator's control page (Vite + React + Tailwind v4 + shadcn/ui). In M0 it takes the
race clock to air, clears layers, and always shows what is on every layer. Start reading
at `src/main.tsx`, then `src/app/AppShell.tsx`.

- `src/app/` — the header and the three-column layout.
- `src/features/<name>/` — `connection`, `layers`, `playout`, `programMonitor`, `serverHealth`.
- `src/state/` — the WebSocket client and the store; the only place server state lives.
- `src/i18n/` — every string the operator reads (`ptBR.ts`). No inline UI text.
- `src/keyboard/`, `src/logging/` — shortcuts (Esc, Backspace) and the JSON console log.
- `src/components/ui/` — shadcn/ui components, styled with semantic tokens only.
- `e2e/` — Playwright against the real server on a new SQLite file (`pnpm test:e2e`).

`pnpm build` once (the server only offers built graphics), then `pnpm dev` serves it at
http://localhost:5173, forwarding `/api`, `/ws`, `/health`, `/render`, `/graphics`.
