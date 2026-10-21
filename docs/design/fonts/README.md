# Fonts for the design mock-ups

Self-hosted, Latin-subset woff2, with the SIL Open Font License 1.1 text beside the file.
`fonts.css` declares the face; a mock-up page links it with
`<link rel="stylesheet" href="../../fonts/fonts.css">` and never loads type from a CDN,
because the graphics must work offline at the track.

| Family     | Weights here          | Used by                        | Tabular figures (`tnum`) | Source                       |
| ---------- | --------------------- | ------------------------------ | ------------------------ | ---------------------------- |
| Bebas Neue | 400 (its only weight) | ardosia, for everything on air | yes                      | @fontsource/bebas-neue 5.3.0 |

Bebas Neue is uppercase-only: the Latin subset carries no lowercase glyphs, so a lowercase
letter would fall back to another face. The pages therefore set everything in caps
(`text-transform: uppercase` on the body), which is also how the scoreboard the stream uses
today sets its rows. It has the ordinal sign ("1º") and every pt-BR accent.

The tabular-figures column was measured in Chromium (Playwright): with
`font-variant-numeric: tabular-nums`, ten "1"s and ten "0"s must render at the same width.
The existing scoreboard's face, Urzeit, is a "Personal Use" licence and cannot be bundled, so
the closest clean open-licence faces were tested as replacements: Teko, Oswald, Big
Shoulders Display, Chakra Petch, Rajdhani and Anton all fail the tabular test (their digits
change width, so a clock or a gap column would jitter), and Bebas Neue passes. Barlow,
Barlow Condensed, Inter and Saira were tested and used by earlier directions; they left the
folder with them (Barlow Condensed stays a repo dependency through the race clock graphic).

Licence check: the OFL allows the font to be bundled, embedded and redistributed with
software as long as it is not sold by itself and the licence travels with it, which is why
the folder carries its LICENSE. Urzeit is not here; ardosia's README says where it could
appear later as an accent once the licensed file arrives.
