# apps/server/src/modules/obs

OBS control (BAJAOVRLAY-27): the server's one connection to OBS 32 through obs-websocket v5,
and the scene switch. The slice and commands are in `packages/shared/src/obs/`; the
operator's guide is `docs/obs.md`.

Start at `obsConnection.ts`: it connects with BAJAOVRLAY_OBS_URL and BAJAOVRLAY_OBS_PASSWORD,
tries again every 5 s, counts as up once it has read the scenes, fills the `obs` slice from
OBS's events (recordObsState, `sistema:obs`), and carries out each switch the store records.
`obsRequestsWithATimeLimit.ts` gives OBS 3 s per request; `obsAnswers.ts` turns every failure
into its pt-BR reason. Reducers are in `reducers/`; `index.ts` lists what core may use.

Tests run against `fakeObsWebSocketServer.testSupport.ts`, a real WebSocket server speaking
the protocol (its controls: `fakeObsControls.testSupport.ts`), built by `openFakeObs.testSupport.ts`,
which is free of Vitest so the chaos suite (apps/control/e2e/chaos) opens it too. Read `obsConnection.test.ts`
first, then `obsThatOnlyHalfAnswers.test.ts` and `switchObsScene.test.ts`.
