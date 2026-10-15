# apps/control/src/state

The only place server state lives on the control page, and the only way to change it:
sending a command. Start reading at `serverConnection.ts`, then `serverStateStore.ts`.

- `serverConnection.ts` — the WebSocket client: checks every message against the shared
  schema, fills the store, redials with growing waits, and `sendCommand` (settles on the
  matching `commandResult`, gives up after 5 s).
- `serverStateStore.ts` — Zustand store: every slice, connection status, last error.
- `commandFailure.ts` — the codes and the error a failed command carries.
- `browserWebSocket.ts` — the few lines that touch the browser's WebSocket API.
- `ControlPageStateProvider.tsx` — `useServerState`, `useSendCommand`, `useReadServerStateNow`.
- `*.testSupport.*` — the fake server socket and believable slices (panels and macros too).

Components never copy server state: they read it with a selector and wait for the next slice (`useReadServerStateNow` is only for a handler that has just awaited the server). The one browser setting ("Prévia automática") has its own store in `features/autoPreview/`, and what the item editor is open for lives in `features/items/ItemEditorTargetProvider.tsx`; neither is here.
