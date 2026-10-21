# docs/design — the on-air look, before it is built

Design work only: nothing here runs in the product. This folder holds the visual direction
chosen for BajaOvrLay's on-air graphics (BAJAOVRLAY-22: ardosia, chosen by João at the gate
on PR #19 out of three), the mock-up pages behind it, its screenshots, and the small tools
that make the screenshots and check the pages. Start at `directions/README.md`, which keeps
the comparison that led to the choice, then `directions/ardosia/README.md`.

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

## What a direction holds

| File                           | What it is                                                                                                                                                                                                                                                                                    |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `README.md`                    | The idea in two sentences, legibility at 720p on a phone, safe areas, contrast, how many tower rows and why, how the system extends to the rest of the §9 catalogue.                                                                                                                          |
| `tokens.css`                   | The direction's CSS custom properties: colour roles (panel base, accent, text, muted, the flag set, the status-icon set), type scale, spacing, radius, shadow, animation timings.                                                                                                             |
| `styles.css`                   | Imports the structure the three directions share (`tools/slate-base.css`, written against the tokens) and adds the direction's own few rules.                                                                                                                                                 |
| `generatePages.mjs`            | Writes the static pages from `sample-data.json` through the shared page assembly (`tools/slatePages.mjs`), so no row is typed by hand; `node docs/design/directions/<direction>/generatePages.mjs` from the repo root regenerates them. The pages are committed as the generator writes them. |
| `race-clock.html`              | Session title, time remaining, flag state, laps of the leader.                                                                                                                                                                                                                                |
| `race-clock-sem-bandeira.html` | The same clock without its flag band, which is optional (a session with no flag state).                                                                                                                                                                                                       |
| `sheet-flags.html`             | A reference sheet, not an on-air composition: the clock in all six flag states, side by side.                                                                                                                                                                                                 |
| `sheet-status.html`            | A reference sheet: the three status icons at size, and real rows of the sample for car 69 (in the pit), car 65 (broken down) and car 96 (retired), in the compact and the detailed row styles.                                                                                                |
| `sheet-columns.html`           | A reference sheet: the detailed tower with every column, with the default set, and with the optional columns off (an event without lap timing).                                                                                                                                               |
| `positions-compact.html`       | The everyday tower: position, car number, team, laps, status icons; at the maximum rows the layout fits (at least 20).                                                                                                                                                                        |
| `positions-detailed.html`      | The occasional tower: the compact columns plus gap, interval, last lap, best lap, pit entries (PARADAS), refuels (ABAST., off until the shapes carry a refuel count) and the status icons; every column after VOLTAS is optional and the tower's width follows the columns shown.             |
| `lower-strip.html`             | The bottom standings strip with the race clock built in.                                                                                                                                                                                                                                      |
| `lower-third.html`             | A person: name, role, optional team.                                                                                                                                                                                                                                                          |
| `sponsor-bug.html`             | The corner bug with the event logo.                                                                                                                                                                                                                                                           |
| `combo-tower.html`             | The usual on-air combination: race clock, compact tower and sponsor bug together.                                                                                                                                                                                                             |
| `combo-strip.html`             | Lower strip and lower third together.                                                                                                                                                                                                                                                         |
| `motion.md`                    | In and out animations, the tower's position-change animation, the strip's movement, with durations.                                                                                                                                                                                           |
| `motion-demo.html`             | Optional: an animated demo of the above (CSS or the Web Animations API, nothing loaded from the network). The screenshot tool skips it.                                                                                                                                                       |
| `screenshots/`                 | `<page>.<background>.jpg` for every page over every frame in `docs/brand/frames/`, over mid-grey and over near-black; reference sheets over grey and black only.                                                                                                                              |

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
  positions-compact, positions-detailed, lower-strip, lower-third, sponsor-bug), and every
  car row in a tower or strip carries `data-row`. `tools/checkLayout.mjs` reads these.
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
file fits), because a 1920x1080 PNG of a photo is 2 to 3 MB and there are dozens; the footage
frames in `docs/brand/frames/` are JPEG for the same reason. `--png` makes every shot PNG.
