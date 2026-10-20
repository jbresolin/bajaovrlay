# docs/design — the on-air look, before it is built

Design work only: nothing here runs in the product. This folder holds the visual directions
proposed for BajaOvrLay's on-air graphics (BAJAOVRLAY-22), the mock-up pages behind them,
the screenshots João chooses from, and the small tools that make the screenshots and check
the pages. Start at `directions/README.md`, which compares the directions in one table.

```
docs/design/
  README.md               this file: what lives here and the page contract
  sample-data.json        the real sample race, every number already written as on-air text
  fonts/                  self-hosted OFL fonts and fonts.css (see fonts/README.md)
  tools/                  buildSampleData, screenshot, checkLayout, contrastRatio
  directions/
    README.md             the comparison table
    <direction>/          one folder per direction (see "What a direction holds")
```

## What a direction holds

| File | What it is |
| --- | --- |
| `README.md` | The idea in two sentences, legibility at 720p on a phone, safe areas, contrast, how many tower rows and why, how the system extends to the rest of the §9 catalogue. |
| `tokens.css` | The direction's CSS custom properties: colour roles (panel base, accent, text, muted, the flag set, the status-icon set), type scale, spacing, radius, shadow, animation timings. |
| `styles.css` | The rules every page of the direction shares, written against the tokens. |
| `race-clock.html` | Session title, time remaining, flag state, laps of the leader. |
| `sheet-flags.html` | A reference sheet, not an on-air composition: the clock in all six flag states, side by side. |
| `sheet-status.html` | A reference sheet: the three status icons at size, and real rows of the sample for car 69 (in the pit), car 65 (stopped) and car 96 (retired), in the compact and the detailed row styles. |
| `positions-compact.html` | The everyday tower: position, car number, team, laps, status icons; at the maximum rows the layout fits (at least 20). |
| `positions-detailed.html` | The occasional tower: the compact columns plus gap, interval, last lap, best lap, fuel stops ("Abast."), status icons. |
| `lower-strip.html` | The bottom standings strip with the race clock built in. |
| `lower-third.html` | A person: name, role, optional team. |
| `sponsor-bug.html` | The corner bug with the event logo. |
| `combo-tower.html` | The usual on-air combination: race clock, compact tower and sponsor bug together. |
| `combo-strip.html` | Lower strip and lower third together. |
| `motion.md` | In and out animations, the tower's position-change animation, the strip's movement, with durations. |
| `motion-demo.html` | Optional: an animated demo of the above (CSS or the Web Animations API, nothing loaded from the network). The screenshot tool skips it. |
| `screenshots/` | `<page>.<background>.jpg|png` for every page over every frame in `docs/brand/frames/`, over mid-grey and over near-black; reference sheets over grey and black only. |

## The page contract

Every mock-up page is plain HTML and CSS, opens from the file system with no server and
loads nothing from the network.

- The page is the 1920x1080 stage: `html, body { margin: 0; width: 1920px; height: 1080px; overflow: hidden }`.
- The body paints the footage behind the graphics from one custom property, which the
  screenshot tool overrides: `body { background: var(--stage-background, url('../../../brand/frames/1.png')) center / cover no-repeat }`.
- Fonts come from `<link rel="stylesheet" href="../../fonts/fonts.css">` (self-hosted, OFL; see `fonts/README.md`).
  Times, gaps and laps always carry `font-variant-numeric: tabular-nums`.
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
- **Flag colours are a separate semantic set** (pre-start, green, yellow, red, checkered,
  finished), declared as their own tokens, never the brand values. Brand yellow never
  appears where it could be read as a yellow flag: never as a field, never near the flag slot.
  The flag slot always shows the flag's word ("VERDE", "AMARELA"...) beside its colour.
  The three directions share one flag palette, so the comparison is about the look and not
  about flag colours: pre `#5B6472`, green `#15803D` (white word, 5.02:1), yellow `#FFD600`
  (dark word), red `#DC2626` (white word, 4.83:1), checkered `#111111`/`#F5F5F5` with the word
  on a dark plate, finished `#1F2937`.
- **What OBS can and cannot composite.** The program renderer is a transparent browser source
  that OBS lays over the video (docs/00-concept.md §6), so a page can tint the footage behind
  a panel but never blur it: `backdrop-filter` only sees the page's own transparent pixels.
  Every translucent panel in these directions is therefore a flat tint, checked for contrast
  over bright sky as the worst case.
- **Car status** (in the pit, stopped or broken down, retired) shows as small icons beside
  the car, in a fixed column, each a different shape: a "P" in a square for the pit, a
  triangle for stopped, a circle with a slash for retired. Colour may help but never carries
  the meaning alone. A retired car's row is also dimmed.
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
node docs/design/tools/screenshot.mjs placar         one direction (add --png for lossless footage shots)
node docs/design/tools/checkLayout.mjs placar        title-safe boxes, row counts, smallest text per graphic
node docs/design/tools/contrastRatio.mjs "#ffffff" "#003b71" [panelAlpha] [backdrop]
```

Screenshots over footage are JPEG at quality 85 (a 1920x1080 PNG of a photo is 2 to 3 MB
and there are over a hundred); over grey and black they are PNG. `--png` makes them all PNG.
