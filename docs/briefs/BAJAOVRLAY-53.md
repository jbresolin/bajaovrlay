# Agent brief — BAJAOVRLAY-53: flex mapping for the Baja API (joins, alternatives, nested lists, table columns)

Copied from the Plane work item BAJAOVRLAY-53 (child of BAJAOVRLAY-18): the brief of
2026-10-30 and its addition, item 12, the same day. The analysis it builds on is the comment
"The Baja app's results API, read against BajaOvrLay (2026-10-30)" on BAJAOVRLAY-18.

## Brief

**Goal.** The flex source (BAJAOVRLAY-40) must read the Baja app's public results API into session, positions, standings and brackets. The API's contract is `docs/results-api.md` in the Baja app repo (tiagomartines11/baja-sae-brasil-online). Every addition is generic: no Baja word, field name or endpoint appears in BajaOvrLay's code, only in the fixtures and the presets (BAJAOVRLAY-54). Read my analysis on BAJAOVRLAY-18 first; it lists what each shape is missing.

João's rulings (2026-10-30):

* the flex client must be able to join;
* the operator chooses which returned field feeds which target, with alternatives when one is empty, rather than BajaOvrLay knowing about "short names";
* BajaOvrLay works out the gaps;
* a disqualified team's rank is dropped on our side.

### Additions to the mapping (packages/shared/src/flexMapping)

1. **Alternatives.** A field rule's source may be an ordered list (`firstOf`) of the existing sources: a path on the response, a path on the entry, a path on a lookup (item 2), and a `constantValue` last. The first value that is present, not null and not an empty or blank string wins. Two cases this must serve:
   * team name ← short name, else full name;
   * the race clock's `referenceTimeMs` ← `elapsed_ms`, else 0, so a race before its start is a valid session with a stopped clock at 0:00.
2. **Joins (lookups).** This reverses BAJAOVRLAY-40's "no joins"; record it in decisions.md and §8.
   * A shape's mapping may declare named lookups: a request, the path to a list in its response, the key path in each element, and the entry path that holds the key on our side. The case to serve: the race's `cars[].number` against equipes' `teams[].number`.
   * Field rules read `fromLookup: { lookup, path }`.
   * One level of lookup, matched by strict equality.
   * A key with no match leaves that lookup's fields absent, so an alternative can take over. Two elements with the same key is a problem naming the key.
3. **Nested entries.** `entriesPath` may name an outer list and `nestedEntriesPath` the list inside each element; each inner element is one entry. Rules may read `fromParent: path` off the outer element. The case to serve: brackets' `rounds[].matches[]`, with round name and number read from the round. The flat-list mapping of BAJAOVRLAY-25 keeps working.
4. **Table columns.** For a response shaped as `columns[]` plus `rows[].cells[]` (positional), an entries mapping may declare where the columns, their header and each row's cells are. Rules then read `fromColumn: "<header>"` plus a sub-path such as `raw`.
   * Standings' `pointsByPart` is built from a list of headers the operator picks; each header is the part's label and id.
   * A header the response doesn't have is a problem naming it.
   * No positional `cells[9]` in a preset.
5. **Refuse a whole answer by a flag.** A mapping may declare `refuseWhen: { path, equals, message }`. The poll then fails with that pt-BR message, and the last good snapshot stays (rule 4).
   * The case to serve: `spoilers_active: true` → "Resultado com spoilers ativos: a organização esconde as posições agora."
   * On Fontes this must read as that sentence, not as a list of shape problems.
6. **`mapValues` with an `otherwiseValue`.** The API says its word lists may grow. A word with no entry takes `otherwiseValue` when one is given. Without one it is still a problem, as today.
7. **Text read into a text target is trimmed** (spaces collapsed) and its HTML entities decoded (`&nbsp;`, `&amp;`, `&#39;`…). This applies to every flex source, documented in the mapping's README. The real data has "Procobaja " and "Baja SAE BRASIL".

### After the mapping, on the canonical side (applied by applyFlexMapping, so any source gets them)

8. **Gaps.** A positions mapping may switch on `workOutGapsFromLaps`, reading each car's last pass from a new mapping target, `lastPassAtMs`. That target is used only by this step and is not added to the shape.
   * The leader is position 1. A car on the leader's lap gets `gapToLeaderMs` = its last pass − the leader's last pass. A lapped car gets `gapToLeaderLaps` = the difference in laps.
   * `intervalMs` goes to the car directly ahead when the two are on the same lap.
   * Only cars still in the race (running, inPit, stopped) get gaps.
   * Gaps a source sends itself are never overwritten.
   * Each rule gets a table-driven test with real lap numbers, and the README says these gaps are as of the last line crossing.
9. **Disqualified teams lose their rank** in a flex source's standings, so they sit unranked at the end as the shape wants. The shape itself does not change, so a hand-written source with that mistake is still told.
10. **Brackets, contract A on our side.** A match may be marked incomplete by a rule (`entryIsIncompleteWhen`, for example a side's slot type in pending or unknown). The first round holding an incomplete match is left out, with every round after it. A finished round is never lost.
11. **Brackets, contract C on our side.** A third-place round listed after the final is moved just before it.

### Tests (first)

* Every addition gets table-driven tests in testing-style, with a row comment for each case and real Baja data (teams 4 "Sinuelo" FAHOR, 13 "Bombaja" UFSM, …).
* Fixtures under `packages/shared/src/flexMapping/examples/bajaApp/`, real answers saved with curl from `https://api.bajasaebrasil.net/resultados/…`:
  + `equipes` for 26BR and 26SE (26SE has no short names);
  + `resultado` 26BR\_GER (disqualified teams at position 50);
  + `torneio` 26BR\_SPR and 25SU\_SPR (byes, best of 3, third place last);
  + from the doc: the 00NE race ten minutes in, and the 25SU spoilers table;
  + your own pending-slot bracket, made from 25SU\_SPR with the semifinals' winners cleared, and labelled as made up.
* An integration test maps each fixture with a draft preset and passes `validateDataShape`. The presets themselves are BAJAOVRLAY-54's, so keep them in test support here.
* The flex form on Fontes offers every addition, with a component test each. "Testar" on a pasted fixture shows the right shapes, or the spoilers sentence.

### Out of scope

* The presets, importing teams into Cadastros, and the Baja walk end to end: BAJAOVRLAY-54.
* Changes to the Baja app (João's side).
* Incidents: the API has none yet.

### Process

Branch `BAJAOVRLAY-53-flex-mapping-for-the-baja-api` off main, draft PR, the usual verify and 5× pinned run. Record every decision in decisions.md and update §8 of the concept.

## Addition to the brief (João, 2026-10-30)

12. **Each request may set its own refresh time.** A request of a flex source may set `refreshEveryMs`, longer than the source's poll interval.

* Between refreshes, the poll reuses that request's last good response instead of fetching it again.
* The case to serve: the teams list a lookup joins against. It changes once an event, so it is fetched once every 10 minutes while the race is fetched every 2 s.
* If a refresh fails, the poll fails as any failed request does, and the next poll tries that request again. A stale teams list is never reused silently past its time.
* Absent, the request is fetched at every poll, as today.
* A restart or a config change fetches it again.
* Test it with fake time: fetched at the first poll, reused until its time, fetched again after.

Separately, João will add `short_name` and `school_short` to the API's race cars and table rows. The join stays: other sources will need it.
