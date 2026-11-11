# apps/control/src/state

The only place server state lives on the control page, and the only way to change it:
sending a command. Start reading at `serverConnection.ts`, then `serverStateStore.ts`.

- `serverConnection.ts` — the WebSocket client: checks every message against the shared
  schema, fills the store, redials with growing waits (telling `onLineDropped`, which asks
  whether the session ended), and `sendCommand` (settles on the
  matching `commandResult`, gives up after 5 s); a hello naming another build than the
  page's reloads the tab, at most once per announced build (kept in sessionStorage), even
  a hello this page's schema refuses; only when that storage cannot keep the build is it
  once a minute, a skipped reload tried again when the minute is over
  (`startServerBuildWatch`, `packages/shared/src/build`).
- `serverStateStore.ts` — Zustand store: every slice, connection status, last error; a
  `dataSnapshot` message is merged into `dataSnapshots` by `sourceId` (null removes).
- `commandFailure.ts` — the codes and the error a failed command carries, with the part of
  the page that sent it when two parts send the same type.
- `whatThisPageSawOnAir.ts` — added by `sendCommand` to every take: what the page showed on
  air on the layer it takes on (BAJAOVRLAY-69). `consoleIdOfThisTab.ts` — the tab's console
  id, kept in sessionStorage from its first hello and named in every later connection.
- `browserWebSocket.ts` — the few lines that touch the browser's WebSocket API.
- `browserPageReloadForNewBuild.ts` — the page's build id (embedded by `vite build`) and
  the browser's clock, `location.reload` and `sessionStorage`, handed in by `main.tsx`.
- `operatorSessionContext.tsx` — the server's answer about the login (BAJAOVRLAY-29), read
  once by `main.tsx` as the page opens: `useOperatorSession`, `useWhyTheRoleCannotSend` (the
  tooltip of a control greyed out for Dados) and `useMayTheRoleSendAnyOf` (for the keys).
- `ControlPageStateProvider.tsx` — `useServerState`, `useSendCommand`, `useReadServerStateNow`,
  `useSubscribeToServerState` (for a value read with React's `useSyncExternalStore`, the editor's "Valor agora").
- `*.testSupport.*` — the fake server socket and believable slices (panels and macros too;
  data sources, their data from the shared samples and recordings in
  `dataSourcesLikeTheServerSends.testSupport.ts`).

Components never copy server state: they read it with a selector and wait for the next slice (`useReadServerStateNow` is only for a handler that has just awaited the server). The one browser setting ("Prévia automática") has its own store in `features/autoPreview/`, and what the item editor is open for lives in `features/items/ItemEditorTargetProvider.tsx`; neither is here.
