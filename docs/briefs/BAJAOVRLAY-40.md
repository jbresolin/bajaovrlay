# Agent brief — BAJAOVRLAY-40: the flex HTTP/JSON source

**Branch:** `BAJAOVRLAY-40-flex-http-json-source` off an up-to-date `main` (at or after eeef433, PR #16). **One PR**, left open for João's review. Do not merge. Work through the commit order at the end, tests first at every step, and keep going without asking. Where this brief leaves a choice open, take the plainer option, write it in `docs/decisions.md` and under "Decisions taken" in the PR, and move on.

**Read first:**

- `CLAUDE.md`, all of it (readability law, testing policy, architecture rules 1–5, especially rule 5);
- `docs/00-concept.md` §4 (the dataSources paragraphs, the transforms line, FieldValue binding), §5, §8 (the as-built canonical shapes and adapter interface);
- `docs/decisions.md`, everything from PR #16;
- `docs/testing-style.md`;
- `apps/server/src/modules/dataSources/` — README, `adapters/dataSourceAdapter.ts`, `adapters/createDataSourceAdapters.ts`, the replay adapter as the example of honouring the AbortSignal, `poller.ts`, `reducers/recordDataSourcePoll.ts`, `loadDataSourceSlices.ts`;
- `packages/shared/src/dataShapes/` (the shapes, `validateDataShape`, `bindablePaths.ts` as the model for a hand-listed field list) and `packages/shared/src/dataSources/` (how a kind's config schema is declared);
- `apps/server/src/core/db/sliceRowStorage.ts`, `apps/server/src/core/ws/serverMessageBuilding.ts`, `apps/server/src/core/ws/slicesHiddenFromScreens.ts`, `packages/shared/src/ws/serverMessages.ts`;
- `apps/control/src/features/dataSources/` (README, `DataSourceRow.tsx`, the two source forms, `timingScreenText.ts`).

## Why

The scoring app is the main source, but there will be others: a sheet, another timing system, a committee's JSON file. João wants our side as flexible as possible, so instead of one hand-written adapter per source, this PR builds **one adapter for any JSON API**: an operator (or a preset file) says which URLs to fetch and how their JSON maps into the canonical shapes, and the source then behaves like every other one (polled, stale-marked, recorded, replayed).

The Baja app source (BAJAOVRLAY-18) becomes nothing more than a configuration of this kind once its endpoints exist.

The mapping is **declarative**: paths, renames, constants and named transforms from a registry. Never a free-form expression, a template language or user code (architecture rule 5). What a mapping can do is exactly what the registry lists, so a reviewer can read every possible behaviour, and nothing surprising reaches the air.

Nothing on air changes in this PR. Bindings stay BAJAOVRLAY-20.

This PR also carries four things left over from PR #16: the source card click, one snapshot row and message per source, fetch honouring the abort signal, and gap precision (section E).

## Deliverable

### A. The transform registry (packages/shared) — architecture rule 5

There is no transform code yet: concept §4 names the registry, and this PR creates it. New folder `packages/shared/src/transforms/` with a README.

- A transform is an entry with an `id`, a pt-BR `label` and `description`, an optional Zod `parametersSchema` and a pure `apply(value, parameters)`. It returns `{ ok: true, value }` or `{ ok: false, reason }` with a pt-BR reason that quotes the value it could not read. A transform never throws, reads no clock and keeps no memory.
- `transformRegistry.ts` lists every transform by id, and `findTransform(id)` reads one. Unknown ids are refused when a config is validated, not at poll time.
- The transforms this PR needs are the ones that bring outside data **into** the canonical shapes. One file per group, each named for what it holds:
  - `textToNumber`: "12,5" and "12.5" both become 12.5. Ambiguous text such as "1.234,5" is refused, not guessed.
  - `textToInteger`: "42" becomes 42 (whole numbers only).
  - `secondsToMs`: 278.293 becomes 278 293 (number of seconds to integer ms, rounded to the nearest ms).
  - `lapTimeTextToMs`: "4:38.293", "4:38,293", "278.293" and "1:02:03.4" become ms.
  - `isoDateTextToMs`: an ISO 8601 moment with a zone becomes ms since 1970. A moment with no zone is refused, because guessing the zone is how a clock ends up three hours off.
  - `unixSecondsToMs`: a moment in seconds since 1970 becomes ms.
  - `trimText`: removes the spaces at either end.
  - `mapValues`: the one transform with parameters, a table from the source's value (text, as JSON keys are) to **any JSON value**: `{ "PIT": "inPit", "RUN": "running" }` for a status, and equally `{ "RUN": true, "STOP": false }` so a source's own run code can feed `clock.running`, or `{ "1": "green", "4": "red" }` for a numeric flag code (a number or boolean source value is matched by its JSON text, "1", "true"). A value missing from the table is refused with a reason naming it, never passed through. This is how a source's own status codes, flag names and switches become the canonical values; the canonical validation after the mapping still checks the result.
- The presentation transforms concept §4 names (`topN`, `formatLapTime`, `abbreviateUniversity`) are **not** in this PR. They belong to bindings (BAJAOVRLAY-20), which add them to this same registry. Say so in the README.

### B. The mapping (packages/shared) — pure, shared by server and page

New folder `packages/shared/src/flexMapping/` with a README. It holds pure code only, so the server's adapter and the page's "Testar" panel (D) run **the same function** on the same input.

**Paths.** `readValueAtPath(json, path)`. A path is dot segments and numeric indices: `dados.corrida.carros[3].equipe`. It has no wildcards, filters, recursion or functions. A key with a dot or bracket in it is out of scope; say so in the README. The parser is hand-written in steps and has a table test of good and refused paths.

**The mapping config** (a Zod schema here; the source config in C embeds it). One entry per produced shape, each with:

- `shapeKey` (one of the four, each at most once per source) and `requestId` (the request whose response it reads, see C);
- for `session`: `fields`, the list of canonical field rules;
- for `positions` and `standings`: `entriesPath` (the path to the array in the response), `entryFields` (rules applied to each array element) and `fields` (rules for the top-level fields such as `sessionId`, `updatedAtMs` and standings' `scope`);
- for `brackets`: **left out of this PR**. It is a draft shape (BAJAOVRLAY-25), and a nested rounds-of-matches mapping would double the mapping code for a shape nobody sends yet. Leave a README note.

A **field rule** is `targetField` (a canonical field name, nested with a dot for `clock.referenceTimeMs`) plus exactly one source:

- `fromPath` (read from the response, or from the entry for entry fields), with an optional `transformId` and its `transformParameters`;
- `constantValue` (for example `sessionKind: "enduro"`, or a `scope` the source does not send);
- `fromListOrder` (entries only: the 1-based place in the array), for a source that sends a list already in order but no position or rank number;
- `fromPollMoment` (the moment of the poll on the server's clock), for a source that sends no `updatedAtMs`.

**One request per shape, and no joins.** A shape's rules read one response only. Positions and standings require `teamName` and `schoolName` on every entry, so a source whose timing endpoint gives car numbers only, with the names in another endpoint, cannot be mapped by this PR. That is deliberate: a join across requests is a second mechanism to read and test, and for the main source we control the endpoints, so the fix is upstream (the BAJAOVRLAY-18 endpoint spec asks that every entry carry car number, team and school). Write this limit in the `flexMapping/` README and in concept §8, and do not build a join. The entity library (BAJAOVRLAY-19) may later fill names by `carNumber`; that is its decision, not this PR's.

One transform per rule. A chain of transforms is out of scope, because every case the Baja app is likely to need is covered by one (`lapTimeTextToMs` reads plain seconds too). Record the decision.

**Which canonical fields can be targeted:** `listMappableFieldsOfShape(shapeKey)`, hand-listed like `bindablePaths.ts`. Each field has a pt-BR label, whether it is required, and whether it is a top-level or an entry field. A test fixes the list, and a test proves every listed field exists in the shape's schema.

**Applying it:** `applyFlexMapping(mapping, responsesByRequestId, pollMomentMs)` returns `{ ok: true, shapes }` or `{ ok: false, problems }`, where each problem is a pt-BR line naming the shape, the entry index when there is one, the target field and the source path ("Posições › carro 7 (linha 3) › Última volta: não consegui ler "4:3x.293" em tempos.ultima"). Rules:

- A path that is missing, or that holds `null`, leaves the field out: optional means "the source does not know" (§8). If the field is required, the canonical validation that follows says so.
- A transform that refuses fails the whole poll. No field is silently dropped because its value was unreadable.
- Unknown extra fields in the response are ignored.
- The output then goes through `validateDataShape` exactly as every other adapter's does (the store already does this in `recordDataSourcePoll`). The page's "Testar" runs the same validation, so what the operator sees there is what the poller will accept.
- Report up to the first 20 problems, not only the first one: someone writing a mapping wants to fix them in one go. The poll error stored on the source is the first problem plus "e mais N problemas".

### C. The adapter kind `httpJson` (shared + server)

`DataSourceKindSchema` gains `httpJson`, labelled "HTTP/JSON (flexível)". Its config schema lives in `packages/shared/src/dataSources/httpJsonConfig.ts`:

- `requests`: 1 to 5 entries, each with:
  - `requestId` (a short name, unique within the source: "classificacao");
  - `url` (http or https only);
  - `headers`, a list of `{ name, value }` or `{ name, valueFromEnvironment }`;
  - `queryParameters`, the same two forms.

  GET only: a poll must not change anything on the other side. Record the decision.
- `mappings`: the mapping config of B. Every `requestId` a mapping names must exist, and every `transformId` must exist in the registry with valid parameters. Both are checked by the config schema, so `createDataSource` refuses them with `INVALID_DATA_SOURCE_CONFIG` naming the path.

**Secrets never enter state.** The dataSources slice is sent to every operator connection and logged in the event log. A token typed into a config would therefore sit in the database, the log and every browser. So a secret header or query parameter names an environment variable (`valueFromEnvironment`), and the server reads it at poll time. To stop a config from sending some other server secret to an arbitrary URL, only names starting with `BAJAOVRLAY_SOURCE_` are accepted (checked by the schema). A variable that is not set fails the poll with "A variável de ambiente BAJAOVRLAY_SOURCE_BAJA_TOKEN não está definida no servidor." Document the prefix in `.env.example` with a commented example, and never log a header value.

**The adapter** (`modules/dataSources/adapters/httpJson/`):

- `listProducedShapes(config)` returns the mappings' shape keys.
- `pollOnce` fetches every request in parallel, each with `fetch(url, { signal: context.signal })` (the PR #16 note). Then it reads each body as JSON and calls `applyFlexMapping` with the poll moment from `context.readCurrentTime()`.
- If any request fails, the whole poll fails: a source never half-succeeds, the same rule as the shapes. The pt-BR errors are, each with its own test:
  - "Tempo esgotado" (the poller's existing message) when the signal fires;
  - "A fonte respondeu 503 (Service Unavailable) em classificacao" for an answer outside 2xx;
  - "A resposta de classificacao não é JSON válido";
  - "A resposta de classificacao passou de 5 MB" for a body over 5 MB, read as a stream and stopped at the cap, so a runaway endpoint cannot fill the server's memory;
  - "Não consegui conectar a <host> (classificacao): <reason>" for a network failure.
- No retries inside a poll: the poller's fixed rhythm is the retry.
- The HTTP client is Node 22's built-in `fetch`. No new dependency.

**Network reach.** The server fetches whatever URL an operator types. On the event LAN the operators are trusted, and the roles get PINs in M4. So this PR adds no address filter, but writes the trade-off next to the code and in decisions. Flag it for João under "Decisions taken".

**Fetching a sample** (needed by D): `POST /api/v1/data-sources/http-json/sample-request`. It takes one request config and answers either `{ ok: true, status, body }` (the parsed JSON) or `{ ok: false, error }` with the same pt-BR errors as a poll. It uses the same fetch code and the same caps, with a 10 s timeout. It is a read with no state change, so it is a REST route and not a command, and it writes no event-log row. It is documented in the OpenAPI like the other routes. Environment-variable headers are resolved on the server, so the page never sees a token.

### D. Control page: the flex source form and "Testar"

On "Fontes de dados", "+ Fonte" offers a third kind, "HTTP/JSON (flexível)". Its form is written by hand like the other two, with every string in the catalog. Its parts:

- **Requests.** One block per request: name, URL, then headers and query parameters as rows with "valor" or "variável de ambiente".
- **Mappings.** One block per produced shape ("+ Sessão", "+ Posições", "+ Pontuação"), each with its request, and for lists the "Caminho da lista". Then one row per mappable field from `listMappableFieldsOfShape`, required fields first and marked. Each row has its source (caminho, valor fixo, ordem na lista, momento da leitura), the path or value, and the transform (a dropdown from the registry, plus the value table when it is `mapValues`). A row left empty means the field is not mapped.
- **Testar.** A panel beside the mapping:
  - "Buscar da fonte" calls the sample route per request;
  - a text area lets the operator paste a sample instead, for when the endpoint is not up yet (the Baja app case);
  - "Testar" runs `applyFlexMapping` and `validateDataShape` **in the browser** and shows either the canonical result in the same tables the source detail uses (positions, standings, session card), or the problems list.

  Nothing is saved or sent as a command until "Salvar".
- **Import / export.** "Exportar configuração" shows the whole config as JSON to copy, and "Importar configuração" takes pasted JSON, validates it with the same schema and fills the form. This is how a tested configuration travels, and how BAJAOVRLAY-18 will ship the Baja app config as a preset file. No file upload is needed.
- The form validates with the shared config schema before sending, as the other two forms do (PR #16 deviation already recorded). The server's pt-BR refusal is still shown.
- The source detail, chips, recording and replay need no change: a flex source is a source. One check: a recording made from a flex source replays.

**An example preset**, also the test fixture and the e2e data: `packages/shared/src/flexMapping/examples/`, with two files.

- `timing-system-like.response.json`: a plausible JSON from an imaginary timing system whose shape is deliberately **not** ours. It has Portuguese keys (`classificacao`, `carro`, `equipe`, `escola`, `voltas`, `ultima_volta: "4:38.293"`), status codes (`"BOX"`, `"PISTA"`, `"ABAND"`), an ISO moment with a zone, no position numbers (the list is in order), and 20 cars from the fictional teams list.
- `timing-system-like.config.json`: the config that maps it into positions and session.

Both files say in their header or README that they are fictional.

### E. Leftovers from PR #16

1. **The source card opens on a click anywhere** except its buttons, switch and links. There is also an explicit "Ver" button, for keyboard users and for clarity. The label stops being the only way in. Tests: a click on the card's empty space selects the source; a click on "Atualizar agora" does not change the selection; "Ver" is reachable with Tab and selects with Enter.
2. **One snapshot row and one message per source.** Today `dataSnapshots` is one slice row and one WS message carrying every source, so a 60-car poll of source A rewrites and re-sends source B's snapshot too.
   - Persistence: each source's snapshot is its own row, so a poll of A writes only A's row and deleting a source deletes only its row. Take the plainer storage. A small dedicated table keyed by `sourceId` is likely clearer than names like `dataSnapshots/<id>` in the slices table, but choose and record it. At boot, an existing single `dataSnapshots` row is split into per-source rows once and removed (a test with a database written by today's main).
   - WS: hello still carries the full list. A change to one source's snapshot is sent as a new server message `dataSnapshot` (`sourceId`, `snapshot` or `null` when it was removed, `serverNowMs`), and the control store merges it by `sourceId`. A `slices` message never carries `dataSnapshots` any more. Screen connections still never receive any of it (extend the existing `slicesHiddenFromScreens` test). The WS README and `protocolReadmeExamples` gain the message.
   - The in-memory slice shape the reducers see can stay a list: this is about what is written and sent, not how reducers read it.
3. **fetch honours the abort signal.** This is covered by C; there is a test with a server that never answers.
4. **Gap precision.** Baja's timing records line-pass times with limited accuracy, so a millisecond gap is false precision (João, on BAJAOVRLAY-18).
   - The canonical shapes keep integer ms; nothing changes in the data.
   - Where a gap is **shown**, it is shown to the tenth of a second, truncated as timing screens do ("+12,3 s"). Today that is `formatGapToLeader` in the control page's `timingScreenText.ts` (now three decimals).
   - Lap times keep their milliseconds on the Fontes page, because it is a diagnostic screen. Flag it for João: should the Fontes page show lap times to the tenth as well? On-air formatting (`formatLapTime`, `formatGap`) is BAJAOVRLAY-20/21 and will follow the same rule.
   - Add a line to concept §8 saying gaps on screen are to the tenth or the second, never ms.

### F. Docs

- `docs/00-concept.md`:
  - §2: flex source, mapping, transform;
  - §4: the `httpJson` kind and its config, the `BAJAOVRLAY_SOURCE_` rule, the `dataSnapshot` message, per-source snapshot storage;
  - §4, the transforms line: the registry as built, and which transforms are mapping ones versus binding ones;
  - §8: the flex source, the mapping rules, the sample route, gap precision. Replace the "Sheet or CSV URL" bullet with a note that a sheet published as JSON is a flex source and CSV is not built.
- READMEs for `transforms/`, `flexMapping/` and `adapters/httpJson/`, and the module README's reading order.
- `.env.example`: the `BAJAOVRLAY_SOURCE_` prefix.
- Decisions lines for every choice this brief leaves to you.

## Tests (write first, in this order of commits)

- **Transforms.** One table per transform, each row with a comment saying why it exists: good values, the pt-BR decimal comma, refused ambiguous text, a zone-less ISO moment refused, `mapValues` refusing a missing key, `mapValues` giving a boolean (`"RUN"` → `true`) and matching a numeric source value by its text, parameters refused by their schema. Also a test that every registry entry has an id, a label and a description, and that ids are unique.
- **Paths.** A table of paths read (nested, an index, an index out of range, a key that is missing, `null`) and paths refused at config time (empty segment, unclosed bracket, negative index).
- **Mapping.**
  - The example preset maps the example response into positions and session, which then pass `validateDataShape`.
  - `fromListOrder` gives places 1..n.
  - `fromPollMoment` uses the moment it is given.
  - A missing optional field is left out, and a missing required one fails validation naming it.
  - One unreadable lap time fails the whole mapping, with the car, line and path in the message.
  - Problems are capped at 20 and summarised in the poll error.
  - `listMappableFieldsOfShape` is fixed, and every field exists in its schema.

  Name tests in race language ("a car the timing system marks BOX comes out inPit").
- **Config schema.** A request id that is not unique; a mapping naming an unknown request; an unknown transform; bad `mapValues` parameters; an environment variable without the prefix; a non-http URL; a shape mapped twice; brackets refused with a pt-BR line saying it is not built yet.
- **Adapter (a local test HTTP server on a random port, real fetch).**
  - A good poll gives the shapes.
  - Two requests are both fetched, and one failing fails the poll.
  - Each listed pt-BR error: status, bad JSON, the 5 MB cap, connection refused, a timeout through the signal with a server that never answers.
  - An environment-variable header is sent with its value and is absent from every log line (use the recording logger).
  - An unset variable fails the poll.
- **Through the store.** A flex source created, enabled and polled stores canonical shapes; recording it and replaying the recording gives the same shapes. Use the existing test support.
- **Sample route.** Answers the body; answers the pt-BR error; resolves an environment-variable header on the server; writes no event-log row.
- **Snapshot rows and messages.**
  - A poll of A writes only A's row.
  - Delete removes only that row.
  - The boot split of a legacy single row.
  - The `dataSnapshot` message on a change, and none on a no-op poll.
  - `slices` never carries `dataSnapshots`.
  - Screens get neither.
  - The control store merges by `sourceId`, and `null` removes.
- **Control.**
  - The flex form builds the right `createDataSource`.
  - Import fills the form, and a bad import shows why.
  - Export round-trips.
  - "Testar" with a pasted sample shows the positions table, and with a broken sample shows the problems.
  - "Buscar da fonte" shows the fetched body (fake server).
  - The card click, "Ver", and buttons not selecting.
  - The gap text "+12,3 s" (truncated, not rounded: 12 399 ms reads "+12,3 s").
- **E2E.** The test starts a small HTTP server serving the example response.
  1. Create a flex source by importing the example config, with its URL pointed at that server.
  2. "Testar" shows 20 cars. Save, turn it on, and the positions table shows them.
  3. The test server changes its answer, and the table follows.
  4. The test server answers 500: the chip reads "Atrasada" and the last data stays on screen.
  5. The server answers 200 again: the source recovers.

  Reset server state before each test, as the data-source browser tests already do.

## Commit order

1. The brief in `docs/briefs/BAJAOVRLAY-40.md` (documentation only).
2. Transforms: tests, then code.
3. Paths and mapping: tests, then code.
4. httpJson config schema and kind: tests, then code.
5. Adapter and sample route: tests, then code.
6. Per-source snapshot rows and the `dataSnapshot` message: tests, then code.
7. Control: card click and "Ver", gap precision, the flex form, "Testar", import and export: tests, then code.
8. E2E.
9. Docs and decisions.

Run the full root CI locally before opening the PR, and `git diff --check` for leftover conflict markers.

## Done when

Root CI green; lint with no warnings. On João's machine:

- "Fontes" → "+ Fonte" → "HTTP/JSON (flexível)" → "Importar configuração" with the example config. Pasting the example response into "Testar" shows the 20 fictional cars in the positions table.
- Serving the example response locally (the PR adds a small script in the repo, `pnpm serve:flex-example`, plain Node with no new dependency and nothing downloaded) and pointing the URL at it, then "Salvar" and turning it on, shows the cars on the Fontes page.
- Stopping that local server turns the source "Atrasada" without losing the table; starting it again recovers it.
- A click anywhere on a source card opens its detail, and so does "Ver".
- Gaps read to the tenth of a second.
- Nothing on air changes.

The PR description has the walk steps for João, "Decisions taken" (at least: GET only, one transform per rule, brackets left out, the `BAJAOVRLAY_SOURCE_` prefix, no address filter, the snapshot storage chosen, lap-time precision on the Fontes page), and anything left out and why. Report and stop; João merges after gate 2.
