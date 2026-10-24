# graphics-kit (`@bajaovrlay/graphics-kit`)

What two or more OGraf graphics share, written once (BAJAOVRLAY-24). Each graphic lists it as a
workspace dependency and Vite bundles the parts it imports into the graphic's own `dist/`: no
graphic loads anything at run time, so rule 3 (graphics never fetch) holds. Like the theme, the
kit is imported from its TypeScript source and has no build of its own. It is not a graphic.

```
src/ografGraphicTypes.ts     the OGraf v1 Graphic interface and its params (start here)
src/playSteps.ts             which step playAction goes to (the OGraf step rule)
src/pageTurner.ts            hold, turn, hold again: the page timer of the tower and the standings
src/timelinePlayback.ts      play a paused GSAP timeline to its end, or finish it at once
src/dataProblems.ts          one pt-BR sentence for the first problem in refused data
src/previewControls.ts       preview.html's stage, buttons, answer line and data-preview-state
src/previewAddress.ts        tests only: preview.html?data=<JSON> for the Playwright tests
src/ografSchemaValidator.ts  tests only: the ajv validator over the vendored ograf-schema/
ograf-schema/                the official OGraf v1 schemas, vendored once (see its README)
```

Import each by its subpath (`@bajaovrlay/graphics-kit/pageTurner`), never a path into the folder.
Move something here only when a second graphic needs it; a helper with one user stays home.
