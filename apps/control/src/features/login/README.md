# apps/control/src/features/login

The operator login (BAJAOVRLAY-29, docs/login.md). Start reading at `LoginPage.tsx`.

- `LoginPage.tsx` — "#/entrar": the role, its PIN and the station; `main.tsx` draws it alone,
  with no connection, while the server wants a login and the page has no session.
- `sessionRequests.ts` — GET, POST and DELETE /api/v1/session, and the two reloads (to the
  login, to the console).
- `stationInBrowserStorage.ts` — the station typed last time, the one thing kept in the browser.
- `OperatorBadge.tsx` — the header's "Produtor · Mesa 1" and "Sair", or "Sem login".
- `sessionEndedWatch.ts` — after the line drops, back to "#/entrar" if the session ended.

What a role may press is not here: `ActionButton` (features/connection) greys out a control
whose `commandType` the role may not send, and `useKeyboardShortcut` switches its keys off,
both from `state/operatorSessionContext.tsx`. `dataRoleControls.test.tsx` walks them for Dados.
