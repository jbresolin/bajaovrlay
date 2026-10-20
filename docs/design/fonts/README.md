# Fonts for the design mock-ups

Self-hosted, Latin-subset woff2 files, one folder per family, each with its SIL Open Font
License 1.1 text beside it. `fonts.css` declares every face; a mock-up page links it with
`<link rel="stylesheet" href="../../fonts/fonts.css">` and never loads type from a CDN,
because the graphics must work offline at the track.

| Family | Weights here | Used by | Tabular figures (`tnum`) | Source |
| --- | --- | --- | --- | --- |
| Barlow Condensed | 500, 600, 700, 800 | placar | yes | @fontsource/barlow-condensed 5.3.0 (already a repo dependency) |
| Barlow | 400, 500, 600, 700 | placar | yes | @fontsource/barlow 5.2.8 |
| Inter | 400, 500, 600, 700, 800 | vidro | yes | @fontsource/inter 5.2.8 |
| Saira | 400, 500, 600, 700, 800 | faixa | yes | @fontsource/saira 5.2.8 |
| Saira Condensed | 500, 600, 700 | faixa, names only | **no** | @fontsource/saira-condensed 5.2.8 |

The tabular-figures column was measured in Chromium (Playwright): with
`font-variant-numeric: tabular-nums`, ten "1"s and ten "0"s must render at the same width.
Saira Condensed fails that test, so it only ever sets team names and words.

Licence check: the OFL allows the fonts to be bundled, embedded and redistributed with
software as long as they are not sold by themselves and the licence travels with them, which
is why each folder carries its LICENSE. Urzeit, the event's display font, is not here: it is
licensed to SAE but not yet available, and the mock-ups do not depend on it.
