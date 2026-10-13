# 00 — Concept & Architecture

Design authority for BajaOvrLay. This file is authoritative between milestones: as-built changes are written into it in the PR that makes them. The Plane page of the same name (BAJAOVRLAY project, `personal` workspace) is the human-readable mirror, which João updates from this file at each milestone close. v0.1 rev 3 plus decision records §18–§19.

## 1. What this is

A stream-graphics system for Baja SAE Brasil live streams: an operator control page where graphics are configured, pre-programmed and queued, and a renderer page that OBS loads as a browser source and that plays the graphics on air. Graphics get their data from the Baja scoring system, from small databases we run ourselves (teams, people, sponsors, schedule), and from values typed in by hand.

The previous attempt failed on three fronts (functionality, control, looks), so this project starts from a written design and treats operator usability as the primary requirement. A stream at the track is run by volunteers under time pressure; anything that needs explanation on the day is a defect.

### Non-goals for v1

- A visual template editor. Graphics are authored in code by a developer; operators only fill fields and press buttons.
- CasparCG or SDI output, newsroom (MOS) integration, 24/7 unattended playout.
- Multi-tenant or public hosting. This runs on our LAN at the event and on TrueNAS between events.

## 2. Vocabulary

- Graphic: one on-screen element type (clock, lower third, standings table), packaged as an EBU OGraf graphic: a manifest, a web component and assets.
- Layer: a named slot in the output where at most one graphic instance is on air at a time (clock, lower-third, fullscreen, ticker, bug). Layers have a fixed z-order.
- Item: a prepared use of a graphic: which graphic, which layer, and a value or a binding for each field. Items live in a rundown or in a quick-fire panel.
- Binding: a field value looked up from a data source instead of typed (for example scoring.enduro.positions). A binding is either live (keeps updating while on air) or a snapshot (frozen at take).
- Rundown: an ordered list of items for a session, with a cursor for "next".
- Take, Clear, Next: put an item on air on its layer; remove what is on that layer; advance a multi-step graphic (or the rundown cursor).
- Preview: rendering an item off-air so the operator can see it before taking it.
- Instance: a graphic currently loaded in the renderer (previewing or on air), with the data it was resolved with.
- Data source: a poller that produces a normalized JSON snapshot: scoring, a sheet or CSV, the entity library.
- Entity: a record in our own library: team, person (speaker, judge), sponsor, schedule slot.
- Macro: a named list of commands run as one button press (clock on, positions on, bug on).

## 3. Architecture

Four deployable parts, one repository, one Node process at runtime.

- Control page (browser) talks to the server over WebSocket and REST.
- Server (Node) holds the state store (in memory, persisted to SQLite), the data sources (pollers producing snapshots), the binding resolver (item fields plus snapshots become data for a graphic), OBS control (obs-websocket) and the REST API at /api/v1 with OpenAPI, used by Companion, Stream Deck and scripts.
- Renderer page (browser inside OBS) receives state from the server over WebSocket.
- Graphics (OGraf packages) are static files served by the server and loaded by the renderer.

### 3.1 The server owns the truth

The server holds the whole application state in memory and persists it to SQLite. Clients never hold state of their own; they send commands and receive state. Every command that changes something or is refused is appended to an event log (who, when, what). This is the NodeCG "replicant" idea reimplemented in one module: a store of named slices, each validated by a Zod schema, each broadcast to every connected client when it changes.

Consequences:

- A control page refresh loses nothing.
- A renderer refresh (OBS reloading the browser source) re-requests the snapshot and rebuilds exactly what was on air.
- Two operators on two devices see the same thing at the same time.

### 3.2 The renderer is thin and dumb

A framework-free TypeScript page. One absolutely positioned container element per layer, stacked in z-order. It loads OGraf graphics as ES modules and drives them through the OGraf lifecycle (load, playAction, updateAction, stopAction, dispose). It has no logic about what to show; it mirrors the instances slice. Every dependency in the renderer is a frame-drop risk inside OBS, so it stays minimal.

### 3.3 Graphics are OGraf, nothing else

Each graphic is an OGraf v1 package with a JSON Schema for its data. That schema is what the control page uses to generate the item form; no hand-written form per graphic. Graphics receive resolved data only and never fetch anything themselves. Theme values (colors, fonts, logos) arrive as CSS custom properties that the renderer sets on the layer container.

As built in M1 (BAJAOVRLAY-14): the control page holds no code for any one graphic, and a test (apps/control/src/noGraphicSpecificCode.test.ts) fails if the race clock's id or its reference field is named outside the catalog and the tests. Both forms, the item editor's and "Edição rápida", are generated by features/schemaForm from the manifest's schema, which must be an object with properties. What it reads from each property: title is the label (the key when there is none), description the help text, default the starting value, required whether blank is refused, minimum, maximum, minLength and maxLength the limits. A string is a text input, with enum a dropdown whose option labels come from OGraf's gddOptions.labels (the enum value itself when there is none), with format date-time a date and time input sent as ISO 8601 text. An integer or number is a number input, with v_baja.unit ms a duration typed as mm:ss. A boolean is a switch. An integer with v_baja.role wallClock also offers the kind "Momento da entrada no ar" (takeTime), and starts on it in a new form. Every other shape (arrays, nested objects, oneOf and the like) is shown as read-only JSON and passed through untouched. The form checks itself with a Zod schema built from the same JSON Schema, for pt-BR messages that name the field; the server's check stays the authority. On the manifest itself the server, not the control page, reads v_baja.updateRule: the name of the rule every update of that graphic on air runs through (§4); the race clock names carryClockForward, and a graphic that names none has no rule. packages/graphics/README.md states the same for whoever writes a manifest.

### 3.4 The control page is a realtime console

React with shadcn/ui, fully client-rendered, fed by the WebSocket state stream. Three areas always visible on a desktop layout: rundown (left), preview and program monitor (center), quick-fire panel and layer status (right). Data-operator screens (entities, standings overrides, data-source health) are separate routes that work on a tablet.

## 4. State model

Slices, each a Zod schema in packages/shared. Field names below are the real ones to be used in code.

layers: id, name, zIndex, replacePolicy (one of out-then-in, cut, crossfade), persistent. Fixed list per theme; not operator-editable.

graphics: installed OGraf manifests plus our metadata: id, manifest, defaultLayerId, category, thumbnailUrl, defaultFields.

rundowns and items: Rundown has id, name, sessionLabel, cursorItemId. Item has id, rundownId or quickFirePanelId, order, graphicId, layerId, fields (a map from field key to FieldValue), autoOutAfterMs (optional), label, color, notes.

As built in M1: rundowns and items are two slices, persisted like the others. cursorItemId is the id of the "next" item or null. A rundown may also carry wasLastItemTakenAtCursor: the server sets it when the last item is taken at the cursor (the cursor is then on nothing because the rundown was played to its end) and takes it off as soon as the cursor is put on an item; left out means no. One rundown, "Sessão principal" (id sessao-principal), is seeded on the first boot and on a database that has none. Every item has a rundownId; quickFirePanelId arrives with the quick-fire panels. order is counted from 0 and the server keeps each rundown's orders as 0, 1, 2 and so on with no gaps. color is one of six semantic names (neutral, info, success, warning, danger, highlight). autoOutAfterMs is a whole number of milliseconds above zero; no auto-out is said by leaving it out.

FieldValue is one of:

- literal: kind 'literal', value
- binding: kind 'binding', sourceId, path, live (boolean), transformId (optional)
- entity reference: kind 'entity', entityType, entityId, attribute (sugar for a binding into the entity library)

- take time: kind 'takeTime', no value (added in M1 by BAJAOVRLAY-13)

As built in M1 the FieldValue schema is a discriminated union on kind with two members. literal carries a value that may be anything, null included, but must be present. takeTime carries nothing else (one written with a value is refused, not stripped): at the take the server resolves it to the wall-clock milliseconds of that take, the same moment as the instance's takenAt and the event-log ts, and the stored item keeps saying takeTime, so every take of the item stamps its own moment. The item editor stores a wall-clock field (an integer whose manifest property says v_baja.role wallClock, such as the race clock's referenceWallClockMs) this way for every new item, so a clock saved running counts from the take and not from the save; the operator may switch the field to a typed number. What the editor stores, as built by BAJAOVRLAY-14: one FieldValue per field of the generated form, literal for a typed value and takeTime for a field left to the server; a field left cleared is not stored for a new item, and clearing a field of a stored item stores a literal null (updateItemFields cannot remove a key), which the take then leaves out of the data. The resolver stays pure: it is handed the moment of the command and reads no clock. binding and entity reference join the union in M2. Until then a field of any other kind never reaches a take: a command carrying one is refused with INVALID_COMMAND by the command schema, and a stored items row holding one stops the boot. The resolver's own refusal, UNSUPPORTED_FIELD_KIND with a message that names M2, is a guard kept ready for M2; it cannot be reached through the server today, and literal and takeTime never get it.

The item and rundown commands, as settled by BAJAOVRLAY-13: createItem (rundownId, graphicId, layerId, fields, label, and optionally order, color, notes, autoOutAfterMs) puts the item at the end of the rundown, or at the given position with the items from there on moving down by one; the server makes the id. updateItemFields (itemId, and any of fields, label, color, notes, autoOutAfterMs) changes only what it carries: fields are merged key by key, autoOutAfterMs null removes the delay, and the rundown, graphic and layer of an item cannot be changed. deleteItem (itemId) removes the item and renumbers the rest. reorderItems (rundownId, orderedItemIds) takes the full list and is refused with ITEMS_NOT_A_PERMUTATION unless it holds exactly the rundown's items, once each. moveCursor (rundownId, itemId or null) is refused for an item of another rundown. takeItem (itemId) resolves the item's fields into data and runs the same reducer as a take by hand, always on the program output, so the new instance is what takeGraphic would make plus itemId; an instance taken by hand has no itemId, and an instance keeps its itemId even after the item is deleted. takeNext (rundownId) is a takeItem of the item at the cursor and is refused with RUNDOWN_CURSOR_EMPTY when the cursor is on nothing.

The cursor rules: the first item created in an empty rundown gets the cursor and no later create moves it; a take moves the cursor only when the item taken was the cursor item, to the item after it, or to nothing after the last item (it never wraps to the top), so takeNext always moves it on, while a takeItem of any other item (a row fired ad hoc) leaves the cursor exactly where it was, a cursor on nothing included; deleting the item at the cursor moves the cursor to the item that followed it, or to nothing; reordering keeps the cursor on the same item; a refused command never moves it.

When an item taken with takeItem or takeNext has autoOutAfterMs, the server sends a clearLayer for the item's layer after that delay, as the actor sistema:auto-out, unless the instance has left the layer first. An actor whose name starts with sistema: is the server itself (no connection is ever given that role) and may send only clearLayer; the authorize step refuses every other command from it with NOT_ALLOWED. The wait lives in memory only: after a server restart nothing is rescheduled and the item stays on air until it is cleared.

Transforms are a registry of named, pure functions (topN(6), formatLapTime, abbreviateUniversity), never free-form expressions. Readable, testable, no surprises on air.

dataSources: id, kind (one of scoring, csv-url, entities, manual), config, pollIntervalMs, status (lastOkAt, lastError, isStale), snapshot. The snapshot is the last good payload; on failure it is kept and marked stale, never blanked.

overrides: sourceId, path, value, reason, setBy, setAt. Operator-typed values that win over the source until cleared. Shown as a badge everywhere the path appears.

instances (what the renderer mirrors): id, layerId, itemId, target (program or preview), resolvedData, currentStep, status (one of loading, ready, on-air, stopping, failed), statusDetail (optional; why a failed instance failed, as the renderer reported it), takenAt. A new instance is loading until a renderer reports it on-air or failed, and an on-air instance becomes failed if a renderer reports a failure afterwards; a failed instance stays in the slice until it is cleared or replaced, never removed on its own.

entities: tables for teams, people, sponsors, scheduleSlots. Teams carry number, name, university, city, logo, car photo. Sponsors carry tier and roll weight.

theme: semantic tokens for the on-air graphics (brand primary color, display font, logos, event name and year). One active theme.

macros: id, label, commands (a list of Command).

eventLog: append-only: ts, actor, command, payload, result.

### Commands, the only way state changes

takeItem, clearLayer, clearAll, nextOnLayer, previewItem, previewGraphic, stopPreview, takePreview, updateItemFields, reorderItems, moveCursor, runMacro, setOverride, clearOverride, setDataSourceEnabled, upsertEntity, importEntities. Each has a Zod input schema; each is validated, authorized, applied, logged and broadcast, in that order, in one code path.

updateInstanceData (instanceId, data) changes an instance that is on air without replacing it: the fields in data are laid over resolvedData (top-level keys only), the result is validated against the JSON Schema in the graphic's manifest, and the instance keeps its id, so the renderer calls updateAction instead of taking the graphic off and on again. An unknown instance is refused with INSTANCE_NOT_FOUND; data the schema does not accept, in a take or in an update, is refused with INVALID_GRAPHIC_DATA and a pt-BR message naming the field.

As built in M1 (BAJAOVRLAY-14), takeGraphic (graphicId, layerId, data, and optionally target and takeTimeFieldKeys) and updateInstanceData (instanceId, data, and optionally takeTimeFieldKeys) prepare the data in steps before that check, in this order. First the nulls: a top-level null means "no value", so takeGraphic leaves that key out of the data and updateInstanceData takes that key off the instance's resolvedData, which is how an optional field leaves the air; a null deeper than the top level is a value like any other. Then the stamps: takeTimeFieldKeys (a list of field names, empty when left out) names the fields the server fills with the command's own moment in wall-clock milliseconds, the same moment as takenAt and the event-log ts, replacing whatever the command sent for them, so a client never sends its own clock. Only a field the graphic's schema declares as an integer with v_baja.role wallClock may be named: any other key is refused with INVALID_GRAPHIC_DATA before anything is stamped, and a graphic without a schema accepts no stamp. Then, in updateInstanceData only, the update rule the manifest names in v_baja.updateRule, if any. Update rules are a registry of named pure functions (apps/server/src/core/store/updateRules/), like the transforms above and never free-form expressions: a rule is handed the data on air, the fields sent, the keys stamped, the keys cleared and the command's moment, and hands back the fields to write. The one rule so far, carryClockForward, keeps a race clock from jumping: when the time, the running switch or the mode changed and the reference moment was neither stamped nor sent with a new value, it writes the typed time, or else the time on screen at that moment (never below 0), together with that moment as the new reference; when the mode changed and no time was typed, the time written is the whole second the screen was showing (elapsed rounds down, remaining up), so the number on screen does not move at the press; the sum and the rounding are the graphic's own, kept once in packages/shared/src/clock. A manifest that names an unknown rule, or one whose fields its schema does not declare, is warned about at boot and every update of that graphic is refused with INVALID_GRAPHIC_DATA; it can still be taken. Then the no-change check: an updateInstanceData whose result equals the data already on air (no field sent, nulls only for keys that are not on air, or the values already on air sent again) changes nothing and leaves no trace: it is answered ok, and nothing is saved, logged or broadcast; a stamp writes the moment of the command and is therefore a change. Last the manifest's schema, on the whole result: a required field taken off is refused with INVALID_GRAPHIC_DATA. takeItem goes through the steps of a take with the keys of its takeTime fields as the stamp list, so an item whose takeTime field is not a wall-clock field of the graphic is refused at the take, and an item field stored as a literal null goes on air without that field. createItem and updateItemFields run the same check on the takeTime fields they carry and refuse such a field with the same message, so it is not stored either.

As built in M1 (BAJAOVRLAY-14 follow-up), every hello and slice message carries serverNowMs, the server's wall clock as the message is built. A renderer page and the control page each keep the difference between that and their own clock as the median of the last five samples, and readServerAlignedTimeMs (packages/shared/src/clock) hands back their own clock plus that difference; the race clock reads it instead of Date.now(), so a clock on air counts from the server's clock even when the OBS machine's clock is off. The difference is kept in one property of globalThis, because the renderer and each graphic are separate bundles. In "Edição rápida", for a graphic whose manifest names carryClockForward and marks its four clock fields with the roles clockTime, wallClock, clockRunning and clockMode, the untouched time field shows the time on screen, live; the form still holds the reference that is on air, so that shown time is never sent.

reportInstanceStatus (instanceId, status on-air or failed, detail optional) is how a renderer says what really happened on screen: it moves a loading instance to on-air or to failed, and an on-air instance to failed when a renderer reports a failure later. Any other report (a second on-air, anything about an instance that is already failed, or a late report about an instance that is no longer there, which is the normal end of a quick clear) changes nothing and is answered ok, not refused. It is the one command an operator may not send and the only one a renderer may; the authorize step refuses the rest with NOT_ALLOWED. The server's own actor, sistema:, may send neither it nor anything else but clearLayer. Until login exists a WebSocket connection is a renderer when it connects to /ws?role=renderer (its actor is renderer: followed by the connection id) and an operator otherwise (operador: followed by the connection id); the role is taken at its word until the LAN PINs of M4. Only the program output reports: the page OBS loads (/render/) connects as a renderer, while the program monitor on the control page frames /render/?monitor=1, which connects to /ws with no role and never sends instanceStatus. With no program renderer connected an instance therefore stays loading.

The renderer does not wrap that command in a command message. It sends the client message instanceStatus (type, instanceId, status, detail optional) after playAction resolves, or after an import, load or play that failed, and the server builds reportInstanceStatus from it and runs it through the same code path as every other command.

## 5. Binding resolution and live updates

1. On take, the resolver walks the item's fields: literals pass through; bindings read the source snapshot at the path, apply overrides, apply the transform; entity references read the entity table. Result: resolvedData matching the graphic's schema. A validation failure refuses the take with a readable message; never a half-rendered graphic.
2. While an instance is on air, every time a data source snapshot changes the resolver recomputes resolvedData for instances with live bindings and, if anything differs, the renderer calls updateAction with only the changed keys.
3. Snapshot bindings are resolved once at take and never touched again.
4. A stale source does not stop live updates from being attempted; it shows a stale badge on the instance in the control page. Operators decide whether to clear.

## 6. Renderer contract

- URLs: /render/program (all layers, 1920x1080, transparent background) and /render/preview with an instanceId parameter (one instance, embedded in the control page).
- Load a graphic: create the custom element inside its layer container, await load with data, then playAction to step 0.
- Replace on the same layer, per the layer's replacePolicy. Default out-then-in: stopAction on the old, dispose, then load and play the new.
- Clear: stopAction (animated), then dispose.
- Next: playAction with delta 1; when the graphic reports it reached its end, the server marks the instance stopped.
- Reconnect: request the full instances slice, dispose everything local, rebuild each on-air instance with skipAnimation true.
- Timing metadata from the manifest (actionDurations) is used by the control page to show "animating" and to sequence macros; the renderer only awaits the promises.
- Later, optional: expose the OGraf Server API over REST so third-party controllers can drive our renderer.

As built in M1 (BAJAOVRLAY-15) the renderer is one page, /render/, and its address says what it is. /render/ is the program output OBS loads: it draws instances whose target is program, connects as a renderer and reports each instance on-air or failed. /render/?monitor=1 draws the same and reports nothing (the control page's "Programa" monitor). /render/?target=preview draws only instances whose target is preview, connects without the renderer role and never reports, with or without monitor=1 (the control page's "Prévia" monitor frames /render/?target=preview&monitor=1). Only those exact values count, so any other address is the program output. A preview page is the same reconciler and player: the one difference is that a replace there is always the cut (new graphic loaded behind the old one, then swapped with skipAnimation), whatever the layer's replacePolicy; a first preview still animates in and a discarded one out. Preview is whole layers, not one instance: the /render/preview address with an instanceId was not built.

Every ten seconds the server sends each client the message time (serverNowMs), and hello and slice messages carry serverNowMs too; a page records each as a sample of the server's clock (§4), and a message without it gives no sample.

## 7. Operator experience, the rules

1. Nothing goes to air without being visible first. Preview is one click and is always the same pixels as program. As built in M1 (BAJAOVRLAY-15): the centre shows two monitors, "Prévia" and "Programa", always side by side and the same size, 480x270 at most and shrinking together (always 16:9) on a narrower window. previewItem (itemId, origin) and previewGraphic (graphicId, layerId, data, takeTimeFieldKeys) put an instance on the preview output of a layer, one per layer, resolved and checked exactly as a take; stopPreview (layerId, or null for every layer) discards it; takePreview (layerId) sends what was previewed to program without resolving it again, stamping only its take-time fields anew, and moves the cursor as takeItem does. A row of the rundown and "Edição rápida" each have a "Prévia" button, the lines under the Prévia monitor have "Tomar" and "Descartar", and a layer holding a preview is marked "em prévia". With "Prévia automática" on (the default, kept per browser), the item the cursor arrives on is previewed by the page that moved it: after a move by hand with the arrows or a click, and after a take sent from that page that moved the cursor on, so Space, Space is the operator's loop and each item is seen before it airs. Such a preview carries origin auto, and the server first discards every other preview that was itself automatic, on any layer; previews asked for by hand (origin manual: a "Prévia" button, Shift+Space, "Edição rápida") stay until taken, discarded or replaced on their own layer. Each preview instance records its origin (previewOrigin). Previews are scaffolding: they survive a reload of the control page and are dropped when the server restarts.
2. One-press actions for the common case: take, clear layer, clear all, next. Keyboard: Space = take, Backspace = clear layer, Esc = clear all, Right arrow = next. As built in M1: Space is always "take the item at the cursor" (takeNext), also while the focus is on a button, which is then not pressed; the Right and Left arrows move the rundown's cursor one item forward or back without taking anything, and a click on a row's label puts the cursor on that row. Since BAJAOVRLAY-15, Space sends takePreview when the item at the cursor is the one in preview and takeNext otherwise, and with "Prévia automática" on the take is followed by a preview of the new cursor item (rule 1); Shift+Space previews the item at the cursor; Backspace only discards the most recent preview and does nothing when there is none, so no key clears a single layer: a layer on air is cleared with its "Limpar" button, and Esc clears all. Same actions exposed to Companion and Stream Deck via /api/v1.
3. Forms are generated from the graphic's schema with sensible widgets: a team field is a searchable picker over the entity library, a standings field is a source picker, a duration is a number with units. Required fields block take with a message saying what is missing. As built in M1 (BAJAOVRLAY-14): the widgets are text, dropdown, date and time, number, mm:ss duration and switch (§3.3); pickers over entities and sources come with M2. A required field left blank, an empty required text included, is refused with a pt-BR message naming the field; an optional field left blank, or emptied with its "limpar" button, has no value and reads "Sem valor". "Edição rápida" in the centre takes any graphic ("Colocar no ar", on the graphic's default layer) and changes it in place while it is on the program output ("Atualizar", only the fields the operator changed, null for a cleared one); it shows the graphic taken most recently until the operator chooses one or edits a field, and stays on that graphic, with the values that were on air, when it leaves the air. The item editor offers "Atualizar no ar" while its item is on the program output: it saves the item and then sends the changed typed values to the instance on air. No form carries a rule for one graphic: a clock on air that is stopped, started, turned around or given a new time does not jump because the server's carryClockForward update rule (§4) writes the reference, not because the form sends it.
4. The state of every layer is visible at all times (what is on it, since when, live or stale badge). No hidden state.
5. Undo the last take (re-take the previous item on that layer) and a clearly marked clear all are always on screen.
6. Macros and quick-fire panels cover "the ten things we do every hour"; the rundown covers the scripted parts (openings, podiums, sponsor blocks).
7. Roles: producer (playout), data (entities, overrides, rundown prep), dev (graphics; not a UI role). Auth on the LAN is a per-role PIN.
8. Rehearsal mode: a data source can replay a recorded feed, so the whole show can be practiced with no scoring system running.

## 8. Data sources

- Scoring system: REST endpoints on the Baja app (see §18). Poll every 2 to 5 s during sessions; normalized into positions, standings.overall, standings.EVENT, brackets.EVENT, session (state, clock, flags).
- Entities: SQLite tables in the server. CSV import plus UI editing; logos and photos stored under data/media.
- Sheet or CSV URL: HTTP poll. For things the committee already keeps in a sheet (schedule, speakers).
- Manual: overrides and literal fields. Always available, always visible as such.

Every adapter implements the same interface: a poll function returning a Snapshot, plus a describe function listing the paths it produces (the control page uses this to build the binding picker). Every adapter ships with a recorder (writes snapshots to disk with timestamps), and a shared replayer provides rehearsal mode.

## 9. Graphics catalogue, v1 target

Persistent: race clock and session state with flags; sponsor bug; ticker.

Transient: lower third (person or speaker); team card; race positions tower; standings (overall and per event); elimination bracket (multi-step); upcoming events board; podium reveal (multi-step); fastest lap popup; battle card (two cars, gap); penalty or incident notice; countdown to next session; full-screen intermission board; sponsor roll; social and QR card.

Each graphic has: manifest, component, a preview.html with sample data, and a Playwright screenshot test. Aesthetics are reviewed against the screenshots, not in OBS.

## 10. Stack, aligned with Paddock

Identical to Paddock unless listed under deviations: TypeScript strict, Node 22 LTS, ESM, pnpm workspaces; Drizzle; Zod at every boundary; /api/v1 with OpenAPI generated from Zod; shadcn/ui with semantic tokens; react-hook-form with Zod; Vitest and Playwright; structured logger with request_id, console.log lint-banned; i18n catalog (pt-BR only, see §18); module layout core plus modules, each module with schema.ts, service.ts, api.ts, index.ts; qualified cross-module imports; branches named like BAJAOVRLAY-12-rundown-reorder, one task = one PR, squash merge, CI gates.

Deviations, on purpose:

- SQLite (better-sqlite3 via Drizzle) instead of Postgres: single node, must run offline at the track, backup is a file copy.
- Vite + React for the control page instead of Next.js, served by a Hono server that also owns the WebSocket, REST, pollers and OBS control. The control page is 100% client-rendered realtime UI (Paddock's field-capture case, generalized) and Next has no native WebSocket path.
- Renderer is framework-free; graphics use Lit for the web components and GSAP for animation.

## 11. Repository layout

- apps/server: Hono + ws + Drizzle (SQLite); core and modules folders as in Paddock.
- apps/control: Vite + React operator UI.
- apps/renderer: framework-free TS page loaded by OBS.
- packages/shared: Zod schemas, TS types, WS protocol, command definitions.
- packages/graphics/race-clock, packages/graphics/lower-third, and so on: one OGraf package per graphic (manifest, component, preview, tests).
- docs: this document and its siblings.
- CLAUDE.md: agent contract, adapted from Paddock's.

## 12. Readability law, a merge criterion for all code

The person reviewing this code is not its author and will not have an IDE open. Every rule below follows from that.

Naming. Names are sentences with the vowels left in: resolveItemFieldsIntoGraphicData, not resolve; isStale, not st. Abbreviations only for domain terms everyone here knows (OBS, WS, RPM). Booleans read as questions (hasLiveBindings). Functions are verbs, data is nouns.

Files. One responsibility per file, and the filename says which. Target 80 to 300 lines; under 40 lines probably belongs with its neighbour, over 400 means a second responsibility moved in. No utils.ts or helpers.ts grab-bags; generic helpers get a named home (lapTimes.ts, ordering.ts).

Folders. Folder = feature or concept, never top-level dumping grounds like types, hooks or services. Every package and every module folder has a 5 to 15 line README.md saying what lives there and where to start reading.

Comments. Explain why and what could go wrong, not what the line does. Every exported function has a 1 to 3 line doc comment stating its purpose and the non-obvious inputs. Any deliberate trade-off ("we keep the stale snapshot on purpose; a blank table on air is worse") is written next to the code, not in the PR.

Cleverness budget: zero. No conditional-type gymnastics, no generic abstractions with one call site, no metaprogramming, no clever one-liners. If a reviewer would need to run it in their head, rewrite it as steps with named intermediates.

Public surface. Each module's index.ts lists what it exports with a one-line comment each. Nothing else is importable from outside.

## 13. Testing policy

Tests are the primary review artefact. A PR is reviewed by reading its tests first; if the tests do not explain the behavior on their own, the PR is incomplete.

- Unit (Vitest): binding resolver, transforms, command handlers, layer replace logic, WS protocol codec, each data adapter's normalizer.
- Integration (Vitest with a real SQLite file): persistence round-trips, migrations, event log, snapshot and reconnect rebuild.
- Component (Vitest with Testing Library): generated item forms from real manifests, layer status panel, rundown reordering.
- Renderer (Playwright): OGraf lifecycle ordering against a fake graphic, reconnect rebuild, one screenshot per graphic with sample data.
- E2E (Playwright): open control, preview, take, live update from a replayed feed, clear.
- Chaos (scenario suite): data source down, stale, garbage payload; WS drop mid-take; two operators taking on one layer at once.

Test readability, written for a beginner. Paddock's law applies (sentence-style names, arrange-act-assert separated by blank lines, table-driven named scenarios, no clever generation, factories named for what they build), plus:

- Every test file opens with a plain-language header: what this module is for, what these tests prove, what they deliberately do not cover.
- Every test has a one-line comment above arrange, act and assert explaining in everyday words what is being set up, done and checked, even when it looks obvious.
- Table-driven scenarios have a comment per row saying why that row exists.
- Test data reads like the real thing (team 42, "Baja UFPR"), never foo, bar or x1.
- Assertions state the expectation in the failure message, for example: expect(result, 'the leader must be first after the pit stop').

Flaky test = bug; quarantine visibly, never delete to green. CI blocks merge on lint, typecheck or any test failure.

## 14. Deployment

- Between events: one Docker image (the server serves the control and renderer builds and the graphics), compose stack on TrueNAS via Portainer, behind the existing proxy. The SQLite file and media live on a dataset covered by the nightly dump script.
- At the event: the same image on the stream PC (Docker Desktop) or on a small box at the desk. OBS browser source points at the box on port 8080, path /render/program. Nothing on screen depends on the uplink; the scoring poller degrades to stale, never to blank.
- Backups at the event: copy the data folder to a USB stick at every session break (a one-click action on the control page's admin route).

## 15. Integrations

- OBS via obs-websocket (same library as Baja Playout): scene switch as a macro step; tally of which scene is live shown in the control page.
- Companion and Stream Deck: plain HTTP calls to /api/v1/commands with a static token, documented by the generated OpenAPI. A proper Companion module is a later nice-to-have.
- Audio: read the XR18 mute state through the existing OSC bridge to drive an "on mic" indicator on speaker lower thirds. Later milestone.

## 16. Milestones

- M0: scaffold, state store, renderer, race-clock graphic end to end. Done means: clock on air in OBS from a button on the control page; refresh both sides and nothing is lost.
- M1: layers, rundown, items, preview and program, generated forms, quick-fire, macros. Done means: producer runs a rehearsal show with literal data only.
- M2: data sources (scoring adapter, entities, CSV), live and snapshot bindings, overrides, recorder and replayer. Done means: positions tower updates live from a replayed feed; stale badge works.
- M3: full graphics catalogue, theme, screenshot tests. Done means: every v1 graphic reviewed from screenshots and signed off.
- M4: OBS control, Companion API, roles and PINs, event log viewer, undo. Done means: full show run by two volunteers using the one-page operator guide.
- M5: event hardening (chaos suite, USB backup, offline verification, packaging for the stream PC). Done means: dry run on the real stream PC with the uplink unplugged.

## 17. Open decisions

Closed on 2026-09-29; see §18. Kept for the numbering.

1. Scoring system access.
2. Vite + React + Hono versus strict Next.js.
3. LAN per-role PIN auth.
4. Elimination brackets: data-derived or partly manual.
5. en-US catalog or pt-BR only.
6. Vertical 9:16 output.

## 18. Decision record (2026-09-29)

João's answers to §17. This record wins.

1. Scoring system access: REST. Some endpoints exist, some need implementing. That work is a separate project, handled in the Baja app task queue; BajaOvrLay only consumes the endpoints. The scoring adapter in M2 is written against the REST contract, with the recorder/replayer covering any endpoint that is not ready yet.
2. Control page stack: Vite + React + Hono, confirmed.
3. LAN per-role PIN auth: accepted.
4. Elimination brackets: fully derivable from scoring data. The existing Baja-app bracket code holds all progression logic in its `tournament` table; the M3 bracket graphic is pure presentation over a REST read of it (see the review on BAJAOVRLAY-25).
5. Language: pt-BR only for v1, both the operator UI strings and the on-air graphics. No en-US catalog.
6. Output format: horizontal 16:9 only. Vertical output dropped from the roadmap.

## 19. Decisions from M0 review (2026-10-09)

- A graphic's id is its folder name under packages/graphics (for example race-clock), which is also its URL path /graphics/race-clock/. The OGraf manifest id (baja-race-clock) is metadata only.
- The graphics slice is derived from the filesystem, never from operator state: it is refreshed from every packages/graphics/*/dist/*.ograf.json on every boot.
- New instances start in status loading; renderer acknowledgement that moves them to on-air is an M1 item (BAJAOVRLAY-12).
- clearLayer and clearAll remove instances immediately; clearAll ignores the persistent flag (it is the panic button).
- takeGraphic has a target field defaulting to program; a take replaces only the instance on the same layer and target.
- The eventLog slice carries the newest 200 entries; the table keeps everything.
- Protocol errors on the WebSocket are answered as commandResult errors; there is no separate error message type.
- Race clock: pre is a real sixth state (PRÉ-LARGADA, neutral band). load requires complete data and is called once per instance; unknown fields are refused with 400 and the previous data is kept. updateAction is accepted at any time after load, including off air. A countdown (remaining mode) rounds partial seconds up; an elapsed clock rounds down.
- A built graphic package with no known default layer is registered on the fullscreen layer (a take there cannot displace the bug, clock or lower third). M1 replaces this guess: each manifest declares its default layer in a v_baja vendor field, and fullscreen with a logged warning remains the fallback.
