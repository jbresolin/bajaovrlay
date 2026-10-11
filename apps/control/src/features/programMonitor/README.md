# apps/control/src/features/programMonitor

The program monitor: what is on air, as OBS sees it. Start (and finish) reading at
`ProgramMonitor.tsx`; `ProgramMonitor.test.tsx` says why the address matters.

- `ProgramMonitor.tsx` — an `<iframe src="/render/?monitor=1">` at 1920x1080 scaled into
  a 480x270 box, labelled "Programa". No logic: the renderer inside has its own WebSocket.

`monitor=1` makes the renderer page a monitor: it draws, but connects without the
renderer role and never reports. Only the program output (OBS, on plain `/render/`) turns
a layer badge to "No ar" or "Falhou"; a clock visible here proves nothing about OBS.

`/render/` is served by the server from the built renderer (`pnpm build`); in
development Vite forwards it there. The preview monitor of docs/00-concept.md §3.4
arrives with `previewItem` in M1.
