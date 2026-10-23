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

Each route is declared with `createRoute` from @hono/zod-openapi so it appears in the
OpenAPI document; a route added with plain `app.get` would be missing from it.
