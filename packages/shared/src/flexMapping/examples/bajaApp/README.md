# packages/shared/src/flexMapping/examples/bajaApp

Answers of the Baja app's public results API (`docs/results-api.md` in the Baja app repo),
the fixtures of BAJAOVRLAY-53's and -54's tests. Start with `bajaAppFixtures.testSupport.ts`
beside `applyFlexMapping.ts`, which reads them.

- **Real, saved with curl on 2026-10-30** from `https://api.bajasaebrasil.net/resultados/…`,
  byte for byte (prettier leaves them alone): `equipes-26BR.json` (team 100 has an empty
  short name), `equipes-26SE.json` (no team has a short name), `resultado-26BR_GER.json`
  (cars 46 and 54 disqualified, both "position 50"), `torneio-26BR_SPR.json` and
  `torneio-25SU_SPR.json` (byes, best of 3, the third place listed after the final);
  saved on 2026-11-01 (BAJAOVRLAY-54): `evento-26BR.json` (after the competition: tables
  only, no lap-counted race, no tournament); and on 2026-11-02 (gate 2 of PR #38):
  `equipes-25SU.json`, `resultado-26BR_END.json` (a prova's table, ranked by "Pontos") and
  `resultado-26BR_SGE.json` (a table that ranks nobody: `ranking` null).
- **From the API's doc**, as no counted race exists yet: `corrida-00NE_ZZL.from-doc.json`
  (the race ten minutes in), `corrida-26BR_END-waiting.from-doc.json` (before the start,
  `elapsed_ms` null) and `resultado-25SU_GER-spoilers.from-doc.json` (the doc's one row
  during spoilers, with the real 25SU table's columns and team).
- **Made up**: `torneio-25SU_SPR-pending.made-up.json`, 25SU's Super Prime with the
  semifinals still running, so the final and third place have pending slots;
  `evento-26BR-during-the-event.made-up.json`, the real 26BR event as it would read during
  its competition: the Enduro lap-counted, and the 26BR Super Prime listed as a tournament
  the way 25SU lists its own; `resultado-26BR_END-null-header.made-up.json`, the Enduro table
  with a column with no title (`header` null) and `ranking.by` a formula variable, not a
  header; `resultado-26BR_END-no-ranking-column.made-up.json`, the same with no column
  flagged `ranking: true`.

No BajaOvrLay code names these fields: only these files and the presets (`../../presets/bajaApp/`).
