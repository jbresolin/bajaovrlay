# apps/control/src/features/serverHealth

The "Verificar servidor" button in the header: the operator's way to ask "is the server
up, and which version is running?" without opening DevTools. Start reading at
`ServerHealthCheck.tsx`.

- `ServerHealthCheck.tsx` — the button and the line under it that says what the server
  answered ("Servidor no ar, versão 0.3.1." or that it could not be reached).
- `fetchServerHealth.ts` — the `GET /health` call, checked against the shared
  `HealthResponseSchema`.

The answer is a one-off reply to a button press, not server state, so it stays in the
component and never enters the store. The live connection status is a different thing
and lives in `features/connection/`. The tests are in `src/App.test.tsx`.
