# apps/server/src/core/operatorLogin

The operator login on the studio LAN (BAJAOVRLAY-29): two roles, Produtor and Dados, each
with a PIN (docs/login.md). Start reading at `operatorLogin.ts`, which `startServer` builds.

- `operatorPins.ts` — BAJAOVRLAY_PIN_PRODUCER and BAJAOVRLAY_PIN_DATA read as one setting:
  none is the login off, both (6 to 8 digits, different) on, anything else stops the boot.
- `operatorLogin.ts` — checks a PIN (constant time), opens a session, finds the session of a
  Cookie header, "Sair"; the key that signs cookies lives in the server_secrets table.
- `operatorSessions.ts` — the open sessions, in memory and in operator_sessions (18 hours), kept
  by the SHA-256 of their id: the id itself is only in the operator's cookie.
- `sessionCookie.ts` — the cookie `bajaovrlay_sessao`: signing, reading, Set-Cookie headers.
- `loginLockout.ts` — five wrong PINs from one address, then 60 s of waiting (in memory).
- `routeAccess.ts` — the access table of every /api/v1 route and the middleware it gives.
- `operatorLoginAtBoot.ts` — the boot log's line, a warning while the login is off.

The routes are api/v1/sessionRoutes.ts; the WebSocket's rule is in core/ws. Which command each
role may send is the shared list (packages/shared/src/commands/commandSenders.ts). Every test
takes its PINs from `fakeOperatorPins.testSupport.ts`.
