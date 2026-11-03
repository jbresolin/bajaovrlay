# apps/server/src/api/v1

Thin REST routes under `/api/v1`: parse → authorise → call a module or the store.
Start reading at `createApiV1Routes.ts`, which mounts every route and serves the
OpenAPI document generated from their Zod schemas at `/api/v1/openapi.json`.

- `stateRoute.ts` — `GET /api/v1/state`, every slice at once; with `?role=renderer` or
  `?role=monitor` (a renderer page whose hello is late) `dataSnapshots` and `eventLog` are empty.
- `GET /api/v1/data-sources/{sourceId}/snapshot` — declared by the data-source module
  (`modules/dataSources/api.ts`), the latest good data of one source.
- `POST /api/v1/data-sources/http-json/sample-request` — also declared there: "Buscar da
  fonte", one flex request fetched once (10 s timeout), no state change, no event-log row.
- `GET /api/v1/entities/simulator-teams` — declared by the entity module
  (`modules/entities/api.ts`): the simulator's hundred fictional teams as team records, for
  "Importar equipes do simulador"; no state change.
- `POST /api/v1/media` — declared by the media module (`modules/media/api.ts`): one image
  as multipart form data, checked by its bytes, recorded through the command path as
  `sistema:midia`. The image itself is served outside /api/v1, at `/media/<mediaId>`.

- The command API (BAJAOVRLAY-28), mounted by `mountCommandApiRoutes.ts`, each route behind
  `core/apiAccess/requireApiAccess.ts` (a Bearer token of BAJAOVRLAY_API_TOKENS, or no
  token at all with BAJAOVRLAY_API_OPEN=true, signed `api:rede`):
  `POST /api/v1/commands` (`commandsRoute.ts`, the WebSocket's command envelope in, its
  commandResult out; `commandBodyChecks.ts` refuses a body not sent as JSON, 415, or over
  256 KB, 413), ten button shortcuts (`commandShortcutRoutes.ts`; the four that read
  the state to build their command are in `shortcutCommands.ts`) and `GET /api/v1/layers/status`
  (`layersStatusRoute.ts`). Every command runs through `commandApiAnswers.ts`, signed
  `api:<token name>`; `commandRefusalHttpStatus.ts` gives each refusal code its HTTP status.
- The button state routes (BAJAOVRLAY-56), mounted by `mountButtonStateRoutes.ts` behind the
  same access: `GET /api/v1/state/layer/{layerId}`, `.../state/shortcut/{panelId}/{buttonNumber}`
  (counted as fire-shortcut counts, `quickFireButtonByPlace.ts`) and `.../state/macro/{macroId}`,
  each a flat answer for the Ulanzi D200's one-word JSON path (`buttonStates.ts`); an unknown id
  answers 404. They read memory only and never write the event log. Buttons poll them every
  second (fifteen buttons: some 54,000 requests an hour), so their request lines are logged at
  debug; a refused poll at warn once a minute per path and status, and a failed one (500) at
  warn every time (`core/http/pollsByButtonsLogging.ts`).

Each route is declared with `createRoute` from @hono/zod-openapi so it appears in the
OpenAPI document; a route added with plain `app.get` would be missing from it.
