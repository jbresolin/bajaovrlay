# image (`@bajaovrlay/image`)

"Imagem" (BAJAOVRLAY-84): one image from the media store, anywhere on the 1920x1080 canvas, sized
and placed by hand. The item gives the width (480 px by default); the height follows the file's own
proportions unless "Altura (px)" is set too, and then the picture is fitted inside that box, never
stretched. "Posição" is one of nine anchors on the canvas's own edges and centre lines (centred by
default), moved by "Deslocamento X/Y (px)", which may be negative and may leave the safe area.
"Opacidade (%)" goes from 10 to 100; "Entrada" fades (default) or cuts. "Fundo" (empty: none) is a
`#rrggbb` colour filling the box, "Margem (px)" included and the bands beside a fitted picture too.
A new size or position on air moves the picture in place. It goes on its own top layer, "Imagem" (`image`, z 60). A file that
fails answers 422 in pt-BR and draws nothing (never a broken-image icon); on an update the old
picture stays up, as in the logo bug.
Start reading at `src/image.ts` (the lifecycle); it wires `imageModel.ts` (data, defaults, limits),
`imageBoxPosition.ts` (the anchors as CSS), `imageView.ts`, `imageFileFetches.ts`, `imageStyles.ts`,
`imageAnimations.ts` and `ptBR.ts`.
Preview: `pnpm --filter @bajaovrlay/image dev`, then http://localhost:5240/preview.html (add
`?position=bottom-right`, `?width=335`, `?height=120`, `?x=-40`, `?y=20`, `?opacity=50`,
`?entrance=none`, `?background=%230a0a0a`, `?margin=12`, `?image=missing`, `?stage=grey|black` or `?data=<JSON>`). Unit tests:
`pnpm --filter @bajaovrlay/image test`; Playwright on the built `dist/`, with the screenshots:
`pnpm --filter @bajaovrlay/image test:e2e`.
