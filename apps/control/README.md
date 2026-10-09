# @bajaovrlay/control

The operator's control page: Vite + React + Tailwind v4 + shadcn/ui. Today it shows the
product name and a button that checks `GET /health`; real features arrive from M1.

Start reading at `src/App.tsx`, then `src/features/serverHealth/`.

- `src/features/<name>/` — one folder per feature: its components and hooks.
- `src/components/ui/` — shadcn/ui components (only `button.tsx` so far). Style them with
  the semantic tokens defined in `src/index.css` only, never raw colours.
- `src/i18n/ptBR.ts` — every string the operator reads. No inline UI text.
- `src/state/` — the WebSocket client and store (from BAJAOVRLAY-8 onwards).

`pnpm dev` (repo root) serves it at http://localhost:5173 and forwards `/api`, `/ws` and
`/health` to the server. `pnpm build` writes `dist/`, which the server serves at `/`.
