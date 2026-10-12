# apps/control/src/features/outputMonitors

The two monitors of the centre column and what is in preview. Start reading at
`PreviewAndProgramMonitors.tsx` ("Prévia" left, "Programa" right; they wrap below 976 px).

- `OutputMonitor.tsx` — one `<iframe>` on the renderer page at 1920x1080, scaled into a 480x270
  box: `/render/?monitor=1` ("Programa") or `/render/?target=preview&monitor=1` ("Prévia").
- `PreviewedLayersList.tsx` — under "Prévia": one line per layer that holds a preview, with
  "Tomar" (`takePreview`) and "Descartar" (`stopPreview`); `previewedLayers.ts` builds the lines
  (layer panel's order; item label, else graphic name).

`monitor=1` makes the renderer page draw without the renderer role and never report. Only the
program output (OBS, on plain `/render/`) turns a layer badge to "No ar" or "Falhou"; a preview
never gets a badge. `/render/` is served by the server from the built renderer (`pnpm build`);
in development Vite forwards it there.
