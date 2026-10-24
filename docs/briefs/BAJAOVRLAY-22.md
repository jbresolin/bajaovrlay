# Agent brief — BAJAOVRLAY-22 (+21): the Ardósia theme, the race clock in Ardósia, and the positions tower

**Branch:** `BAJAOVRLAY-22-ardosia-theme-and-tower` off an up-to-date `main` (after the design PR #19 is merged). **One PR** covering two Plane items: BAJAOVRLAY-22 (theme tokens and renderer injection) and BAJAOVRLAY-21 (positions tower). Left open for João's review. Do not merge. Work through the commit order at the end, tests first at every step, and keep going without asking. Where this brief leaves a choice open, take the plainer option, write it in `docs/decisions.md` and under "Decisions taken" in the PR, and move on.

**Read first:**

- `CLAUDE.md`, all of it.
- `docs/00-concept.md`: §3.2 and §3.3 (theme values arrive as CSS custom properties), §4 (theme, layers, instances), §6, §9.
- `docs/decisions.md`, from PR #19 on.
- **The design record, which is the visual spec**, all of `docs/design/directions/ardosia/`:
  - `README.md`, `tokens.css` and `motion.md`;
  - the generated pages `race-clock.html`, `positions-compact.html` and `positions-detailed.html`, plus `sheet-flags.html`, `sheet-status.html` and `sheet-columns.html`;
  - `combo-tower.html` and the screenshots.
- `docs/design/fonts/`.
- The race-clock package (`packages/graphics/race-clock/`: manifest, component, preview, screenshot test) and `packages/graphics/README.md`.
- `packages/shared/src/dataShapes/` (positions shape, samples) and the bindable paths (a whole list binds as `positionsEntries`).
- The renderer (`apps/renderer/src/`) and the server's layer seed.

## Why

The design is chosen (Ardósia, adjusted by João at the gate on PR #19). This PR turns it into the product:

1. **The theme:** one place where every visual value lives, injected by the renderer into every graphic.
2. **The race clock restyled to Ardósia.**
3. **The first data graphic, the positions tower:** compact and detailed, fed live by a binding to a source (the simulator today, the Baja app later).

After this PR, João can put a clock and a 20-car tower on air over the simulated race and see them move as in `motion-demo.html`.

## Deliverable

### A. The theme package (BAJAOVRLAY-22)

New package `packages/theme/` (README, `ardosia/tokens.css`, `fonts/`). Product code never imports from `docs/`.

- **Tokens:** copy `docs/design/directions/ardosia/tokens.css` into `packages/theme/ardosia/tokens.css`. From here on, the package copy is the source of truth and the docs copy is the design record; say so in both READMEs.
  - Keep the token names. Remove only tokens that served the design pages alone (generator widths, demo-only values), and list what was removed in the PR.
  - Add the tokens the product needs that the pages hard-coded, if any. Name each one in the same style.
- **Fonts:** Bebas Neue (`woff2` plus its OFL `LICENSE`), moved from `docs/design/fonts/` into `packages/theme/fonts/`, with an `@font-face` file. It is self-hosted and never loaded from a CDN. Check whether Barlow is still used anywhere in the chosen design: João's gate set one face (Bebas Neue) for everything. If Barlow is unused, don't ship it.
- **The server serves the theme** at `/theme/` (tokens, font CSS, font files), like the graphics, with long cache headers on fonts and a no-cache header on `tokens.css`.
- **The renderer loads the theme** once, before any graphic: the tokens on `:root` of the renderer page, and the font CSS.
  - Graphics read the tokens through CSS custom properties (which pierce shadow DOM). No graphic hard-codes a colour, size, font or timing that a token covers.
  - Add a test that greps the graphics' sources for hex colours or `px` font sizes outside an allowlist and fails. Plain grep, like the no-graphic-specific-code guard.
- **Motion tokens in JS:** the GSAP timings read `--motion-*` and `--ease-*` from computed style through one small helper in the renderer or shared graphics code (for example `readMotionTokens()`), so motion follows the theme too. Map the cubic-bezier easings to GSAP with GSAP's CustomEase, or with GSAP's built-in eases closest to each curve. Record which, and why.
- **No theme switching** in this PR. Concept §4's `theme` slice (one active theme, chosen by an operator) is left for later. Ardósia is the only theme, loaded statically. Decisions line.

### B. The race clock in Ardósia

Restyle `packages/graphics/race-clock/` to `race-clock.html` and `sheet-flags.html`:

- **The layout:** a head with the logo (the white logo from `docs/brand/`, copied into the graphic's assets or into the theme package; record which) and the session title, the time, the caption line, and the optional flag band (40 px).
- **Flag band:** a new optional boolean field "Mostrar faixa da bandeira" (default true). With it off, the card is 152 px tall instead of 192. Turning it on or off on air animates per `motion.md` (300 ms, the card growing or shrinking).
- **Flag states:** the six states with their token colours. The checkered band carries no word, only the pattern. A flag change crossfades in 300 ms, and nothing moves.
- **Leader's laps:** a new optional field "Voltas do líder", an integer. It binds to `session.lapsCompletedByLeader` and is shown on the caption line as in the design. Absent, it is not shown.
- **Unchanged:** the clock's behaviour, `carryClockForward`, the field keys, the update rule and every existing test. Only the look changes, plus the two optional fields.
- **Screenshot tests:** updated, one per flag state and one without the band. Put the design screenshot beside each new screenshot in the PR description so João can compare them.

### C. The positions tower (BAJAOVRLAY-21)

New OGraf package `packages/graphics/positions-tower/` (manifest, Lit component, GSAP, `preview.html` with the positions sample, Playwright tests, README).

**Layer.** A new layer **"Torre"** (`tower`). It sits under the clock and over the lower third, and on the same right-hand column as the clock, so the two stack as in `combo-tower`. Seed it the way the other layers are seeded, and give it a z-index between the clock's and the lower third's. The manifest's `v_baja.defaultLayerId` is `tower`.

**Fields** (all titles and descriptions in pt-BR):

- `entries` (required): an array of positions entries, the canonical shape's fields this graphic uses (`position`, `carNumber`, `teamName`, `schoolName`, `laps`, `lastLapMs`, `bestLapMs`, `gapToLeaderMs`, `gapToLeaderLaps`, `intervalMs`, `pitStops`, `fuelStops`, `status`). The item editor binds it to a source's `positions.entries` (`positionsEntries`), live. Write the item schema so a canonical entry passes as is.
- `layout`: `compact` or `detailed` (enum; labels "Compacta" and "Detalhada"). Default compact.
- The detailed layout's optional columns, booleans with the defaults the design sets: `showGap`, `showInterval`, `showLastLap`, `showBestLap`, `showPitStops` ("Paradas"), `showFuelStops` ("Abastecimentos"), `showStatus`. The width follows the columns shown, as in `sheet-columns.html`.
- `title`: optional; the head pill's caption if the design has one, otherwise left out.
- `paging`: `cycle` (pages of 20, each held for `--motion-strip-hold`) or `firstPageOnly` (the top 20, held). Labels "Alternar páginas" and "Só os 20 primeiros". Default `cycle`.

**Behaviour** (`motion.md` is the spec):

- **In and out:** the head pill first, then the rows cascade (30 ms stagger, 400 ms rise). Out together in 250 ms.
- **Paging:** the rows on air leave together and the next page's rows cascade in. The head stays. The page timer is local to the graphic. That's a presentation detail, not state, but it means the program page and the preview monitor page independently; write it in the README and in decisions.
- **Updates** (`updateAction` with new `entries`, about every 2 s from the live binding):
  - Position changes slide the pills by FLIP in 400 ms, with the ▲ and green cell, or the ▼ and blue cell, held 2 s. A new leader takes slot 1's green chip.
  - Laps, times and status change in place with no motion.
  - Cars crossing a page boundary rise in or lift out.
  - Several changes in one update slide together.
- **Status icons:** in the pit, quebrado (the wrench) and retired (the icon, plus the row at `--status-retired-opacity`), as in `sheet-status.html`. They are inline SVG in the package, with an accessible name.
- **Text:** long team names are cut with an ellipsis inside their column, never wrapping and never changing the row height. Gaps and lap times are formatted by the graphic to the tenth, truncated: "+12,3 s", "+2 voltas", "4:38,2". Use the same rule as `formatGapAsText` and `formatLapTimeAsText`; import them if the graphics bundle can use shared code without pulling the server in, otherwise reimplement them with the same tests. Record which.
- **Missing values:** an entry missing an optional value shows the column's empty mark ("—") where the design shows one, never "0".
- **Performance in OBS:** keep one DOM node per visible row, reused across updates, keyed by `carNumber`. Never rebuild the list on an update. No layout reads inside the animation loop apart from FLIP's one measure.
  - Add a Playwright test that applies 60 updates of a 60-car list at 2 s simulated intervals (fake timers or fast-forwarded GSAP) and checks the node count stays constant.
  - Measure one update's main-thread time and report it in the PR (the PR #18 freeze is the reason).

**Fuel stops in the canonical shape.** The design has an "ABAST." column, and the positions shape has no field for it yet.

- Add an optional `fuelStops` (integer ≥ 0) to positions entries, with its bindable path and pt-BR label, and as a mappable field of the flex source.
- The simulator fills it: in its model every pit stop is a refuel, so `fuelStops` equals `pitStops`. Comment that next to the code, because the real scoring app may count them differently.
- Decisions line.

### D. Control page

- **Nothing graphic-specific.** The generated form already handles booleans and enums, and the array field binds to a source. Check that the item editor shows "Fonte" for `entries` with the positions paths, and that the layout and column switches render.
- **A preset to save typing**, if cheap: when a graphic's manifest declares `v_baja.suggestedBinding` for a field (for example `{ shapeKey: 'positions', path: 'positions.entries', isLive: true }`), the editor pre-fills that binding for a new item when exactly one enabled source produces that shape. It's a manifest convention, so it's not graphic-specific code. Document it in `packages/graphics/README.md`. If this grows past a small change, leave it out and say so.

### E. Docs

- `docs/00-concept.md`:
  - §3.3: the theme package and the injection as built;
  - §4: theme not switchable yet, the `tower` layer, and `fuelStops`;
  - §9: race clock and positions tower as built.
- READMEs for `packages/theme/` and `packages/graphics/positions-tower/`, and the race clock README updated.
- Decisions lines for every choice this brief leaves open.

## Tests (write first, in this order of commits)

- **Theme.**
  - The server serves `/theme/ardosia/tokens.css` and the fonts with the stated headers.
  - The renderer page has the tokens on `:root` before the first graphic loads.
  - The no-hard-coded-values guard over the graphics' sources.
  - `readMotionTokens()` reads durations and easings from a test page.
- **Race clock.**
  - Manifest: the two new optional fields pass the OGraf schema.
  - Screenshots: six flag states, and the clock without the band.
  - The band toggled on air animates and keeps the instance (same DOM node).
  - Leader's laps shown and absent.
  - All existing behaviour tests still pass unchanged.
- **Positions tower, component (Playwright against the preview page and the fake host).**
  - Compact and detailed screenshots from the sample, in compact, detailed with all columns, and detailed with times off.
  - Status icons for each status.
  - The long-name ellipsis.
  - Paging: `cycle` turns pages, and `firstPageOnly` holds page 1.
  - A swap of two cars: FLIP animation, cues held 2 s and then cleared.
  - A new leader.
  - A car crossing the page boundary.
  - The node count stays constant over 60 updates.
  - Missing optional values show "—".
  - Gap and lap text to the tenth, truncated.
- **Shape and simulator.**
  - `fuelStops` validates and is optional.
  - The simulator's `fuelStops` equals `pitStops`.
  - The bindable path and the flex mappable field are listed.
- **Layer seed.** `tower` is present, with its z-index between clock and lower third, on a fresh database and on an existing one.
- **E2E.**
  1. Enable the simulator at speed 60 and restart the race.
  2. Create a tower item with `entries` bound live to the simulator's positions, take it, and the program stand-in shows 20 rows.
  3. Within a few polls, at least one row changes place (wait on the state API for a position change in the snapshot first, then check the DOM).
  4. Switch the item to `detailed` with "Atualizar no ar": same instance, more columns.
  5. Take the clock too: both stack without overlapping (bounding boxes).

## Commit order

1. The brief in `docs/briefs/BAJAOVRLAY-22.md` (documentation only).
2. The theme package, serving and injection: tests, then code.
3. The race clock in Ardósia: tests, then code.
4. `fuelStops` in the shape and the simulator, and the `tower` layer seed: tests, then code.
5. The positions tower: tests, then code.
6. Control check, and the suggested-binding preset if small: tests, then code.
7. E2E.
8. Docs and decisions.

Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, every `pnpm test:e2e` and `git diff --check` locally before opening the PR. Report the GitHub CI job's duration in the PR description; CI time is tracked in BAJAOVRLAY-42, so don't add slow waits.

## Done when

Root CI green; lint with no warnings. On João's machine, after `pnpm build`, a restart and the pages reloading themselves:

- the race clock looks like `race-clock.html`;
- a tower item bound to the simulator goes on air in the right-hand column under the clock, with 20 cars that page and swap places as in `motion-demo.html`, plus status icons for cars in the pit, broken down or retired;
- switching it to detailed shows the extra columns;
- refreshing OBS rebuilds the same picture.

The PR description has the walk steps for João, the design-vs-product screenshot pairs, "Decisions taken", and anything left out and why. Report and stop; João merges after gate 2.
