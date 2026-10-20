# Fonts for the design mock-ups

Self-hosted, Latin-subset woff2 files, one folder per family, each with its SIL Open Font
License 1.1 text beside it. `fonts.css` declares every face; a mock-up page links it with
`<link rel="stylesheet" href="../../fonts/fonts.css">` and never loads type from a CDN,
because the graphics must work offline at the track.

| Family | Weights here | Used by | Tabular figures (`tnum`) | Source |
| --- | --- | --- | --- | --- |
| Bebas Neue | 400 (its only weight) | ardosia | yes | @fontsource/bebas-neue 5.3.0 |
| Barlow Condensed | 500, 600, 700, 800 | grafite | yes | @fontsource/barlow-condensed 5.3.0 (already a repo dependency) |
| Barlow | 400, 500, 600, 700 | all three, small mixed-case text | yes | @fontsource/barlow 5.2.8 |
| Saira | 400, 500, 600, 700, 800 | marinho | yes | @fontsource/saira 5.2.8 |

The tabular-figures column was measured in Chromium (Playwright): with
`font-variant-numeric: tabular-nums`, ten "1"s and ten "0"s must render at the same width.
The existing scoreboard's face, Urzeit, is a "Personal Use" licence and cannot be bundled, so
the closest clean open-licence faces were tested as replacements: Teko, Oswald, Big
Shoulders Display, Chakra Petch, Rajdhani and Anton all fail the tabular test (their digits
change width, so a clock or a gap column would jitter), and Bebas Neue passes. It is
uppercase-only, which matches the scoreboard's all-caps rows.

Licence check: the OFL allows the fonts to be bundled, embedded and redistributed with
software as long as they are not sold by themselves and the licence travels with them, which
is why each folder carries its LICENSE. Urzeit is not here; each direction's README says where
it could appear later as an accent once the licensed file arrives.
