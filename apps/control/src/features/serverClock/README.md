# apps/control/src/features/serverClock

The server clock as the operator sees it (BAJAOVRLAY-62). The server keeps real time from
NTP, and while something on air counts time it slews a big difference instead of
stepping it. Start at `ServerClockOffWarning.tsx`.

- `ServerClockOffWarning.tsx`: "Relógio do servidor X s fora da hora certa" in the header,
  from 2 s on; the number comes with each `time` message (state/serverConnection.ts).
- `ServerClockWithoutSyncChip.tsx`: "Relógio sem sincronização" beside it, amber, while
  neither NTP nor HTTPS has answered the server for a full poll interval (BAJAOVRLAY-76).
- `serverClockSourceSentence.ts`: what the clock follows (NTP, HTTPS or nothing) and its
  last answer, said at the top of the header's menu and by "Verificar servidor".
- `SetServerClockDialog.tsx` and `useServerClockSetting.ts`: "Acertar relógio agora", an
  entry of the header's menu: a confirm saying what on air jumps, then
  `postServerClockSetNow.ts` (`POST /api/v1/server-clock/set-now`, Produtor only) and
  what the server did.

What "Verificar servidor" says around that sentence is features/serverHealth's. The texts are in
`ptBR.serverClock`; the menu's tests are in features/headerMenu.
