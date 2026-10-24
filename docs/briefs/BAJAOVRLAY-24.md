# Agent brief — BAJAOVRLAY-24: lower third, team card and standings

**Branch:** `BAJAOVRLAY-24-lower-third-team-card-standings` off an up-to-date `main` (after
PR #21). Follow CLAUDE.md's process: a draft PR, `pnpm verify` before every push, and a report
that ends with stop. Do not merge.

Where this brief leaves a choice open, take the plainer option, write it in
`docs/decisions.md` and under "Decisions taken", and move on. The choices marked **(decided)**
below are settled in this brief; do not reopen them.

**Read first:**

* `CLAUDE.md`, `docs/testing-style.md` and `docs/ci.md`;
* `docs/00-concept.md`:

  + §3.3 (images as assets);
  + §4 (layers, items, FieldValue kinds, entities);
  + §9;
* `docs/design/directions/ardosia/`:

  + `catalogue.md` (layer plan; entries 1 and 3);
  + `README.md` (sizes and boxes; the lower third is from pass 1);
  + `motion.md` (lower third, team card, standings);
  + the pages `lower-third`, `team-card`, `team-card-sem-foto`, `standings`, `standings-por-prova` and their `motion-*` demos.

  **These pages are the visual spec.**
* `packages/graphics/positions-tower/` end to end, as the model for a graphic package: manifest
  with `v_baja`, model/view/animations split, `pageTurner`, previews, screenshot e2e;
* `packages/graphics/notice/`;
* `packages/theme/` (tokens, fonts, `readMotionTokens`);
* the entities module and the item editor's "Cadastro" kind (BAJAOVRLAY-19);
* `packages/shared/src/dataShapes/standingsShape.ts`, `bindablePaths.ts`, and the flex mapping's
  `mappableFields.ts`;
* the simulator's `standingsFromRaceState.ts`;
* `docs/design/sample_data/results/overall.csv`, the real overall export the standings must be
  able to show.

## Why

These are the graphics used most at an event, and the first to use what M2 built: names,
logos, photos and cities from Cadastros, and live standings from a source. Design pass 2 is
merged, so the look is settled. Reviewers' comments on it will arrive while you work. Treat
every colour, size and duration as a token from `packages/theme/ardosia/tokens.css`, so that
feedback lands as a token or style change, never a rebuild.

## Deliverable

### A. A shared kit for the graphic packages (first, no behaviour change)

**Why:** each package carries its own copy of `ografGraphicTypes.ts` and
`ografSchemaValidator.testSupport.ts`, and the copies have already drifted (three different
files). Adding three more packages would make six.

**What moves into `packages/graphics/kit/` (`@bajaovrlay/graphics-kit`):**

* the OGraf graphic types;
* the manifest schema validator for tests;
* `pageTurner`, used by the tower now and by standings next;
* anything else two or more packages already duplicate. List what you moved and why, and move
  nothing with a single user.

**Rules:**

* Migrate race-clock, positions-tower and notice to the kit. Their tests stay green and
  unchanged apart from imports.
* The kit is bundled into each graphic's build (a workspace dependency, not a runtime fetch).
  Graphics still never fetch anything (rule 3).
* The kit gets a README like every package.

### B. Standings shape: score parts and disqualified teams (shared + server)

The real overall score is not a sum of session kinds. It is PROJETO, DINÂM., ENDURO, 4X4,
SEG. and PEN. (negative), with `—` for a part the source does not know. Disqualified teams
stay in the list.

**(decided)** `pointsByEvent` is replaced, not kept beside the new field: one way to carry
parts.

* On the shape: `scoreParts: { partId: string, label: string }[]`. Optional, in display
  order; the label is pt-BR, as the source names it ("PROJETO").
* On an entry: `pointsByPart: Record<partId, number>`. Optional; a part left out is shown as
  "—".
* A shape-level rule refuses a `pointsByPart` key that names no part, in pt-BR.

**(decided)** On an entry, `isDisqualified: boolean` (optional, default false).

* A disqualified entry has no `rank`.
* Disqualified entries come after every ranked one; ranked entries keep today's rules.
* Write the new rules as `superRefine` checks with pt-BR reasons, next to the existing ones.

**Update everything that reads the shape, with tests:**

* **bindable paths:** add `standingsScoreParts` as a whole-list path, and keep the per-row
  paths;
* **flex mappable fields:** parts as a list with label and value, and the disqualified flag;
* **the simulator:** its overall standings get parts named after its session kinds, labels
  in pt-BR;
* the shape samples, and the Fontes page's table comparison.

Old recordings that carry `pointsByEvent` must still replay: the field is ignored, never a
failure. Add a test with such a recording line.

### C. Team entity: the logo's plate (shared + server + control)

**(decided)** The design puts a dark logo, or one on its own white box, on a small light
plate. The product decides this per team, by hand: the team gets `logoOnLightPlate: boolean`
(optional, default false).

* It appears as a checkbox in the Cadastros team form ("Logo sobre placa clara"), with a
  small preview of the logo on the panel and on the plate side by side, so the operator can
  see why they would tick it.
* It is a CSV column, and a `team` entity attribute the item editor can reference.
* No automatic detection.

### D. Three graphic packages

Each follows the tower's structure:

* a manifest with `v_baja.defaultLayerId` and category;
* model, view and animations in their own files;
* a preview page with Entrar/Sair (and Próximo where the graphic has steps) and the sample
  data, in pt-BR through a catalog;
* motion from the tokens via `readMotionTokens`, exactly as `motion.md` describes.

Image fields use the manifest convention `v_baja.role: "imageUrl"`. Every optional part, when
absent, gives the shorter or simpler layout the design shows, never an empty frame.

1. **`lower-third`** (layer `lower-third`).
   * Fields:
     + a name, required;
     + a role, optional;
     + a team line, optional.
   * Typical item: name and role from a person in Cadastros (Cadastro kind); the team line
     typed, or from the team entity of a car number.
   * No join from person to team in this task.
2. **`team-card`** (layer `lower-third`).
   * Fields:
     + car number, team name and school;
     + city and state, rendered as one line ("CAMPINAS · SP"), each optional;
     + photo URL and logo URL (`imageUrl`), each optional;
     + logo on a light plate, a boolean.
   * All eight combinations of photo, logo and city render as the design's motion demos show.
   * A typical item references team N in Cadastros for everything. Document in the package
     README how to build it, field by field, in the item editor.
3. **`standings`** (layer `fullscreen`).
   * Fields:
     + the entries (bound live or as a snapshot to `standingsEntries`);
     + the score parts (bound to `standingsScoreParts`);
     + the title, typed, default "CLASSIFICAÇÃO GERAL";
     + the event line, typed;
     + the head logo: the organiser's mark from the theme package, not a field.
   * **Layouts, chosen from the data, not by a switch:**
     + **With score parts:** a table of 40 px pills, one muted column per part, total in
       green. 20 rows a page, the page held `--motion-board-hold`, the head's page line
       updating ("2/3 · 21º A 40º"). Paging uses the kit's `pageTurner`.
     + **Without score parts** (per-event scope, or an overall total alone): three columns of
       20 with the tower's 34 px pills and no paging. If there are more than 60 entries, it
       pages by 60, which the design does not show; record the decision.
   * Tied ranks share a number, and rank 1 (tied or not) gets the green chip.
   * Disqualified entries sit at the end, dimmed like a retired row, with "—" as the rank and
     "DESCL." as the total.
   * Live updates while on air re-render the current page in place, with no re-entry.
     Re-ranking between pages is not animated in this task (say so in the README).

### E. Docs

* `docs/00-concept.md`:
  + §4: the standings fields, `logoOnLightPlate`;
  + §9: which items are built;
  + the layer plan as built.
* A README for each new package and for the kit.
* `docs/decisions.md`: one line per open choice taken.

## Tests (write first)

**Shared:**

* the standings schema, table-driven:
  + parts and `pointsByPart` agree;
  + an unknown part key is refused;
  + disqualified with no rank, placed last;
  + a disqualified entry above a ranked one is refused;
  + ties;
* bindable paths for `standingsScoreParts`;
* flex mappable fields;
* `logoOnLightPlate` on the team schema and in the CSV columns.

**Server:**

* the simulator's standings carry named parts;
* an old recording with `pointsByEvent` replays;
* a team's `logoOnLightPlate` resolves through an entity reference.

**Kit:**

* `pageTurner`'s tests move with it, and the validator works against all six manifests.

**Each graphic:**

* **model tests:**
  + the team card's eight combinations: which cells exist and the card's width;
  + standings paging: 54 entries give 3 pages and the right page lines;
  + the columns layout gives 3×20, and 61 entries give 2 pages of up to 60;
  + disqualified rows and ties;
  + parts missing for one entry show "—";
* **view tests**, in pt-BR text;
* **manifest–data agreement**, as the tower has;
* **animation timing from tokens**, as race-clock has.

**Screenshots (Playwright):** the preview at 1920×1080 on the grey and the black background,
matching the design pages:

* the lower third with and without role;
* the team card: all eight combinations;
* standings with parts, page 1;
* standings in columns;
* standings with a disqualified team.

Baselines are taken on Linux; your WSL is Linux. Commit them in their own commit so the
review can look at them.

**Control:**

* the Cadastros team form's plate checkbox and preview;
* CSV import and export round-trip with the new column.

**E2E** (apps/control, on the real server):

1. Import the simulator's teams, upload a logo for car 7 and tick its plate.
2. Create a team-card item for car 7 from Cadastros, take it, and the card shows the name, the
   city line and the logo on its plate.
3. Create a person and a lower-third item from them; take it.
4. Create a standings item bound live to the simulator's standings and take it. Page 1 shows 20
   rows with the parts' columns. The page turn itself is proven by a component test with fake
   time, not here (no fixed waits, docs/ci.md).

## Commit order

1. The brief, as `docs/briefs/BAJAOVRLAY-24.md`.
2. The kit, and the migration of the three packages (tests first).
3. The standings shape, paths, flex fields, simulator, and recordings compatibility.
4. The team plate field: schema, Cadastros, CSV.
5. `lower-third`.
6. `team-card`.
7. `standings`.
8. Screenshot baselines (their own commit).
9. E2E.
10. Docs and decisions.

## Done when

* `pnpm verify` passes, and is reported with each round.
* On João's machine:
  + the three previews play in and out as `motion.md` says;
  + the walk in the E2E section works by hand from the control page;
  + the screenshots look like the design pages side by side.
* The PR description has:
  + the walk steps;
  + the side-by-side screenshot list (design page and baseline);
  + "Decisions taken";
  + anything left out and why.

Report and stop; João marks it ready after gate 2.
