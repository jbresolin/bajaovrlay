# vidro — motion

Every duration and easing below is a token in `tokens.css` (`--motion-*`, `--ease-*`), so the
product can tune them in one place. Nothing moves that does not carry information: a graphic
enters, a flag changes, a car changes position, the strip turns a page, a graphic leaves.

## In and out (every graphic)

| | Opacity | Translate Y | Filter | Duration | Easing |
| --- | --- | --- | --- | --- | --- |
| In | 0 → 1 | 12px → 0 | blur(6px) → 0 | 320 ms (`--motion-in`) | ease-out `cubic-bezier(0, 0, 0.2, 1)` |
| Out | 1 → 0 | 0 → 8px | none | 200 ms (`--motion-out`) | ease-in `cubic-bezier(0.4, 0, 1, 1)` |

- Race clock, lower third, sponsor bug: the whole card animates as one element.
- Towers: the panel enters as one element and each row enters on its own with a 14 ms
  stagger (`--motion-stagger`), top to bottom, so 22 rows settle in about 680 ms (60 ms
  lead + 21 × 14 ms + the 320 ms of the last row; 20 rows in about 650 ms). On the
  way out, all rows leave together (200 ms) — a staggered exit would read as a glitch. The
  tower clips its rows (`overflow: hidden`), so a row's 12px rise on entry and its glow stay
  inside the panel's 12px corners.
- Lower strip: the whole bar enters as one element, rising 12px from just below its place.
- Sponsor bug: same in/out; it never pulses or cycles.

The entrance blur is a `filter` on the graphic itself, not a `backdrop-filter`, so it works
over OBS's transparent background (the glass has no backdrop blur; see README "A ideia"). It
costs one extra GPU pass for 320 ms; if the OBS browser source drops frames on entrance, the
`filter` keyframe is the first thing to remove (opacity + translate alone still read as
"glass arriving").

## Flag change (clock pill and strip pill together)

- Background and text colour crossfade over 250 ms (`--motion-flag`), ease-out. This is a
  CSS `transition` on `.flag-pill`, so the product only swaps `data-flag` and the word.
- At the same time the pill pulses `scale(1) → 1.06 → 1` over the same 250 ms, so the eye is
  pulled to the state change even in the corner of the frame.
- The word changes at the start of the crossfade (no text crossfade: the word must never
  show two states at once).
- In the strip the capsule follows the word, so the cells shift in one cut when the word
  changes (49px from VERDE to AMARELA, 67px to VERMELHA; README "The lower strip" and open
  question 4). The width is not transitioned on purpose: a 250 ms squeeze of four cells of
  text would smear under stream compression, and a cut does not.

## Position change (towers)

FLIP: the server sends the new order; the renderer measures the old row tops, reorders the
DOM, then animates each moved row from its old offset to 0.

- Translate: 450 ms (`--motion-swap`), `cubic-bezier(0.2, 0.8, 0.2, 1)` (fast start, soft stop).
- Position numbers stay with the slot; the car, name, laps and status travel with the row.
- Glow: the row that moved up gets a `rgb(0 151 57 / 0.35)` fill (`--accent-glow-up`, brand
  green), the row that moved down `rgb(56 109 180 / 0.35)` (`--accent-glow-down`, brand
  blue). The glow holds for half of 1.2 s (`--motion-glow`) and fades out over the other half.
  White text stays at 8.08:1 / 8.87:1 over the glow and muted text at 4.88:1 / 5.30:1 (see
  README "Contrast"); a retired row's muted text would drop to 4.04:1 (green) or 4.36:1
  (blue) during a glow, large text only, so a retired car that changes position is the one
  case to watch. On the first and last rows the glow is clipped by the panel's rounded
  corners, never squared off outside them.
- The leader edge (3px green) and the leader's green position pill belong to the first slot,
  not to a car: they do not move.

## Lower strip pages

- 4 cars per page (README "The lower strip" says why, and offers the brief's 9 per page
  without the school name as an open question), 6 s hold per page (`--motion-strip-hold`),
  15 pages for 60 cars, 90 s for the whole field.
- Page change: the old page fades 1 → 0 while sliding 0 → −8px; the new page fades 0 → 1
  while sliding 8px → 0. 300 ms (`--motion-strip-page`), ease-out. The page counter
  ("1/15", 28px) changes at the start of the crossfade.
- The clock capsule and the counter do not move; only the cells area crossfades.
- No scrolling, ever: moving text smears under stream compression and is unreadable at 720p
  on a phone. A still page for 6 s is readable; a crawl is not.

## What motion-demo.html shows

A 9 s loop over footage frame 1, driven by the Web Animations API (the on-air pages have no
script). The tower has 20 rows in the demo, not 22: the strip's room (y 950..1026) covers
rows 21 and 22, so with the strip on air the operator takes the tower with 20 rows, and the
demo does the same rather than let the strip cover two rows.

| Time | What |
| --- | --- |
| 0.0 s | In: clock, 20 tower rows (14 ms stagger), strip (+100 ms), lower third (+200 ms) |
| 1.8 s | Flag change green → yellow: colour crossfade + scale pulse on both pills; the strip's cells shift 49px in one cut |
| 3.2 s | P3 / P4 swap: FLIP 450 ms, green glow on the row that moved up, blue on the one that moved down |
| 4.8 s | Strip page 1 → 2: crossfade 300 ms with the 8px slide; counter 1/15 → 2/15 |
| 6.4 s | Flag back to green |
| 7.6 s | Out: 200 ms ease-in; then the demo resets and loops |

The demo reads every duration, easing and glow colour from the tokens at run time, so a
change in `tokens.css` changes the demo.
