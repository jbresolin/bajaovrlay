# fake-graphic (test fixture)

A minimal OGraf package used only by the renderer's Playwright tests (`../../e2e/`). It is
never built, never served by the real server and never shown on air.

- `fake-graphic.ograf.json` — the manifest; its `main` names the module below.
- `fake-graphic.js` — the web component. It records every lifecycle call (load,
  playAction, updateAction, stopAction, dispose) with its arguments on
  `window.__fakeGraphicCalls`, and resolves after `window.__fakeGraphicDelayInMilliseconds`.
  Its data can also tell it to misbehave (a load that throws, refuses or answers nothing).

Start reading at the comment on top of `fake-graphic.js`: it lists what a test can read
and what it can set. `e2e/fakeServerForPage.ts` serves this folder to the page as
`/graphics/fake-graphic/`, the address a real package would have.
