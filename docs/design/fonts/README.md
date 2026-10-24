# Fonts for the design mock-ups

Since BAJAOVRLAY-22 the on-air face lives in the product: `packages/theme/fonts/` holds Bebas
Neue (Latin subset, woff2) with its SIL Open Font License 1.1 beside the file, and
`packages/theme/fonts/fonts.css` declares the face. That package is the source of truth; the
copy this folder once held is gone, and `fonts.css` here only imports the package's file so a
mock-up page's `<link rel="stylesheet" href="../../fonts/fonts.css">` keeps working from the
file system. Nothing is loaded from a CDN: the graphics must work offline at the track.

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
repository with them.

Licence check: the OFL allows the font to be bundled, embedded and redistributed with
software as long as it is not sold by itself and the licence travels with it, which is why
the package carries the LICENSE. Urzeit is not here; ardosia's README says where it could
appear later as an accent once the licensed file arrives.
