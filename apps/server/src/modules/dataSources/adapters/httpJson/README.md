# apps/server/src/modules/dataSources/adapters/httpJson

The `httpJson` adapter: a **flex source**, any JSON API read with the GET requests and the
mapping its config lists (`HttpJsonConfigSchema` in packages/shared, mapping in
`packages/shared/src/flexMapping/`). Each poll fetches every request at once and maps
their JSON with the shared `applyFlexMapping`. One request failing fails the poll.

Start at `httpJsonAdapter.ts`, then `fetchHttpJsonRequest.ts` (one GET with the poll's
signal, no redirects, the pt-BR errors; the sample route reuses it),
`httpJsonRequestAddress.ts` (query and headers, `BAJAOVRLAY_SOURCE_` variables read at
poll time) and `responseBodyWithinCap.ts` (the body streamed, dropped past 5 MB).
Secrets never enter state or logs: no error or log line quotes a header value or the query.
No address filter: on the event LAN the operators are trusted (see the fetch file's comment).
