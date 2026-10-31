# apps/server/src/core/apiAccess

Who may use the command API (BAJAOVRLAY-28): Companion, a Stream Deck or a script, one token
per device. Start reading at `apiTokens.ts`: it reads BAJAOVRLAY_API_TOKENS at boot (through
`core/env/readServerEnvironment.ts`), reads the `Authorization: Bearer <token>` header, and
matches a token to its device's name in constant time. `requireApiToken.ts` is the middleware
in front of each route of the command API (api/v1/mountCommandApiRoutes.ts): 403 when the
variable is unset, 401 for a missing or wrong token, otherwise the device's name for the route.

A token is a secret: nothing here logs or echoes one, only the device's name.
