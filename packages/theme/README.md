# @bajaovrlay/theme

The on-air look as the product ships it: Ardósia, the direction João chose at the gate on
PR #19. One place where every visual value lives, injected by the renderer into every
graphic, so no graphic names a colour, a size, a face or a duration of its own.

```
ardosia/tokens.css        every token: colours, type, geometry, motion (the source of truth)
fonts/fonts.css           the @font-face of Bebas Neue, self-hosted (never a CDN)
fonts/bebas-neue/         the woff2 and its SIL Open Font License
brand/logo-branca.png     the white Baja SAE Brasil logo, 256 px tall (the clock head shows it at 44)
src/motion.ts             the `@bajaovrlay/theme/motion` entry a graphic imports (the two below)
src/readMotionTokens.ts   reads the --motion-* and --ease-* tokens as numbers and ease strings (start here for motion)
src/gsapEaseOfToken.ts    turns an ease token into a GSAP ease name (CustomEase, registered once per curve)
src/waitForThemeFonts.ts  the `@bajaovrlay/theme/fonts` entry: the wait for the display face every graphic does before its first draw
src/noHardCodedValues.test.ts  the guard: no colour (hex, rgb, hsl) or px font size in a graphic's source (preview.html is excluded on purpose)
src/motionTokensDeclaredInTheme.test.ts  every token readMotionTokens reads is declared in tokens.css
src/onAirFontCoversPtBR.test.ts  the guard: the woff2 maps every pt-BR on-air character (read by woff2CharacterMap.testSupport.ts)
```

**Who reads what.** The server serves this folder at `/theme/` (tokens, font CSS, font file,
logo), like it serves the graphics; `tokens.css` is sent with a no-cache header so an edit
shows on the next reload, the font and the logo with a long cache. The renderer page links
`/theme/ardosia/tokens.css` and `/theme/fonts/fonts.css` in its head, before its script, so
the tokens are on `:root` and the face registered before the first graphic loads. A graphic
reads them as `var(--panel-base)` inside its shadow root (custom properties pierce shadow
DOM) and its GSAP timelines take their durations and eases from `readMotionTokens()` (a
missing token reads as 0 and the ease as `linear`, never a throw) and `gsapEaseOfToken()`
(the token's cubic-bezier registered with GSAP's CustomEase, so GSAP runs the very curve
the design demo runs). A graphic's `preview.html` imports the same two CSS files from this
package through Vite, so the preview looks like the air without a server. The server only
serves `ardosia/`, `fonts/` and `brand/`; `src/` reaches a graphic through Vite alone.

**Source of truth.** `ardosia/tokens.css` here is the product's copy and the one that
counts. The file it was copied from, `docs/design/directions/ardosia/tokens.css` (the design
record of PR #19), stays as the record of the design and is read by no product code. The
token names are the design's. Copied with these changes:

- removed, because they served the design pages alone: `--chip-pos-background`,
  `--chip-laps-background` and `--laps-padding` (no-ops in Ardósia, kept there so the three
  directions compared at the gate could share one structure sheet) and `--motion-in-scale`
  (the "pop" of another direction, 1 in Ardósia);
- added, because the pages hard-coded them: `--stage-safe-top` (54 px, the title-safe top the
  clock sits on; `--tower-top` is built from it), `--tower-rows-per-page` (20),
  `--cue-width` / `--cue-height` (the ▲ / ▼ of a position change) and `--tracking-row` (the
  tower's team names, from the design's styles.css).
- added for the notice (BAJAOVRLAY-44, from the catalogue of PR #21): `--notice-top`,
  `--notice-width`, `--notice-head-height`, `--notice-row-height` and `--motion-notice-hold`
  as the design names them, and `--notice-penalty-background` / `--notice-penalty-text`
  (the navy cell, which the design wrote as `--brand-navy` and `#ffffff`).
- added for the lower third, the team card and the standings (BAJAOVRLAY-24, from the
  catalogue of PR #21), `--lower-third-bottom` (the lower-third slot's bottom edge, y 940,
  which the pages drew without a token) and, as the design names them: `--panel-light` (the logo's light plate),
  `--chip-large-size`, `--size-chip-large`, `--team-photo-width`, `--team-photo-height`,
  `--team-logo-size`, `--logo-plate-padding`, `--board-row-height`, `--size-board`,
  `--col-points`, `--col-total`, `--motion-board-hold` and `--motion-page-stagger` (the last
  two read by `readMotionTokens` as `boardHoldMs` and `pageStaggerMs`).
- added for the sponsor bug, the lower strip and the message ticker (BAJAOVRLAY-23):
  `--sponsor-logo-small-height` as the design names it, and, for values the design's styles
  wrote as numbers, `--size-bug-label` (44 px, the bug's event word), `--flag-pill-height`
  and `--flag-pill-min-width` (32 and 96 px, the clock block's flag pill), `--stage-safe-side`
  and `--stage-safe-bottom` (96 and 54 px, the title-safe edges of the bars along the bottom).
- added for the countdown, the sessions board, the sponsor roll and the intermission board
  (BAJAOVRLAY-46), as the design names them: `--board-width`, `--session-row-height`,
  `--session-time-width`, `--size-countdown`, `--size-countdown-small`, `--sponsor-tile-height`,
  `--sponsor-tile-logo-width`, `--sponsor-tile-logo-height`, `--sponsor-logo-line-width`,
  `--sponsor-logo-line-height`, `--sponsor-line-heading-width`, `--motion-sponsor-hold` and the
  five `--motion-sponsor-hold-<level>` (read by `readMotionTokens` as `sponsorHoldMs` and
  `sponsorHold<Level>Ms`); and `--session-status-icon-size` (22 px, the slot's state shape,
  which the design's styles wrote as a number).

- added for a text too long for its box (BAJAOVRLAY-55), which scrolls inside it: the motion
  tokens `--motion-text-hold-start`, `--motion-text-scroll-speed` (px per second),
  `--motion-text-hold-end`, `--motion-text-return` and `--motion-text-edge-fade` (px; read by
  `readMotionTokens` as `text*`), and the widths that bound boxes which grew with their text:
  `--lower-third-max-width` (1300 px, the safe width left of the tower) and
  `--battle-team-max-width` (460 px), and `--strip-school-max-width` (140 px, measured on the
  real field so one long school leaves the other pills of its page whole).

**Only one theme.** Ardósia is loaded statically; the concept's `theme` slice (one active
theme chosen by an operator) is not built yet (docs/decisions.md, PR of BAJAOVRLAY-22).

**Fonts.** Bebas Neue 400 only (its one weight), Latin subset: no lowercase glyphs, so every
graphic sets its text in caps and never asks for bold. Barlow and Barlow Condensed are not
shipped: the chosen design uses one face. Before its first draw a graphic awaits
`waitForThemeFontsToBeReady(this)` (`@bajaovrlay/theme/fonts`): it asks the page for the face
named by `--font-display` (`document.fonts.load`, read through the graphic so the token reaches
inside its shadow root) and then for `document.fonts.ready`, since `ready` alone can resolve
before the file is fetched on a cold OBS start; it never rejects, a face that fails leaves
the fallback on air.
