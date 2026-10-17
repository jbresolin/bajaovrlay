# apps/control/src/features/layers

The layer status panel: what is on every layer, at all times (operator rule 4 in
docs/00-concept.md §7). Start reading at `LayerStatusPanel.tsx`.

- `LayerStatusPanel.tsx` — one row per layer in z-order, from the `layers`, `graphics`, `instances`
  and `previewClearedLayerIds` slices; "Limpar" sends `clearLayer`, "Prévia: limpar"
  `previewClearLayer`, and "Editar" / "Editar prévia" load that instance into "Edição rápida".
- `LayerStatusRow.tsx` — one row: layer (+ chips "em prévia", "vai limpar"), graphic, "há 2 min", badge, buttons.
- `InstanceStatusBadge.tsx` — green "No ar", grey "Carregando", red "Falhou" + why (tooltip).
- `useCurrentTime.ts` — redraws the rows every 10 s so the relative times keep up.
- `ItemLabelOnAir.tsx` — the colour chip and label of the item (rundown or panel) that put it on air.

Rows describe the program output; a preview only adds the chip. A take starts "Carregando"; a renderer's
report makes it "No ar" or "Falhou" (kept until cleared). With no OBS it stays "Carregando".
