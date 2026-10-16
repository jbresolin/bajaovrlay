# Agent brief — BAJAOVRLAY-36: M1 walk fixes — result preview, take all, macro preview, editor clarity

**Branch:** `BAJAOVRLAY-36-m1-walk-fixes` off `main` (PR #13 is merged). One PR, left open for João's review. Do not merge.

**Read first:** `CLAUDE.md`; `docs/00-concept.md` §2 (vocabulary), §4, §6, §7 rule 1; `docs/decisions.md` from PR #12 on (preview, `target`, monitor, macros); `apps/renderer/src/` (reconciler, target handling); `apps/server/src/core/store/` (preview reducers, macroRunner); `apps/control/src/features/` (preview, quickEdit, items, rundown, quickFire, layers, macros).

## Why

João's walk showed three things. Prévia does not show what the screen will look like after the take, because it hides what stays on air. A prepared *set* of graphics can't be looked at or taken in one go. And the operator can't tell what "Editar" changes versus what "Edição rápida" changes. João's rule for Prévia, verbatim in meaning: **Prévia shows exactly what the screen will look like when we take.**

## Deliverable

### A. Prévia shows the result (renderer + shared + server)

* The preview page (`/render/?target=preview`) composes, per layer:

  1. the preview instance on that layer, if there is one; otherwise
  2. nothing, if the layer is marked "will be cleared" (see below); otherwise
  3. the program instance on that layer.

  A previewed layer never shows its current program instance. This is one selection function in the renderer (`selectInstancesForPreviewComposition` or similar), table-tested, used by the existing reconciler. There is no second code path. The page still never reports status, and it still uses `skipAnimation`.
* **"Will be cleared" marker.** New slice `previewClearedLayerIds: string[]`. It is not persisted, and hydrate starts it empty, the same as preview instances.

  + New command `previewClearLayer(layerId)`. It removes any preview instance on that layer and adds the marker.
  + `previewItem` and `previewGraphic` on a layer remove that layer's marker.
  + `stopPreview(layerId | all)` removes markers too.
  + `takePreview(layerId)` on a marked layer becomes a `clearLayer` on program and removes the marker.
  + Camadas rows with something on program get a small "Prévia: limpar" action.
* **Program page unchanged.** It still ignores everything preview.

### B. Tomar tudo (shared + server + control)

* New command `takeAllPreviews`. In one reducer call, it promotes every preview instance (same rules as `takePreview`, including the re-resolved `takeTime` fields and the cursor rule per item) and applies every clear marker. That makes one state change, one event-log row and one broadcast, so OBS can never show a half-taken set. With nothing previewed or marked, it is refused with a pt-BR message.
* Under Prévia:
  + **"Tomar tudo"** and **"Descartar tudo"** buttons, shown when more than one layer has a preview or marker;
  + the per-layer rows stay, and marked layers read "vai limpar".
* No new key for Tomar tudo in this PR. Space keeps its -15/-16 meaning. That is a decision; record it.

### C. Macro Prévia (shared + server + control)

* New command `previewMacro(macroId)`. It first discards all current previews and markers, then simulates the macro's steps **in order** onto preview state, without touching program:
  + `takeItem` → preview that item on its layer (replacing any preview or marker there);
  + `clearLayer` → marker on that layer (removing any preview there);
  + `clearAll` → remove all previews, and mark every layer that has a program instance;
  + `wait` → ignored.
* The result is the macro's **end state**. Tomar tudo then applies it in one instant, without the waits. "Executar" (runMacro) still runs the macro with its timing, and starting a run discards previews and markers first, so the two never mix. Write both behaviours next to the reducer and in decisions; the macro button tooltip says "Prévia mostra o resultado final; Tomar tudo aplica sem as esperas".
* Item resolution reuses the `previewItem` path. Do not duplicate it. A step whose item no longer exists refuses the whole preview with a pt-BR message naming the step, and nothing is changed.
* Control: macro buttons get Prévia in their ⋯ menu, next to Executar and Editar.

### D. Edição rápida targets one instance (control)

* Every Camadas row with an instance gets **Editar**, which loads *that* instance into Edição rápida. The header names the target, for example "Editando: Logo · ABC · No ar".
  + **Atualizar** sends `updateInstanceData` to that instance id only.
  + For a preview instance, the header says "Em prévia". Atualizar is replaced by Prévia, which re-previews on the same layer.
* **No target (new-take mode):** a graphic select plus a **layer select** (new; defaults to the graphic's `defaultLayerId`), with "Colocar no ar" and "Prévia". The header says "Nova entrada — não altera nenhum item".
* When the target instance leaves the air or is replaced, the panel says so in one line, drops back to new-take mode, and keeps the form values. It never silently retargets.
* **"Salvar como item"** creates an item from the current graphic, layer and form values. It keeps each field's kind as shown (literal / takeTime) and asks for a label and the "Onde" (rundown or panel), through the existing item editor dialog prefilled.
* Clicking rundown rows or shortcut buttons does not load anything into Edição rápida.

### E. Items (shared + server + control)

* `updateItemFields` also accepts `layerId`. Keep the command name to avoid churn, and note it in its doc comment. Changing the layer of an item that is on air does not move the on-air instance; the next take uses the new layer. Decisions line.
* The graphic of an existing item stays fixed. In "Editar item", the graphic select is read-only with the note "Para outro gráfico, crie um novo item".
* Rundown rows: "Editar" is renamed **"Editar item"**, and the ⋯ menu gains **"Mover para atalhos"** (panel picker when there is more than one panel), using the existing `moveItemToHome`.
* The item editor header says "Item salvo — vale para os próximos disparos".

### F. Race-clock manifest wording

* The property currently titled "Nome da sessão" is retitled **"Título"**, with the description "Texto acima do relógio, ex.: Enduro de Resistência, Classificação". Change only `title`/`description`. The property key stays, so existing items keep working.

### G. Concept doc vocabulary

* `docs/00-concept.md` §2 gets the vocabulary João confirmed, one line each: graphic, item, rundown, shortcut panel, instance, layer, macro, preview (= the result), and "Editar item vs Edição rápida (item vs instance)". Update §4/§6 for the new commands, slice and preview composition.

## Tests (write first)

* **Renderer, `selectInstancesForPreviewComposition`, table-driven:**
  + program only → program shown;
  + preview on a layer with program → preview only;
  + marker on a layer with program → empty;
  + preview and program on different layers → both;
  + preview page sends no status (keep).
* **Reducers, table-driven:**
  + previewClearLayer adds the marker and removes the preview;
  + previewItem removes the marker;
  + stopPreview all clears markers;
  + takePreview on a marked layer clears program;
  + takeAllPreviews promotes all and clears marked layers in one state change (assert one event-log row) and refuses when empty;
  + hydrate drops markers.
* **previewMacro:**
  + take, take, clearLayer → the end state in preview, program untouched;
  + clearAll marks only layers with program content;
  + waits ignored;
  + a missing item refuses with nothing changed;
  + runMacro discards previews first.
* **Items:** layer change accepted; the on-air instance is untouched after a layer change; graphic change is impossible through the command schema.
* **Control:**
  + Editar on a Camadas row loads that instance;
  + Atualizar targets its id when two instances of the same graphic are on air;
  + target leaving the air drops back to new-take mode with values kept;
  + Salvar como item builds the right `createItem`;
  + "Mover para atalhos" sends `moveItemToHome`;
  + Tomar tudo / Descartar tudo visibility and commands;
  + macro Prévia sends `previewMacro`.
* **E2E:**
  + clock on air on Relógio, preview a lower third on Tarja → the Prévia stand-in shows both, and the program stand-in shows only the clock;
  + preview a second clock on Relógio → Prévia shows only the new clock;
  + Tomar tudo → program equals what Prévia showed;
  + macro Prévia then Tomar tudo → program matches the macro's end state.

## Done when

Root CI green. In OBS: with a clock and bug on air, previewing a set of three items shows the Prévia monitor exactly as program looks after Tomar tudo; a macro previewed and taken lands its end state in one cut; editing one of two on-air clocks from Camadas changes only that one. List the walk steps for João in the PR. Decisions appended; concept doc updated.
