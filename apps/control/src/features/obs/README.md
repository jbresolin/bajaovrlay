# apps/control/src/features/obs

OBS on the control page (BAJAOVRLAY-27). The page never talks to OBS: the server does, and
sends what it hears in the `obs` slice.

- `ObsTally.tsx` — the small read-only block in the header: "OBS", the connection dot, the
  scene on OBS's Program and, in Studio Mode, on its Preview; the hover shows the address
  and the last error. Start here, then `ObsTally.test.tsx` (one row per connection state).

The macro editor's "Trocar cena do OBS" step lives with the editor, in `../macros/`.
