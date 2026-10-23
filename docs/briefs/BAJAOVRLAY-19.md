# Agent brief — BAJAOVRLAY-19: the entity library (teams, people, sponsors, schedule)

**Branch:** `BAJAOVRLAY-19-entity-library` off an up-to-date `main` (after PR #20 is merged). One PR, left open for João's review. Do not merge. Work through the commit order at the end, tests first at every step, and keep going without asking. Where this brief leaves a choice open, take the plainer option, write it in `docs/decisions.md` and under "Decisions taken" in the PR, and move on.

**This runs in parallel with BAJAOVRLAY-44 (event inbox)** on another branch. Both add a `FieldValue` kind and touch the resolver and the item editor's kind selector. To keep the merge small:

- put the new kind's schema, resolution and editor parts in their own files, adding one line to each shared switch or union;
- whichever PR merges second merges `main` and resolves.

**Read first:**

- `CLAUDE.md`;
- `docs/00-concept.md` §2, §4 (FieldValue entity reference, the `entities` slice, overrides), §5, §7 rule 3, §8 (entities as a source);
- `docs/decisions.md` from PR #18 on;
- `docs/testing-style.md`;
- the bindings module (resolver, live refresh, `instanceBindings`);
- `packages/shared/src/dataShapes/` (car identity is `carNumber`);
- the simulator's `teams.fictional.json`;
- the Fontes page, as the model for a separate tablet-friendly route;
- `docs/design/directions/ardosia/catalogue.md` on PR #21's branch, for the team card's data needs (city, logo, car photo).

## Why

Graphics need things no scoring feed sends: a team's logo and car photo, a person's name and role for a lower third, sponsor logos for the bug and the roll, the day's schedule. Concept §4 calls this the entity library: our own small tables, edited on the control page or imported from CSV, which item fields can reference. Items then say "the logo of car 42's team" instead of a typed URL, and the team card works the moment a team has a logo, and still looks finished without one.

## Deliverable

### A. Entities (shared + server)

Four slices, persisted, each a Zod schema in shared. All text is pt-BR as typed.

- **teams:**
  - keyed by `carNumber` (integer, unique): the same key the positions shape uses, so a car in the race and its team join with no mapping;
  - `teamName`, `schoolName` (short, "UFPR"), optional `schoolFullName`, `city`, `state` (UF), `logoMediaId`, `carPhotoMediaId`.
- **people:** `personId`, `name`, `role` ("Narrador", "Juiz de segurança"), optional `carNumber` (their team), optional `photoMediaId`.
- **sponsors:** `sponsorId`, `name`, `tier` (enum: `master`, `ouro`, `prata`, `bronze`, `apoio`), `logoMediaId`, `rollWeight` (1–10, how often it appears in a roll).
- **scheduleSlots:** `slotId`, `sessionName`, `sessionKind` (the session shape's enum), `startsAtMs`, optional `endsAtMs`, `place` (optional free text).
  - Its status (concluída, em andamento, a seguir) is **derived** from the clock at read time, never stored, so it can't go stale.

**Commands, operators only:** `upsertEntity` (`entityType` plus the record) and `deleteEntity`. Deleting a team that items reference is allowed. Those items then fail to take with a pt-BR message naming the car, the same as a missing source path (never a half-rendered graphic).

**Event log:** every upsert and delete writes a row, like any operator command.

### B. Media (server)

Images for logos and photos, stored under `${DATA_DIR}/media/`.

- **Upload:** `POST /api/v1/media` (multipart, one file).
  - Accepted: PNG, JPEG, WebP and SVG, up to 5 MB, checked by content sniffing, not by file name.
  - Answers `{ mediaId, contentType, widthPx, heightPx }`.
  - A media record goes into a `media` slice (`mediaId`, `fileName`, `contentType`, size, dimensions, `uploadedAt`).
- **Serving:** `GET /media/<mediaId>`, with long cache headers since a media id never changes content.
  - **SVG safety:** an SVG can carry script. It is only ever drawn through `<img>` (which runs none), and it is served with `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; sandbox` and `X-Content-Type-Options: nosniff`, so opening its URL directly can't run script either. Test the headers.
- **Deleting:** media is deleted with `deleteMedia`, refused while any entity references it. Unreferenced media can be cleaned from the page.
- **Size:** report the folder's total size on the Cadastros page, since media is the data-folder growth that the USB backup (BAJAOVRLAY-33) will copy.

**Graphics never fetch data (rule 3), but an image is an asset.** A resolved field holds the media URL (`/media/<id>`), and the graphic draws it with `<img>`. Write this distinction in decisions and concept §3.3.

### C. Entity references in items (shared + server)

`FieldValue` gains `entity`:

- `entityType` and `attribute` (for example `logoUrl`, `teamName`, `city`);
- the record, chosen by **fixed key** (`carNumber: 42`, `personId`, `sponsorId`, `slotId`).

**Resolution** happens at take and live, through the existing bindings path:

- media attributes resolve to the `/media/<id>` URL;
- an entity edit refreshes on-air fields that reference it, through `refreshBoundInstanceData` (the same actor, rules and event-log exception as source refreshes);
- a missing record refuses the take, naming it;
- a missing optional attribute (no logo) leaves the field out, so the graphic shows its no-logo state.

**Joins:**

- **A car from a source plus its team's entity:** a binding to `positions.entryOfCar.<field>` and an entity reference with the same `carNumber` already meet in one item. Nothing more is needed for the team card.
- **Logos in a list (one per tower row):** out of scope. Leave a README note: it needs a list join, which a later item adds as a named binding transform (`withTeamLogos`), never as a free-form expression.

**The item editor's kind selector gains "Cadastro"** for fields with a compatible attribute:

- the entity type, then the record (a searchable picker: by car number or team for teams, by name for people and sponsors), then the attribute (filtered by the field's type: text, or a URL for image fields);
- the same "Valor agora" line as bindings, worded in pt-BR;
- image fields show a small thumbnail.

**Manifest convention:** a string field whose `v_baja.role` is `imageUrl` is an image field. The editor offers media attributes for it, and the image picker in D. Document it in `packages/graphics/README.md`.

### D. Control page: "Cadastros" (control)

A separate route like Fontes, opening in a new tab from the header ("Cadastros"), and usable on a tablet. All strings go through the catalog.

- **Tabs:** Equipes, Pessoas, Patrocinadores, Programação. Each is a table, plus a form in a side panel to add or edit, plus delete (two-press, as elsewhere).
- **Images:**
  - drop or choose a file, uploaded at once, then shown as a thumbnail;
  - "Trocar" and "Remover" (remove keeps the media until it is cleaned).
- **CSV import** per tab: paste or choose a file. A preview table shows each row as "novo", "atualiza" (same key) or "erro" (with the pt-BR reason and the line number). "Importar" applies only the valid rows, as one command per row or one batch command (record which).
  - Columns are documented on the page and in the README, with a downloadable example per tab.
  - Images are not part of the CSV.
- **CSV export** per tab, the same columns.
- **"Importar equipes do simulador":** loads the simulator's fictional teams as entities, for walks and rehearsal. It is labelled as fictional, and asks for confirmation when teams already exist.
- **Programação:** sorted by start time, with the derived status shown.

### E. Docs

- `docs/00-concept.md`:
  - §2: entity, media;
  - §3.3: images as assets;
  - §4: the four entity slices, media, the `entity` FieldValue, the `imageUrl` role;
  - §8: entities.
- READMEs for the new module and the Cadastros feature folder.
- Decisions lines for every choice this brief leaves open.

## Tests (write first, in this order of commits)

- **Shared.**
  - Entity schemas, table-driven: carNumber unique, UF valid, tier enum, rollWeight range.
  - The `entity` FieldValue schema.
  - The derived schedule status at given moments.
- **Server.**
  - upsert and delete, with event-log rows.
  - Persistence across a restart.
  - Media:
    - upload accepts PNG, JPEG, WebP and SVG;
    - it refuses a renamed `.exe` and a 6 MB file;
    - dimensions are read;
    - serving headers include the SVG CSP and nosniff;
    - delete is refused while referenced;
    - path safety: a crafted media id can't read outside the folder.
- **Resolver.**
  - An entity attribute at take.
  - A media attribute gives the URL.
  - A missing record refuses, naming it.
  - A missing optional logo leaves the field out.
  - An entity edit refreshes the on-air field.
  - A source binding and an entity reference in one item (the team card's case).
- **Control.**
  - Cadastros tabs, form and delete.
  - Image upload with a thumbnail.
  - CSV import preview with new, update and error rows; only valid rows applied.
  - CSV export round-trip.
  - "Importar equipes do simulador" asks before overwriting.
  - The item editor's "Cadastro" kind: picker, attribute filtered by type, "Valor agora", thumbnail.
- **E2E.**
  1. Import the simulator's teams.
  2. Upload a logo for car 7.
  3. Create a race-clock item whose title references car 7's team name, take it, and the title is on air.
  4. Rename the team in Cadastros, and the title on air follows.
  5. Delete the team, and the item's row says it can't be taken now.

## Commit order

1. The brief in `docs/briefs/BAJAOVRLAY-19.md` (documentation only).
2. Entity schemas and slices: tests, then code.
3. Media upload, serving and the media slice: tests, then code.
4. The `entity` FieldValue, resolution and live refresh: tests, then code.
5. Control: Cadastros, CSV import and export, simulator import: tests, then code.
6. Control: the item editor's "Cadastro" kind and the image picker: tests, then code.
7. E2E.
8. Docs and decisions.

Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, every `pnpm test:e2e` and `git diff --check` before opening the PR. Report the CI job's duration. CI time is tracked in BAJAOVRLAY-42, so add no real-time waits.

## Done when

Root CI green; lint with no warnings. On João's machine:

- "Cadastros" lists the imported fictional teams;
- a logo uploads and shows;
- an item field references a team's name and follows an edit on air;
- a CSV round-trips;
- an SVG logo's URL opened directly runs nothing.

The PR description has the walk steps, "Decisions taken", and anything left out and why. Report and stop; João merges after gate 2.
