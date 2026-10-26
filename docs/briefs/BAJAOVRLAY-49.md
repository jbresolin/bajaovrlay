# Agent brief — BAJAOVRLAY-49: outputs and editable layers

**Branch:** `BAJAOVRLAY-49-outputs-and-layers` off an up-to-date `main`.

Follow CLAUDE.md's process:

* draft PR;
* `pnpm verify` before every push, with `BAJAOVRLAY_E2E_PORT_OFFSET=700`;
* report, then stop;
* do not merge.

Where this brief leaves a choice open, take the plainer option, record it in `docs/decisions.md`
and under "Decisions taken", and move on. Choices marked **(decided)** are settled.

**Read first:**

* `CLAUDE.md`, `docs/testing-style.md` and `docs/ci.md`;
* `docs/00-concept.md`:
  + §3 and §6: the renderer and its addresses (`/render/`, `?target=preview`, `?monitor=1`), the screen roles and the slices sent to screens;
  + §4: layers, instances, takes, clears, previews, `previewClearedLayerIds`, macros, auto-out, `nextOnLayer`, the event inbox's rules, and the actors and authorize step;
  + §7, rule 1;
* `apps/server/src/core/store/seedLayers.ts` and `loadInitialSlices.ts`: the seed, and layers added to an existing database at boot;
* every reducer that reads `layerId` (`apps/server/src/core/store/reducers/`) and the shared preview, rundown, macros and steps code;
* `apps/renderer/src/` (the address parsing, the layer containers, the reconciler);
* `apps/control/src/features/layers/` (Camadas) and `features/outputMonitors/` (Prévia and Programa);
* the item editor's layer choice ("Camada", `features/items`);
* graphic manifests' `v_baja.defaultLayerId`.

## Why

João wants scene-specific overlays. An OBS scene with a picture-in-picture box should carry its
own overlay (a frame, a caption with live data) as a separate browser source. Switching to that
scene brings that overlay along, and the main overlay isn't in it.

That needs more than one output, so layers can no longer be a fixed seed. Rehearsals will keep
revealing "we need one more slot here", so **(decided, João)** outputs and layers are edited
from a page in the control app, not from a file.

## Deliverable

### A. Outputs (shared + server)

A new slice `outputs`, each with:

* `outputId`, a short slug used in the address (`pip`);
* `name`, in pt-BR ("PiP");
* `order`, for display.

**(decided)** The output `program` ("Programa") always exists and can't be deleted or renamed
away from its id. A new database seeds it. An existing database gets it at boot, with every
existing layer assigned to it.

Each layer gains `outputId`. The `zIndex` is unique **within** an output, not across outputs.

**Commands, operators only**, through the one command path (rule 2), each with an event-log row:

* `createOutput`, `renameOutput`, `deleteOutput`, `reorderOutputs`;
* `createLayer` (`outputId`, `name`, `zIndex`, `replacePolicy`, `persistent`);
* `updateLayer` (`name`, `zIndex`, `replacePolicy`, `persistent`);
* `moveLayerToOutput`;
* `deleteLayer`.

**Guards**, each refused with a pt-BR reason that names what blocks it:

* **Deleting a layer is refused** while it has an instance on air or in preview, or a "vai limpar" mark. It is also refused while items, quick-fire panels, macro steps or event rules name it. The reason lists them (for example "Usada por 3 itens: …; 1 macro: …").
* **Moving a layer to another output is refused** while anything is on it (on air or in preview).
* **Deleting an output is refused** while it has layers.
* **A `zIndex` already used in that output is refused.**
* **Deleting or renaming a layer that is some graphic's `defaultLayerId` is allowed.** The confirmation dialog warns "N gráficos usam esta camada como padrão". Items keep their explicit layer.
* **A graphic whose `defaultLayerId` no longer exists** falls back as the concept says today: the fullscreen layer of `program`, with a logged warning. The editor then shows the layer choice as required.

Layer ids are made by the page (as entity ids are) or are slugs; record which.

### B. The renderer per output (renderer + server)

* **Addresses:**
  + `/render/?output=pip` draws only the layers of output `pip`;
  + `/render/` with no `output` is `program`, so OBS setups don't change;
  + `?target=preview` and `?monitor=1` combine with `output` as they do today.
* **What a screen receives:** a screen connection still gets only the slices it draws (the allowlist). Filtering the layers and instances to its output may happen on the server, per connection, or in the renderer. Pick the plainer and record it. Server-side filtering is preferred if it doesn't complicate the broadcast path, because it keeps OBS's work minimal.
* **Reporting:** the program renderer reports instance status as today. A renderer on another output reports for its own output's instances; that may be one renderer per output, so check the "only the program output reports" rule in §4 and generalise it to "the renderer of the instance's output reports". With no renderer connected for an output, its instances stay loading, as today.
* **Layer changes on air:** a layer added or reordered while renderers are connected takes effect without a reload, through the containers being rebuilt from the slice.

### C. The control page (control)

* **"Saídas e camadas":** a settings route like Cadastros (`#/saidas`), opened from the header in a new tab.
  + Outputs are listed with their renderer address, with a copy button: `http://<server>/render/?output=pip`, the address to paste into OBS.
  + Each output's layers are listed in z-order, with drag to reorder (dnd-kit, as the rundown), name, replace policy, persistent, and delete (two-press, as elsewhere).
  + Add output, add layer.
  + Every refusal shows its pt-BR reason.
* **Camadas** groups its rows by output. "Programa" comes first and the others are collapsible.
* **Monitors:** Prévia and Programa get an output picker, `program` by default and kept per browser.
* **The item editor's "Camada"** groups layers by output. A quick-fire panel's and a macro step's layer choices do the same.

### D. Everything else keeps working

Takes, clears, `clearAll` (decide and record: all outputs, or only `program`; the plainer is all
outputs, with "Limpar tudo" saying so), previews and "Tomar tudo", macros and `previewMacro`,
auto-out, `nextOnLayer`, the event inbox and its notice layer, live refresh and the steps clamp.
They already address layers, so most need no change. Prove that with tests, not by assertion.

### E. Docs

* `docs/00-concept.md` §4 and §6: outputs, editable layers, the renderer addresses. Correct the "fixed list per theme; not operator-editable" line.
* READMEs: the new feature folder, the renderer's addresses.
* A runbook paragraph in the README on adding a PiP output and its OBS browser source.
* A `docs/decisions.md` line for every choice.

## Tests (write first)

**Shared and server:**

* the schemas: a `zIndex` unique per output, and `program` always present;
* the boot migration of an existing database: every layer is assigned to `program`, and the old seed layers added at boot still work;
* each command applies, is refused, and writes an event-log row, with each guard as a table row and the pt-BR reason naming what blocks it;
* `clearAll`'s scope;
* a fallback for a deleted default layer;
* the screen allowlist per output.

**Renderer:**

* `?output=pip` draws only its layers;
* `/render/` is `program`;
* `target`, `monitor` and `output` combine;
* a layer added on air appears without a reload;
* status reporting per output.

**Control:**

* the settings page: create, rename, reorder by drag (mouse and keyboard), delete with its two-press, refusal reasons, and the copy button;
* Camadas grouped by output;
* the monitor's output picker;
* the editor's grouped "Camada".

**E2E**, on the real server, with two renderer pages:

1. Create output "PiP" with a layer "Moldura".
2. Create a lower-third item on that layer and take it.
3. `/render/?output=pip` shows it and `/render/` doesn't.
4. Clear it; deleting the layer is refused while an item uses it, then allowed once the item is gone.

## Commit order

1. The brief, as `docs/briefs/BAJAOVRLAY-49.md`.
2. The outputs slice, the layer `outputId` and the boot migration.
3. The commands and guards.
4. The renderer per output and the screen allowlist.
5. The settings page.
6. Camadas, the monitors and the editor grouped by output.
7. E2E.
8. Docs and decisions.

## Done when

* `pnpm verify` is green.
* The full Vitest suite passes 5× pinned to 2 cores with `GITHUB_ACTIONS=true CI=1`.
* On João's machine, a PiP output added from the page shows its own graphic in a second OBS browser source, and the program output is unchanged.
* The PR description has the walk (including the OBS steps), "Decisions taken", and what was left out and why.

Report and stop. João marks the PR ready after gate 2.
