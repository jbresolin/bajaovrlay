# apps/server/src/modules/dataSources/adapters/httpJson

The `httpJson` adapter: a **flex source**, any JSON API read with the GET requests and the
mapping its config lists (`HttpJsonConfigSchema` in packages/shared, mapping in
`packages/shared/src/flexMapping/`). Each poll fetches every request at once and maps
their JSON with the shared `applyFlexMapping`. One request failing fails the poll. A request
with `refreshEveryMs` is fetched once in that time and its last good response reused between
(`rememberedResponses.ts`); a config change, turning the source on or a restart fetches anew.

Start at `httpJsonAdapter.ts`, then `fetchHttpJsonRequest.ts` (one GET with the poll's
signal, no redirects, the pt-BR errors; `fetchSampleOfHttpJsonRequest.ts` reuses it for
the sample route with a 10 s timeout),
`httpJsonRequestAddress.ts` (the host check first, then query and headers, `BAJAOVRLAY_SOURCE_`
variables read at poll time), `sourceHostAllowlist.ts` (BAJAOVRLAY_SOURCE_ALLOWED_HOSTS:
parsed at boot, matched per request and on save) and `responseBodyWithinCap.ts` (the body
streamed, dropped past 5 MB). Secrets never enter state or logs: no error or log line quotes
a header value or the query. With the host list set only its hosts are fetched; unset, any
host is, but no variable's value is sent.
