# packages/shared/src/operatorLogin

The operator login on the studio LAN (BAJAOVRLAY-29): two roles, each with a PIN.
Start reading at `operatorRole.ts`.

- `operatorRole.ts` — `produtor` (runs the show) and `dados` (prepares it, never changes
  program or preview). Which commands each role may send is the second column of
  `../commands/commandSenders.ts`.
- `operatorSession.ts` — the login body of POST /api/v1/session (role, PIN, station), the
  session as the page reads it, and GET /api/v1/session's answer, which also says whether
  the server asks for a login at all.
- `whyTheRoleCannotSend.ts` — "O papel Dados não pode …": the one sentence for a command
  Dados may not send, the server's refusal and the page's tooltip alike.

The PINs, the cookie and the lockout live in the server (`apps/server/src/core/operatorLogin/`).
