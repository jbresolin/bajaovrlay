# apps/control/src/features/outputMonitors

The two monitors of the centre column and what is in preview. Start reading at
`PreviewAndProgramMonitors.tsx` ("Prévia" left, "Programa" right, always side by side).

- `OutputMonitor.tsx` — one `<iframe>` on the renderer page at 1920x1080, scaled into a 16:9 box:
  `/render/?monitor=1` ("Programa") or `/render/?target=preview&monitor=1` ("Prévia").
- `monitorWidthForColumnWidth.ts` — the one width both boxes get: 480 px at most, less when the
  column (measured by `useWidthOfElement.ts`) has under 976 px, so they shrink together.
- `PreviewedLayersList.tsx` — under "Prévia": one line per layer that holds a preview, with "Tomar"
  (`takePreview`) and "Descartar" (`stopPreview`); `previewedLayers.ts` builds the lines.
- `useBackspaceToStopPreview.ts` — Backspace discards the most recent preview and nothing else.

`monitor=1` makes the renderer page draw without the renderer role and never report: only OBS (plain
`/render/`) turns a layer badge to "No ar" or "Falhou". `/render/` is the built renderer (`pnpm build`).
