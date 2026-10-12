# apps/control/src/app

The frame of the control page. Start reading at `AppShell.tsx`.

- `AppShell.tsx` — the header (title, server check, connection badge) and the
  three-column desktop layout of docs/00-concept.md §3.4: rundown, program monitor +
  "Edição rápida" (take and update any graphic), layer status + clear all.

Layout only. What each area does lives in `src/features/<name>/`; where its data comes
from is `src/state/`. `src/App.tsx` draws this shell and `src/main.tsx` connects it to
the server.
