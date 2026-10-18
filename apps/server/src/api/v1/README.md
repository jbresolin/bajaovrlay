# apps/server/src/api/v1

Thin REST routes under `/api/v1`: parse → authorise → call a module or the store.
Start reading at `createApiV1Routes.ts`, which mounts every route and serves the
OpenAPI document generated from their Zod schemas at `/api/v1/openapi.json`.

- `stateRoute.ts` — `GET /api/v1/state`, every slice at once; with `?role=renderer` or
  `?role=monitor` (a renderer page whose hello is late) `dataSnapshots` and `eventLog` are empty.
- `GET /api/v1/data-sources/{sourceId}/snapshot` — declared by the data-source module
  (`modules/dataSources/api.ts`), the latest good data of one source.

Each route is declared with `createRoute` from @hono/zod-openapi so it appears in the
OpenAPI document; a route added with plain `app.get` would be missing from it.
