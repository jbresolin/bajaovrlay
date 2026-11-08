# apps/server/src/core/apiAccess

Who may use the command API (BAJAOVRLAY-28): Companion, a Stream Deck or a script, one token
per device. Start reading at `apiTokens.ts`: it reads BAJAOVRLAY_API_TOKENS at boot (through
`core/env/readServerEnvironment.ts`), reads the `Authorization: Bearer <token>` header, and
matches a token to its device's name in constant time. `requireApiAccess.ts` is the middleware
in front of each route of the command API (api/v1/mountCommandApiRoutes.ts): 403 when neither
BAJAOVRLAY_API_TOKENS nor BAJAOVRLAY_API_OPEN=true turns it on, 401 for a missing or wrong
token, otherwise the device's name for the route, or "rede" for a call with no header when the
API is open to the studio network. `allowTheControlPageOrRequireApiAccess.ts` lets the control
page's own fetch through first (GET /api/v1/event-log, BAJAOVRLAY-30; GET /api/v1/backup and
its summary, BAJAOVRLAY-33), as /state does, and puts
every other caller through the same check. `commandApiAccessAtBoot.ts` writes the boot log's line
about it, a warning when open.

A token is a secret: nothing here logs or echoes one, only the device's name. Every test takes
its tokens from `fakeApiTokens.testSupport.ts`: fake-looking and low in entropy
(`companion-test-token-0001`), so the secret scanner on PRs never takes one for real.
