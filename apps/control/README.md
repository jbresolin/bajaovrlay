# @bajaovrlay/control

The operator's control page (Vite + React + Tailwind v4 + shadcn/ui). It keeps the rundown, previews
and takes its items or any graphic, changes them in place, clears layers, and shows both outputs,
what is on every layer and whether the renderer confirmed it. Forms are generated from each graphic's manifest. Start at `src/main.tsx`, `src/app/AppShell.tsx`.

- `src/app/` (the three-column layout) and `src/features/<name>/`, one folder per feature.
- `src/state/` — the WebSocket client and the store; the only place server state lives.
- `src/i18n/` — every string the operator reads (`ptBR.ts`). No inline UI text.
- `src/keyboard/`, `src/logging/` — shortcuts (Esc, Backspace, Space, Shift+Space, ←, →) and the JSON console log.
- `src/components/ui/` — shadcn/ui components, styled with semantic tokens only.
- `e2e/` — Playwright against the real server on a new SQLite file (`pnpm test:e2e`).

`pnpm build` once (the server only offers built graphics), then `pnpm dev` serves it at
http://localhost:5173, forwarding `/api`, `/ws`, `/health`, `/render`, `/graphics`.
