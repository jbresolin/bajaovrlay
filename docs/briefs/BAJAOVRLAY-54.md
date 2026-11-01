# Agent brief — BAJAOVRLAY-54: Baja app presets and team import

Copied from the Plane work item BAJAOVRLAY-54 (child of BAJAOVRLAY-18): the brief of
2026-11-01. The analysis it builds on is the comment "The Baja app's results API, read
against BajaOvrLay (2026-10-30)" on BAJAOVRLAY-18.

## Brief

**Goal.** On the Fontes page, an operator turns the Baja app's public results API (`https://api.bajasaebrasil.net`, contract in the Baja app repo's `docs/results-api.md`) into working sources in a few clicks. Cadastros also gets the event's teams from it.

Everything is built on the flex mapping of BAJAOVRLAY-53, now on main. Its draft presets live in shared test support (`examples/bajaApp`); this item makes them real. Read my analysis comment on BAJAOVRLAY-18 for what each shape needs.

### Build

1. **Three presets,** kept as JSON in `packages/shared/src/flexMapping/presets/bajaApp/`. Each has its event id and prova or resultado id as parameters, never hard-coded.
   * **Race (`corrida.php?evt&p`) → session + positions.**
     + Teams by a lookup on `equipes.php`, with `refreshEveryMs` 10 minutes. Name and school are alternatives: short form, else the full one.
     + Gaps worked out from laps and last pass. Car order by list order.
     + The clock in elapsed mode, at 0 before the start.
     + State and status mapped with an `otherwiseValue`.
     + `refuseWhen` `simulation: true`, unless the operator ticks "Aceitar corrida simulada" (for tests and rehearsals). Words: "Corrida em modo simulação: marque 'Aceitar corrida simulada' para usar."
   * **Results table (`resultado.php?evt&id`) → standings.**
     + Points from the column named in `ranking.by`, and parts from the headers the operator picks; the preset proposes the overall table's.
     + Disqualified teams unranked.
     + `refuseWhen` spoilers.
     + Names through the teams lookup.
   * **Bracket (`torneio.php?evt&id`) → brackets.**
     + Nested rounds; third place from round −1, a bye as a walkover.
     + A pending or unknown slot marks the match incomplete.
2. **"Adicionar fonte do app Baja"** on Fontes, beside the plain flex source.
   * The operator types the event id (`26BR`). The page reads `evento.php` through the existing sample route, so nothing is fetched from the browser.
   * It lists that event's lap-counted provas, its table resultados and its tournament resultados, each with its pt-BR name, and makes a source from the chosen one's preset.
   * The source is then an ordinary flex source: editable, "Testar" works, export and import work.
   * The host goes on `BAJAOVRLAY_SOURCE_ALLOWED_HOSTS` in `.env.example`'s example and the README.
3. **"Importar equipes do app Baja"** in Cadastros, next to "Importar equipes do simulador". It reads `equipes.php?evt` through the server and uses the same preview and `importEntities` path as the CSV:
   * carro ← number;
   * equipe ← short name, else the full name;
   * escola ← short school, else the full one;
   * escola\_completa ← school;
   * cidade, uf.
   * A team that exists is an update that keeps its images. Names are trimmed and decoded as the flex mapping does.
4. **Docs.** A section in the dataSources README and in `docs/`, "Fontes do app Baja", for the operator:
   * which event id to type;
   * what each source feeds;
   * what "spoilers ativos" and "simulação" mean on Fontes.

### Tests (first)

* **Each preset against every real fixture** from 53 (26BR\_GER, 26BR\_SPR, 25SU\_SPR, equipes 26BR and 26SE, the doc's 00NE race and its before-start version, the 25SU spoilers table) and the made-up pending bracket. Each one either passes `validateDataShape` with the expected first rows, or is refused with the expected sentence.
* A simulated race is refused unless the box is ticked.
* **The "Adicionar fonte" flow,** as component tests with the 26BR `evento` fixture: the lists, the chosen preset's parameters filled in, and the saved config.
* **The team import,** with 26SE: its short names are missing, so the full names are used.
* **One e2e walk:** a local server serves the fixtures, as `pnpm serve:flex-example` does. Add a race source, a GER source and a bracket source, take the tower, the standings and the bracket bound live, and change a fixture to see the tower move.

### Out of scope

* Changes to the Baja app.
* Incidents (the API has none).
* A live counted race. None exists yet; João records the first one with "Gravar".

### Process

Branch `BAJAOVRLAY-54-baja-presets` off main, draft PR, flock'd verify and the 5× pinned run.
