# apps/control/src/app

The frame of the control page. Start reading at `AppShell.tsx`.

- `AppShell.tsx` — the header, always on screen: title, the links to the three pages ("Console",
  "Fontes", "Cadastros"), the data sources chip, server check, connection badge and the "?"
  that lists the shortcuts. Below it, the page the address names.
- `currentPage.ts` — which page the address after "#" names: `#/fontes` is "Fontes de dados"
  (features/dataSources), `#/cadastros` the entity library (features/entityLibrary), anything
  else the console. No router library and no server change.
- `ConsoleView.tsx` — the three-column desktop layout of docs/00-concept.md §3.4: rundown (and
  the page's one item editor); the "Prévia" and "Programa" monitors above "Edição rápida"; the
  quick-fire strip ("Atalhos e macros") above layer status + clear all. The left and right
  columns are fixed (20rem, 22rem); the centre takes the rest; the two monitors stay side by
  side and shrink together below about 1730 px. Every console key lives inside it, so none
  fires on "Fontes".

Layout only. What each area does lives in `src/features/<name>/`; where its data comes
from is `src/state/`. `src/App.tsx` draws this shell and `src/main.tsx` connects it to
the server.
