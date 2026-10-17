# Agent brief — BAJAOVRLAY-37: everything on air comes from an item

**Branch:** `BAJAOVRLAY-37-on-air-from-items` off an up-to-date `main` (PR #14 is merged). One PR, left open for João's review. Do not merge.

**Read first:** `CLAUDE.md`; `docs/00-concept.md` §2 (vocabulary), §4, §7 rules 1 and 3; `docs/decisions.md` from PR #14 on; `apps/control/src/features/playout/` (Edição rápida), `features/items/`, `features/layers/`; `apps/server/src/core/store/reducers/` (takeGraphic, previewGraphic, updateInstanceData, takeItem, previewItem); `core/store/authorize*`.

## Why

João's walk: a graphic put on air from Edição rápida has no item behind it, so Camadas shows something nobody prepared and nobody can find again. João chose one model: **every graphic on air or in preview comes from an item.** Items are what can go on air; Edição rápida only changes what is already up. When an on-air change should last, the operator saves it back to the item.

## Deliverable

### A. Edição rápida edits only (control)

* Remove new-entry mode completely: the graphic select, the layer select, "Colocar no ar", "Prévia" (as a new-entry action) and "Salvar como item" leave the panel. With nothing loaded, the panel shows one hint line ("Use Editar numa camada para alterar o que está no ar") and one button **"Novo gráfico…"** that opens the item editor with "Onde" set to the active shortcuts panel.
* Loaded program instance: as today (header, Atualizar → `updateInstanceData` to that id).
* Loaded preview instance: **"Atualizar prévia"** sends `updateInstanceData` to the preview instance id (allow the reducer to update preview instances; same validation). This replaces the re-preview through `previewGraphic`, so the preview keeps its `itemId` and what Tomar promotes is exactly what was seen.
* Losing the target: as today, but the panel returns to the empty state above. The typed values are dropped, because there is no new-entry form to keep them in. Decisions line.

### B. The server enforces it (shared + server)

* `takeGraphic` and `previewGraphic` leave the public command set. Their logic stays as internal functions called by `takeItem`, `previewItem`, `takePreview`, `takeAllPreviews` and `previewMacro` (and the macro runner). Delete the schemas, the WS acceptance and the control call sites; keep or rename the internal functions with names that say they are internal steps. If removing them from the shared union is far more churn than you expect, stop and say so in the PR instead of half-doing it. The fallback is that the authorize hook refuses both for every actor, with tests.
* Every new instance carries an `itemId`. Instances already persisted without one (made before this PR) keep working after hydrate. Camadas shows them as "sem item", they can be edited and cleared, and they offer **"Salvar como item"**, the only place that action remains.

### C. Item editor: save and use (control)

* The item editor gets **"Salvar e disparar"** and **"Salvar e prévia"** next to "Salvar", for new and existing items. Send the item command first, then `takeItem` / `previewItem` for its id after the save is accepted. If the accepted reply does not carry the new item's id today, add it to the reply. If the save is accepted but the take is refused, the item stays saved and the refusal is shown. Never roll back the save.
* `ItemEditorPanel.tsx` is at 395 lines. Move a responsibility out (for example the footer buttons and their send logic) **before** adding these, in its own commit.

### D. "Alterado no ar" and saving back (shared + server + control)

* When `updateInstanceData` changes an instance that has an `itemId`, the server records which top-level fields now differ from what the item produced: `instance.fieldsChangedOnAir: string[]`, the union of the changed keys. Fields the item marks `takeTime` and fields an update rule rewrote (carryClockForward) count only if the operator sent them. A new take of the item starts with an empty list.
* Camadas shows an **"alterado no ar"** chip on such a row, with the changed field titles in the tooltip, and a **"Salvar no item"** action.
* New command `saveOnAirChangesIntoItem(instanceId)`: writes the changed fields' current `resolvedData` values into the item as `literal` field values, then empties the list. It is refused if the item no longer exists (Camadas shows "item excluído" and hides the action) or if the list is empty. Operators only.
* **Clock fields need a choice** (carried over from PR #14). When the changed fields include one whose `v_baja.role` is `wallClock`, "Salvar no item" first asks:

  + **"Continuar este relógio"** saves the moment as a fixed number, so each take shows the same race time. This is right for clearing a clock and bringing it back.
  + **"Começar na entrada no ar"** saves that field as `takeTime`, which is right for a reusable item.

  The command carries the choice (`wallClockFields: 'keepMoment' | 'atTake'`). The same dialog appears in "Salvar como item" for legacy instances.

### E. Docs

* `docs/00-concept.md`: §2 says "Everything on air or in preview comes from an item"; §7 rule 3 is rewritten for the edit-only Edição rápida (no "Since…" patch, rewrite it); §4 lists the removed and new commands and the new instance field.
* Decisions lines for: public take/preview by graphic removed, preview instances updatable, values dropped on target loss, fieldsChangedOnAir semantics, the clock choice.

## Tests (write first)

* **Shared:**
  + `takeGraphic` / `previewGraphic` are no longer accepted, or are refused by authorize for every actor (the fallback);
  + schemas for `saveOnAirChangesIntoItem` and `fieldsChangedOnAir`.
* **Reducers, table-driven:**
  + an update on an item's instance records the changed keys;
  + a second update unions them;
  + updating a field back to the item's value still counts (keep it simple and say so);
  + carryClockForward rewrites don't count unless sent;
  + a new take starts empty;
  + updating a preview instance works and keeps `itemId`;
  + Tomar after "Atualizar prévia" promotes the edited data;
  + save writes literals and clears the list;
  + save refused for a missing item or an empty list;
  + `keepMoment` vs `atTake` for the race clock's `referenceWallClockMs`;
  + a legacy instance without `itemId` hydrates, updates and clears.
* **Control:**
  + the empty Edição rápida shows the hint and "Novo gráfico…" (which opens the editor with Onde = active panel), and nothing else;
  + "Atualizar prévia" sends `updateInstanceData` to the preview id;
  + "Salvar e disparar" / "Salvar e prévia" send the save and then the take for the new id;
  + a refused take leaves the item saved and shows the message;
  + the chip and tooltip;
  + "Salvar no item" with and without the clock dialog;
  + "item excluído".
* **Guard test:** no control code sends `takeGraphic` or `previewGraphic`.
* **E2E:**
  + "Novo gráfico…" → fill → "Salvar e disparar" → on air, and Camadas names the new item;
  + Editar → change Título → Atualizar → chip shows → "Salvar no item" → chip gone → clear and re-take the item → the new Título is on air.

## Done when

Root CI green. In OBS (after refreshing the browser sources): nothing can reach the screen except through an item; every Camadas row names its item; an on-air change can be kept or left as a one-off, and the chip shows which. List the walk steps for João in the PR. Decisions appended; concept doc updated.
