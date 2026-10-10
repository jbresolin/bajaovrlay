# apps/control/src/features/connection

What the operator sees of the connection to the server. Start reading at
`ConnectionBadge.tsx`.

- `ConnectionBadge.tsx` — the badge in the header: "Conectando…", "Conectado" or
  "Reconectando…".
- `ActionButton.tsx` — the button every command uses. While the page is not connected
  it is disabled and its tooltip says why. Use it for anything that sends a command.

The connection itself (dialling, redialling, sending) is in `src/state/`; this folder
only shows its status.
