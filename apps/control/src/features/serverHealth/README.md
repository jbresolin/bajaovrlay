# apps/control/src/features/serverHealth

"Verificar servidor", an entry of the header's menu (features/headerMenu; a header button
until BAJAOVRLAY-62): the operator's way to ask "is the server up, and which version is
running?" without opening DevTools. Start reading at `useServerHealthCheck.ts`.

- `useServerHealthCheck.ts` — runs the check and writes what the server answered
  ("Servidor no ar, versão 0.3.1." or that it could not be reached); the menu shows it.
- `fetchServerHealth.ts` — the `GET /health` call, checked against the shared
  `HealthResponseSchema`.

The answer is a one-off reply to a press, not server state, so it stays in the component
and never enters the store. The live connection status is a different thing and lives in
`features/connection/`. The tests are in `features/headerMenu/HeaderMenu.test.tsx`.
