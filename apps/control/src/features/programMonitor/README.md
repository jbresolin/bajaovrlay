# apps/control/src/features/programMonitor

The program monitor: what is on air, as OBS sees it. Start (and finish) reading at
`ProgramMonitor.tsx`.

- `ProgramMonitor.tsx` — an `<iframe src="/render/">` at 1920x1080 scaled into a 480x270
  box, labelled "Programa". No logic: the renderer inside has its own WebSocket.

`/render/` is served by the server from the built renderer (`pnpm build`); in
development Vite forwards it there. Until the renderer draws instances (BAJAOVRLAY-9)
the box stays empty. The preview monitor of docs/00-concept.md §3.4 arrives with
`previewItem` in M1.
