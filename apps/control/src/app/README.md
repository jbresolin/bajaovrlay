# apps/control/src/app

The frame of the control page. Start reading at `AppShell.tsx`.

- `AppShell.tsx` — the header, always on screen: title, the links to the five pages ("Console",
  "Fontes", "Cadastros", "Eventos", "Saídas"), the data sources chip, server check, connection badge and the "?"
  that lists the shortcuts. Below it, the page the address names.
- `currentPage.ts` — which page the address after "#" names: `#/fontes` is "Fontes de dados"
  (features/dataSources), `#/cadastros` the entity library (features/entityLibrary),
  `#/eventos` the review of the event inbox (features/events), `#/saidas` the outputs and
  their layers (features/outputsAndLayers), anything else the console. No router library and no server change.
- `recordToOpen.ts` — `#/cadastros/team/42`: Cadastros opened on one record, the address
  "Editar no cadastro" in "Edição rápida" opens in a new tab.
- `PageErrorBoundary.tsx` — around "Fontes", "Cadastros", "Eventos" and "Saídas": a bug shows a pt-BR message
  and "Recarregar a página" under the header, never a blank tab.
- `ConsoleView.tsx` — the three-column desktop layout of docs/00-concept.md §3.4: rundown (and
  the page's one item editor); the "Prévia" and "Programa" monitors above "Edição rápida"; the
  quick-fire strip ("Atalhos e macros") above layer status + clear all. The rundown is 21rem,
  the centre a fixed width per window width (40rem from 1800 px, 34rem from 1600, 28rem from
  1344, 18rem below), and the right column takes the rest, the widest at every size
  (BAJAOVRLAY-59); the two monitors are stacked and as wide as the centre. Every console key
  lives inside it, so none fires on "Fontes".

Layout only. What each area does lives in `src/features/<name>/`; where its data comes
from is `src/state/`. `src/App.tsx` draws this shell and `src/main.tsx` connects it to
the server.
