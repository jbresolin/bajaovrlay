# apps/control/src/features/layers

The layer status panel: what is on every layer, at all times (operator rule 4 in
docs/00-concept.md §7). Start reading at `LayerStatusPanel.tsx`.

- `LayerStatusPanel.tsx` — one row per layer in z-order, from the `layers`, `graphics`, `instances`
  and `previewClearedLayerIds` slices; "Limpar" sends `clearLayer`, "Prévia: limpar"
  `previewClearLayer`, "Próximo" `nextOnLayer` for a graphic shown in steps (the podium,
  BAJAOVRLAY-47), and "Editar" / "Editar prévia" load that instance into "Edição rápida".
- `LayerGroupOfOutput.tsx` — with more than one output (BAJAOVRLAY-49) the rows come grouped by
  output: "Programa" first, always open; each other output a group the operator can fold away.
  With program alone the panel is the flat list it always was.
- `LayerStatusRow.tsx` — one row: layer (+ chips "em prévia", "vai limpar"), graphic, "há 2 min", badge, buttons.
- `layersInCamadasOrder.ts` — the order the rows are drawn in, also read by "Desfazer última"'s tooltip;
  a row's "Desfazer" (BAJAOVRLAY-30) is drawn by features/undo.
- `InstanceStatusBadge.tsx` — green "No ar", grey "Carregando", red "Falhou" + why (tooltip).
- `useCurrentTime.ts` — redraws the rows every 10 s so the relative times keep up.
- `ItemLabelOnAir.tsx` — the colour chip and label of the item that put it on air, or "sem item" /
  "item excluído".
- `ChangedOnAirChip.tsx` — "alterado no ar", its tooltip naming the fields (`fieldsOfInstanceOnAir.ts`).
- `ItemAheadOfTheAirMarker.tsx` — the reverse, "item mudou" (BAJAOVRLAY-38): the item was saved after the take; "Disparar"
  takes it again, "Atualizar no ar" (`updateThatCatchesUpWithTheItem.ts`) sends the fields behind. It reads its own
  instance and item, so a source poll does not redraw it.
- `useSavesFromCamadas.ts` — "Salvar no item" (`saveOnAirChangesIntoItem`) and, for an instance with
  no item, "Salvar como item" (`itemSavedFromInstanceWithoutItem.ts`); `WallClockChoiceDialog.tsx`
  asks first when a clock's moment would be saved.

Rows describe the program output; a preview only adds the chip. A take starts "Carregando"; a renderer's
report makes it "No ar" or "Falhou" (kept until cleared). With no OBS it stays "Carregando".
