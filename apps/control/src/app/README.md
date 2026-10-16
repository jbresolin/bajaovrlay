# apps/control/src/app

The frame of the control page. Start reading at `AppShell.tsx`.

- `AppShell.tsx` — the header (title, server check, connection badge, the "?" that lists the
  shortcuts) and the three-column desktop layout of docs/00-concept.md §3.4: rundown (and the
  page's one item editor); the "Prévia" and "Programa" monitors above "Edição rápida"; the
  quick-fire strip ("Atalhos e macros") above layer status + clear all. The left and right
  columns are fixed (20rem, 22rem); the centre takes the rest; the two monitors stay side by
  side and shrink together below about 1730 px.

Layout only. What each area does lives in `src/features/<name>/`; where its data comes
from is `src/state/`. `src/App.tsx` draws this shell and `src/main.tsx` connects it to
the server.
