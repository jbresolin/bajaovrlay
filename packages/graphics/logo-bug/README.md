# logo-bug (`@bajaovrlay/logo-bug`)

The channel logo (BAJAOVRLAY-63), the smallest graphic in the catalogue: one static image from the
media store in the corner the item picks (the kit's `screenCornerPosition`, on the title-safe
edges), at a height of 32 to 200 px (80 by default) and an opacity of 30 to 100% (100 by
default). It fades in over `--motion-in` and out over `--motion-out`, and never pulses or cycles.
It goes on its own layer, "Logo do canal" (`channel-logo`), so it can stay on air beside the
sponsor bug. A new image is fetched hidden while the logo on screen stays up. An image that fails
answers 422 with a pt-BR message, which reaches the operator through the renderer: at load the
corner stays empty (never a broken-image icon), at an update the old logo stays. A failed image is
fetched again at the next update, even at the same address.
Start reading at `src/logo-bug.ts` (the team card's lifecycle); it wires `logoBugModel.ts` (data,
defaults, limits), `logoImageFetches.ts` (the logo on screen and the file on its way),
`logoBugView.ts`, `logoBugStyles.ts`, `logoBugAnimations.ts` and `ptBR.ts`.
Preview: `pnpm --filter @bajaovrlay/logo-bug dev`, then http://localhost:5224/preview.html (add
`?corner=top-left`, `?height=32`, `?opacity=50`, `?image=missing`, `?stage=grey|black` or
`?data=<JSON>`). Unit tests: `pnpm --filter @bajaovrlay/logo-bug test`; Playwright on the built
`dist/`, with the screenshots: `pnpm --filter @bajaovrlay/logo-bug test:e2e`.

## The seeded item "Logo do canal"

The server seeds it once per database as the only button of a quick-fire panel of its own,
"Logo", with no image chosen: the operator opens it, picks the file under **Imagem** (Biblioteca de
mídia) and saves. Until then "Salvar" is refused by the form's required field, and a take by the
server, naming "Imagem".
