# apps/control/src/features/layers

The layer status panel: what is on every layer, at all times (operator rule 4 in
docs/00-concept.md §7). Start reading at `LayerStatusPanel.tsx`.

- `LayerStatusPanel.tsx` — one row per layer in z-order, read from the `layers`,
  `graphics` and `instances` slices; "Limpar" sends `clearLayer`.
- `LayerStatusRow.tsx` — one row: layer (+ chip "em prévia"), graphic, "há 2 min", badge, button.
- `InstanceStatusBadge.tsx` — green "No ar", grey "Carregando", red "Falhou" + why (tooltip).
- `useCurrentTime.ts` — redraws the rows every 10 s so the relative times keep up.
- `ItemLabelOnAir.tsx` — the label of the rundown item that put the graphic on air.

Rows describe the program output; a preview only adds the chip (never a badge: nothing reports it).
A take starts as "Carregando"; a renderer's report makes it "No ar" or (even after "No ar") "Falhou",
which stays until cleared. With no OBS the badge stays "Carregando": the monitors never report.
