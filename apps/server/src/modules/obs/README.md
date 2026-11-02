# apps/server/src/modules/obs

OBS control (BAJAOVRLAY-27): the server's one connection to OBS 32 through obs-websocket v5,
and the scene switch. The slice and commands are declared in `packages/shared/src/obs/`;
the operator's guide is `docs/obs.md`.

Start at `obsConnection.ts`: it connects with BAJAOVRLAY_OBS_URL and BAJAOVRLAY_OBS_PASSWORD,
tries again every 5 s, fills the `obs` slice from OBS's events (recordObsState, signed
`sistema:obs`), and carries out each switch the store records (recordObsSceneSwitchAnswer).
`obsAnswers.ts` reads OBS's answers and turns every failure into its pt-BR reason. The
reducers are in `reducers/` (`switchObsScene.ts` holds the refusals' order), and `index.ts`
lists what core may use. The macro step `obsScene` is run by core's `macroRunner.ts`.

Tests run against `fakeObsWebSocketServer.testSupport.ts`, a real WebSocket server speaking
the protocol; read `obsConnection.test.ts` first, then `switchObsScene.test.ts`.
