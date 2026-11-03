# packages/shared/src/obs

OBS control (BAJAOVRLAY-27): the server's one connection to OBS (obs-websocket v5) and the
scene switch. Start at `obsSlice.ts`: the `obs` slice holds the connection state, OBS's
scenes in its own order, the scene on Program and, in Studio Mode, on Preview, and the
latest scene switch with OBS's answer. It lives in the server's memory only.

`obsCommands.ts` holds `switchObsScene` (operators, a macro's `obsScene` step, the command
API) and the two commands only the server's OBS connection sends, signed `sistema:obs`:
`recordObsState` and `recordObsSceneSwitchAnswer`. Their rules live in
apps/server/src/modules/obs/, which also holds the connection itself.

`index.ts` lists every export of this folder; the package's `src/index.ts` re-exports it.
