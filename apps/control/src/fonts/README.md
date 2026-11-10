# apps/control/src/fonts

The control page's own face, bundled so the page looks the same on every machine (BAJAOVRLAY-71).
Start with the `@font-face` and `--font-sans` at the top of `../index.css`.

- `inter/inter-latin-wght-normal.woff2` — Inter 4 (Fontsource 5.3.0), Latin subset, one variable file
  for every weight (the page uses 400, 500 and 600). `inter/LICENSE` is its SIL Open Font License 1.1.
- `controlPageFontCoversPtBR.test.ts` — the guard: the file maps every pt-BR character, and the only
  characters of the page's source it lacks are six named symbols (← → ⋯ ▲ ▼ ☰), left to the system's faces.
  It reads the file with `@bajaovrlay/theme/woff2CharacterMap.testSupport`, the theme's own reader.

Vite bundles the file next to the page, so it is served from the page's own address, never a CDN.
Text set in `font-mono` (key hints, trigger keys) keeps the system's monospace stack, which names no emoji face.
