# docs/design — the on-air look, before it is built

Design work only: nothing here runs in the product. This folder holds the visual direction
chosen for BajaOvrLay's on-air graphics (BAJAOVRLAY-22: ardosia, chosen by João at the gate
on PR #19 out of three), the mock-up pages behind it, its screenshots, and the small tools
that make the screenshots and check the pages. Pass 2 (BAJAOVRLAY-43) extended ardosia to
the rest of the §9 catalogue. Start at `directions/README.md`, which keeps the comparison
that led to the choice, then `directions/ardosia/README.md` and its `catalogue.md`.

```
docs/design/
  README.md               this file: what lives here and the page contract
  sample-data.json        the real sample race, every number already written as on-air text
  fonts/                  a pointer to the product's self-hosted face (packages/theme/fonts)
  tools/                  buildSampleData, screenshot, checkLayout, contrastRatio, and what a
                          slate direction is built from: slateTemplates.mjs (the on-air
                          graphics' markup), slateSheets.mjs (the reference sheets),
                          slatePages.mjs (assembles the pages), slateVocabulary.mjs (flag
                          words, status icons), slate-base.css (structure), slateMotionDemo.js
  directions/
    README.md             the comparison that led to the choice, kept as the record
    ardosia/              the chosen direction (see "What a direction holds")
```

Pass 2 added to `tools/` the catalogue's builders, one file per kind of graphic:
`slateNotices.mjs` (the fastest lap and the penalty notice), `slateCards.mjs` (team card,
battle card, QR card, countdown card, message ticker, corner sponsor roll),
`slateBoards.mjs` (the full-screen boards), `slateSteps.mjs` (the bracket and the podium,
which reveal in steps), `slateCatalogueSheets.mjs` (two more reference sheets) and
`slateCataloguePages.mjs` (assembles those pages; `slatePages.mjs` merges them with pass 1);
their structure in `slate-cards.css` and `slate-boards.css`.

## The sample data is real

`sample_data/` holds what João handed over from the 30ª Competição Baja SAE Brasil, kept
exactly as delivered (Prettier skips it): `results/teams.csv` (the teams, short names, schools,
cities), `results/overall.csv` (the overall scores by part), `enduro_passes.xlsx` (every lap
crossing of the enduro), `penalizacoes.csv` (the enduro's penalties, `onde` being the track
sector), `results/super_prime.md` (the Super Prime bracket, round by round), `team_logos/`
and `sponsors/` (`<name>_<level>`). `buildSampleData.mjs` reads them into `sample-data.json`
through one reader per source, with no dependency:

- `readCsvFile.mjs` and `readXlsxSheet.mjs` (the xlsx's zip read with Node's zlib);
- `sampleResults.mjs` (teams, overall standings, penalties), `sampleEnduroPasses.mjs` (the
  passes), `sampleSuperPrime.mjs` (the bracket, each car placed in the slot it came from; a
  result that does not fit the tree stops the build), `sampleBattle.mjs` (the closest real
  fight of the race, for the battle card);
- `enduroTiming.js`, the enduro's rules (the order, gaps, intervals, the clock, the fastest
  laps at any moment), a classic script shared by Node and the enduro timeline page;
- `sampleFixtures.mjs`, what the files do not hold: the session's 4 h length and the moment
  the static pages show (start + 3 h), the yellow-flag sample, the schedule, the messages, the
  countdown and the QR words, all invented and named as such there;
- `prepareLogos.mjs` (run by hand when the logos change: `node docs/design/tools/prepareLogos.mjs`)
  trims each logo, decides whether it sits on the dark panel or needs a light plate (a dark
  or opaque mark gets the plate) and writes 480 px WebP copies and `logos.json` into
  `sample_data/logos/`; a wrong guess is corrected in its `surfaceOverrides`.

## Sharing for review

`node docs/design/tools/packageReview.mjs` copies every ardosia page and exactly the files it
loads into `.scratch/review/` (keeping the `docs/` layout), with a review page, `index.html`,
built from `tools/reviewPage.html`: the pages listed by group and the chosen one on a scaled
1920×1080 stage. That folder is published as a private Claude artifact (BAJAOVRLAY-43,
https://claude.ai/artifact/TaBSzQ73oP3LsAtmTaWXbM), republished to the same link after each
round. A static page missing from the script's groups stops the package.

## The timelines

Two pages replay the real results so the graphics can be judged at any moment, not just the
static pages' one: `motion-enduro-linha-do-tempo.html` (the race clock, the compact or
detailed tower and the fastest-lap notice, with a slider over the race, steps of a pass or a
minute, and Play at 1×, 10× or 60×) and `motion-super-prime-linha-do-tempo.html` (the bracket
decided match by match, from the draw to the final). They are built by `slateTimelineDemos.mjs`
and run by `timelineEnduro.js` and `timelineSuperPrime.js` on the same motion core as the
demos.

The catalogue's motion demos are built from `slateMotionDemos.mjs` (one entry per graphic
and per combination of its optional parts) and `slateMotionPages.mjs` (the pages and their
index, `motion-catalogo.html`), styled by `slate-demo.css` (the controls bar), and run in the
browser by `motionDemoCore.js` (the motion tokens read as the product's `packages/theme`
reads them, the moves, the buttons) with `motionDemoCards.js`, `motionDemoBoards.js` or `motionDemoSponsors.js` (the sponsor rolls, each page held by its level). They
load GSAP and CustomEase from `vendor/gsap/`, a byte-for-byte copy of the product's GSAP
3.15.0. It is a copy, not a path into `node_modules`, because pnpm's symlinks cannot be
followed by a Windows browser reading the WSL disk (`vendor/gsap/README.md`). Nothing comes
from the network.

## What a direction holds

| File                                                                                                             | What it is                                                                                                                                                                                                                                                                                                                          |
| ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `README.md`                                                                                                      | The idea in two sentences, legibility at 720p on a phone, safe areas, contrast, how many tower rows and why, the catalogue's pages and the tokens pass 2 added.                                                                                                                                                                     |
| `catalogue.md`                                                                                                   | Pass 2: the layer plan, what can share the screen, and each graphic's data needs (shape and fields read, fields that do not exist yet, live or typed). The build briefs are written from it.                                                                                                                                        |
| `tokens.css`                                                                                                     | The direction's CSS custom properties: colour roles (panel base, accent, text, muted, the flag set, the status-icon set), type scale, spacing, radius, shadow, animation timings.                                                                                                                                                   |
| `styles.css`                                                                                                     | Imports the structure the directions share (`tools/slate-base.css`, `slate-cards.css`, `slate-boards.css`, written against the tokens) and adds the direction's own few rules.                                                                                                                                                      |
| `generatePages.mjs`                                                                                              | Writes the static pages from `sample-data.json` through the shared page assembly (`tools/slatePages.mjs`), so no row is typed by hand; `node docs/design/directions/<direction>/generatePages.mjs` from the repo root regenerates them. The pages are committed as the generator writes them.                                       |
| `race-clock.html`                                                                                                | Session title, time remaining, flag state, laps of the leader.                                                                                                                                                                                                                                                                      |
| `race-clock-sem-bandeira.html`                                                                                   | The same clock without its flag band, which is optional (a session with no flag state).                                                                                                                                                                                                                                             |
| `sheet-flags.html`                                                                                               | A reference sheet, not an on-air composition: the clock in all six flag states, side by side.                                                                                                                                                                                                                                       |
| `sheet-status.html`                                                                                              | A reference sheet: the three status icons at size, and the last three cars of the sample shown in the pit, broken down and retired (the export has no car status), in the compact and the detailed row styles.                                                                                                                      |
| `sheet-columns.html`                                                                                             | A reference sheet: the detailed tower with every column, with the default set, and with the optional columns off (an event without lap timing).                                                                                                                                                                                     |
| `positions-compact.html`                                                                                         | The everyday tower: position, car number, team, laps, status icons; at the maximum rows the layout fits (at least 20).                                                                                                                                                                                                              |
| `positions-detailed.html`                                                                                        | The occasional tower: the compact columns plus gap, interval, last lap, best lap, pit entries (PARADAS), refuels (ABAST., off until the shapes carry a refuel count) and the status icons; every column after VOLTAS is optional and the tower's width follows the columns shown.                                                   |
| `lower-strip.html`                                                                                               | The bottom standings strip with the race clock built in.                                                                                                                                                                                                                                                                            |
| `lower-third.html`                                                                                               | A person: name, role, optional team.                                                                                                                                                                                                                                                                                                |
| `sponsor-bug.html`                                                                                               | The corner bug with the event logo.                                                                                                                                                                                                                                                                                                 |
| `combo-tower.html`                                                                                               | The usual on-air combination: race clock, compact tower and sponsor bug together.                                                                                                                                                                                                                                                   |
| `combo-strip.html`                                                                                               | Lower strip and lower third together.                                                                                                                                                                                                                                                                                               |
| `team-card*.html`, `battle-card.html`, `qr-card.html`                                                            | Pass 2, the lower-third layer: the team card with and without photo and logo, the battle card (two cars and the gap with its trend), the QR card.                                                                                                                                                                                   |
| `fastest-lap.html`, `penalty-notice.html`                                                                        | Pass 2, the notice slot under the bug: the fastest lap, a penalty or incident from race direction.                                                                                                                                                                                                                                  |
| `standings*.html`, `bracket-passo-*.html`, `podium-passo-*.html`                                                 | Pass 2, full screen: the overall standings (20 rows a page) and one event's (the whole field in three columns); the bracket and the podium, one page per step.                                                                                                                                                                      |
| `sessions-board.html`, `intermission-board.html`, `countdown*.html`, `sponsor-roll*.html`, `message-ticker.html` | Pass 2: the day's schedule, the break board, the countdown as a card and as a waiting screen, the sponsor roll full screen and in the corner, the message ticker on the strip's bar.                                                                                                                                                |
| `combo-fastest-lap.html`, `combo-battle.html`, `combo-ticker.html`                                               | Pass 2, the combinations the layer plan names: clock + tower + bug + fastest lap; clock + bug + battle card; lower third + message ticker.                                                                                                                                                                                          |
| `sheet-battle.html`, `sheet-notices.html`                                                                        | Pass 2 reference sheets: the battle card's three trends; every notice beside the clock with a red flag.                                                                                                                                                                                                                             |
| `motion.md`                                                                                                      | In and out animations, the tower's position-change animation, the strip's movement, with durations; pass 2's in, out and steps.                                                                                                                                                                                                     |
| `motion-demo.html`                                                                                               | Optional: an animated demo of the above (CSS or the Web Animations API, nothing loaded from the network). The screenshot tool skips it. It covers pass 1.                                                                                                                                                                           |
| `motion-catalogo.html`, `motion-<graphic>-<parts>.html`                                                          | Pass 2: the catalogue's motion demos, one page per graphic and per combination of its optional parts, with buttons (Entrar, Sair, Próximo, Atualizar, Novo evento) and GSAP from `docs/design/vendor/gsap`; every timing from `tokens.css`; and the two timelines (see "The timelines"). The screenshot and layout tools skip them. |
| `screenshots/`                                                                                                   | `<page>.<background>.jpg` for every page over footage frame 1 (`docs/brand/frames/1.jpg`), over mid-grey and over near-black; reference sheets over grey and black only. `--every-frame` shoots every frame.                                                                                                                        |

## The page contract

Every mock-up page is plain HTML and CSS, opens from the file system with no server and
loads nothing from the network.

- The page is the 1920x1080 stage: `html, body { margin: 0; width: 1920px; height: 1080px; overflow: hidden }`.
- The body paints the footage behind the graphics from one custom property, which the
  screenshot tool overrides: `body { background: var(--stage-background, url('../../../brand/frames/1.jpg')) center / cover no-repeat }`.
- Fonts come from `<link rel="stylesheet" href="../../fonts/fonts.css">` (self-hosted, OFL; see `fonts/README.md`).
  Times, gaps and laps always carry `font-variant-numeric: tabular-nums`.
- The generator formats its pages with the repo's Prettier, so `pnpm lint` (`prettier --check .`)
  passes on the committed pages and a regenerated page is byte for byte the committed one.
- Every on-air graphic's root element carries `data-graphic="<name>"` (race-clock,
  positions-compact, positions-detailed, lower-strip, lower-third, sponsor-bug, and in pass 2
  team-card, battle-card, standings, standings-por-prova, bracket, podium, fastest-lap,
  penalty-notice, countdown, countdown-board, sessions-board, intermission-board,
  sponsor-roll, sponsor-roll-corner, qr-card, message-ticker), and every car row in a tower,
  strip, board or bracket carries `data-row`. `tools/checkLayout.mjs` reads these.
- Everything on air stays inside the 90% title-safe area: x from 96 to 1824, y from 54 to 1026.
- Text is pt-BR and every number is copied from `sample-data.json`, never typed by hand.
- Status icons are inline SVG with shape and position carrying the meaning (no icon fonts).

## Shared constraints every direction honours

- **Brand colours** (`docs/brand/logo-baja.svg`): green `#009739`, navy `#003B71`, blue `#386DB4`,
  yellow `#F4C42A`, grey `#383838`. White text on brand green is 3.83:1, so green fields may
  only carry large text (24px and up, or bold 19px and up).
- **The starting point** is the scoreboard the stream uses today
  (placarbaja.juansalles.com.br: slate pills, a car chip, a colour per column); the three
  directions compared at the gate kept that style and differed in palette, type, chip
  treatment and density.
- **Flag colours are a separate semantic set** (pre-start, green, yellow, red, checkered,
  finished), declared as their own tokens, never the brand values. Brand yellow never
  appears where it could be read as a yellow flag: never as a field, never near the flag slot
  (ardosia uses it as the position column's text, as the scoreboard does, and nowhere else).
  The flag slot always shows the flag's word ("VERDE", "AMARELA"...) beside its colour.
  The flag palette: pre `#5B6472`, green `#15803D` (white word, 5.02:1), yellow `#FFD600`
  (dark word), red `#DC2626` (white word, 4.83:1), checkered `#111111`/`#F5F5F5` with no word
  (the pattern says it; João's gate), finished `#1F2937`. The clock's flag band is optional.
- **What OBS can and cannot composite.** The program renderer is a transparent browser source
  that OBS lays over the video (docs/00-concept.md §6), so a page can tint the footage behind
  a panel but never blur it: `backdrop-filter` only sees the page's own transparent pixels.
  Every translucent panel in these directions is therefore a flat tint, checked for contrast
  over bright sky as the worst case.
- **Car status** (in the pit, broken down, retired) shows as small icons beside the car, in a
  fixed column, each a different shape: a "P" in a square for the pit, a wrench for a broken
  car ("quebrado", João's word for a stopped car), a circle with a slash for retired. Colour
  may help but never carries the meaning alone. A retired car's row is also dimmed.
- **Type** is self-hosted SIL OFL. Numbers use tabular figures. Urzeit (the event's display
  face) is not depended on; a direction may note where it could appear later as an accent.
- **Legibility at 720p on a phone**: the compact tower's numbers and names are at least 26px
  at 1080p and its rows at least 32px; the lower strip's text at least 28px; nothing on air
  below 20px.
- **Contrast**: WCAG AA for text on panels (4.5:1, or 3:1 for large text), checked with
  `tools/contrastRatio.mjs`, for translucent panels over the worst backdrop (bright sky).

## Tools (run from the repo root; Playwright comes from the repo's node_modules)

```
node docs/design/tools/buildSampleData.mjs          rebuild sample-data.json from packages/shared samples
node docs/design/tools/screenshot.mjs --all          every direction, every page, every background
node docs/design/tools/screenshot.mjs ardosia        one direction (add --png for lossless footage shots)
node docs/design/tools/checkLayout.mjs ardosia       title-safe boxes, row counts, smallest text per graphic
node docs/design/directions/ardosia/generatePages.mjs   regenerate the pages (formatted with Prettier)
node docs/design/tools/contrastRatio.mjs "#ffffff" "#003b71" [panelAlpha] [backdrop]
```

Screenshots are JPEG, each near 300 KB (the tool steps the quality down from 85 until the
file fits), because a 1920x1080 PNG of a photo is 2 to 3 MB and there are hundreds; the
footage frames in `docs/brand/frames/` are JPEG for the same reason. `--png` makes every shot PNG.
