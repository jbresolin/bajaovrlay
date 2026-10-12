# apps/control/src/app

The frame of the control page. Start reading at `AppShell.tsx`.

- `AppShell.tsx` — the header (title, server check, connection badge) and the
  three-column desktop layout of docs/00-concept.md §3.4: rundown; the "Prévia" and
  "Programa" monitors above "Edição rápida" (take, preview and update any graphic); layer
  status + clear all. The left and right columns are fixed (20rem, 22rem); the centre takes
  the rest, which fits both monitors side by side from about 1730 px of window width.

Layout only. What each area does lives in `src/features/<name>/`; where its data comes
from is `src/state/`. `src/App.tsx` draws this shell and `src/main.tsx` connects it to
the server.
