# apps/control/src/features/serverClock

The server clock as the operator sees it (BAJAOVRLAY-62). The server keeps real time from
NTP, and while something on air counts time it slews a big difference instead of
stepping it. Start at `ServerClockOffWarning.tsx`.

- `ServerClockOffWarning.tsx`: "Relógio do servidor X s fora da hora certa" in the header,
  from 2 s on; the number comes with each `time` message (state/serverConnection.ts).
- `SetServerClockDialog.tsx` and `useServerClockSetting.ts`: "Acertar relógio agora", an
  entry of the header's menu: a confirm saying what on air jumps, then
  `postServerClockSetNow.ts` (`POST /api/v1/server-clock/set-now`, Produtor only) and
  what the server did.

What "Verificar servidor" says of NTP is features/serverHealth's. The texts are in
`ptBR.serverClock`; the menu's tests are in features/headerMenu.
