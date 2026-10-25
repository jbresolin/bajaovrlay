# graphics-kit (`@bajaovrlay/graphics-kit`)

What two or more OGraf graphics share, written once (BAJAOVRLAY-24; the clock's reading, ticker
and flag since BAJAOVRLAY-23, for the race clock and the strip's and ticker's clock block). Each graphic lists it as a
workspace dependency and Vite bundles the parts it imports into the graphic's own `dist/`: no
graphic loads anything at run time, so rule 3 (graphics never fetch) holds. Like the theme, the
kit is imported from its TypeScript source and has no build of its own. It is not a graphic.

```
src/ografGraphicTypes.ts                 the OGraf v1 Graphic interface and its params (start here)
src/playSteps.ts                         which step playAction goes to (the OGraf step rule)
src/pageTurner.ts                        hold, turn, hold again: the tower's and the standings' page timer
src/timelinePlayback.ts                  play a paused GSAP timeline to its end, or finish it at once
src/dataProblems.ts                      one pt-BR sentence for the first problem in refused data
src/textPresence.ts                      whether an optional text has something to show (isTextGiven)
src/clockTicker.ts                       the per-frame loop that redraws a running clock while on air
src/raceClockReading.ts                  the clock's five fields (flag, mode, time, moment, running) and its H:MM:SS text
src/flagOnAir.ts                         a flag drawn on a band or a pill: state, word, name (checkered wordless)
src/ptBRFlagWords.ts                     the on-air word of each flag, the kit's one pt-BR catalog
src/clockBlock.ts                        the strip's and the ticker's clock block: markup, parts, writer
src/clockBlockStyles.ts                  the clock block's look (the time at 44 px, the flag pill)
src/clockBlockOnBar.ts                   a bar's clock block run: frame loop, redraw at server time, the switch
src/motionTimelineRunner.ts              one motion at a time: run, isRunning, finishEveryTimelineAtOnce
src/stripPageHold.ts                     --motion-strip-hold, the strip's and the ticker's page hold (7 s if missing)
src/barMotion.ts                         the strip's and the ticker's GSAP timelines: cascade in, out together, turn in place
src/waitForImagesToSettle.ts             load's wait for a graphic's images (at most 2 s; a broken one never blocks)
src/previewControls.ts                   preview.html's stage, buttons, answer line and data-preview-state
src/previewStage.ts                      ?stage=grey|black, the design's screenshot backgrounds
src/previewAddress.testSupport.ts        tests only: preview.html?data=<JSON> for the Playwright tests
src/tokenOverrides.testSupport.ts        tests only: theme tokens on :root before the graphic loads
src/ografSchemaValidator.testSupport.ts  tests only: the ajv validator over the vendored ograf-schema/
ograf-schema/                            the official OGraf v1 schemas, vendored once (see its README)
```

Import each by its subpath (`@bajaovrlay/graphics-kit/pageTurner`), never a path into the folder. The
test-only modules end in `.testSupport`, subpath included, so no graphic's own module can import
them by mistake and Vite never bundles ajv into a graphic.
Move something here only when a second graphic needs it; a helper with one user stays home.
