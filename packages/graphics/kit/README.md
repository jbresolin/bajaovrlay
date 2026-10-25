# graphics-kit (`@bajaovrlay/graphics-kit`)

What two or more OGraf graphics share, written once (BAJAOVRLAY-24; the clock's reading, ticker
and flag since BAJAOVRLAY-23, for the race clock and the strip's and ticker's clock block; the
sponsor round, the countdown and the narrow board since BAJAOVRLAY-46, for the countdown, the
sessions board, the sponsor roll and the intermission board). Each graphic lists it as a
workspace dependency and Vite bundles the parts it imports into the graphic's own `dist/`: no
graphic loads anything at run time, so rule 3 (graphics never fetch) holds. Like the theme, the
kit is imported from its TypeScript source and has no build of its own. It is not a graphic.

```
src/ografGraphicTypes.ts                 the OGraf v1 Graphic interface and its params (start here)
src/playSteps.ts                         which step playAction goes to (the OGraf step rule)
src/pageCycle.ts                         which page comes after the one on air (1 after the last)
src/pageTurner.ts                        hold, turn, hold again: the tower's and the standings' page timer
src/timelinePlayback.ts                  play a paused GSAP timeline to its end, or finish it at once
src/dataProblems.ts                      one pt-BR sentence for the first problem in refused data
src/textInPlace.ts                       writeTextIfChanged: a text written on air only when it differs
src/textPresence.ts                      whether an optional text has something to show (isTextGiven)
src/clockTicker.ts                       the per-frame loop that redraws a running clock while on air
src/raceClockReading.ts                  the clock's five fields (flag, mode, time, moment, running) and its H:MM:SS text
src/flagOnAir.ts                         a flag drawn on a band or a pill: state, word, name (checkered wordless)
src/ptBRFlagWords.ts                     the on-air word of each flag, the kit's one pt-BR catalog
src/clockBlock.ts                        the strip's and the ticker's clock block: markup, parts, writer
src/clockBlockStyles.ts                  the clock block's look (the time at 44 px, the flag pill)
src/clockBlockOnBar.ts                   a bar's clock block run: frame loop, redraw at server time, the switch
src/motionTimelineRunner.ts              one motion at a time: run, isRunning, finishEveryTimelineAtOnce
src/pageHold.ts                          a page hold (--motion-strip-hold, --motion-board-hold) or its fallback, never 0
src/barStyles.ts                         the bars' host, grid (one column less without the clock) and page cell
src/barMotion.ts                         the strip's and the ticker's GSAP timelines: cascade in, out together, turn in place
src/waitForImagesToSettle.ts             load's wait for a graphic's images (at most 2 s; a broken one never blocks)
src/sponsorRound.ts                      every sponsor round: the level order (shared's), each level's heading and hold
src/ptBRSponsorLevelHeadings.ts          the on-air heading of each level ("PATROCÍNIO DIAMANTE"); read through sponsorRound only
src/sponsorPages.ts                      a round's pages: one level a page, a level shared evenly between its pages
src/sponsorPageTurner.ts                 a round's page timer: the pageTurner, each page held by its level
src/stackedPageLayers.ts                 two layers in one place: which page each holds through a turn or a redraw
src/countdownText.ts                     the count to a start (m:ss, h:mm:ss, never negative) and a start's time of day
src/countdownClock.ts                    the count on air: redrawn every frame at server time, stopped at 0:00
src/boardHead.ts                         the narrow boards' head card: logo, title, subtitle, the line at the right
src/boardStyles.ts                       the narrow boards' frame (--board-width, centred) and head card
src/boardMotion.ts                       the boards' rise (each piece at its own start) and the crossfade of a state
src/clockCardStyles.ts                   the clock card's frame, head and body: the race clock's and the countdown card's
src/bugCardStyles.ts                     the bug's card: the sponsor bug's and the sponsor roll's corner card
src/pointsText.ts                        a score as the boards write it ("921,8", "−15"): the standings' and the intermission's
src/standingsRowStyles.ts                a standings row's pill and cells: the standings' and the intermission's top five
src/wideBoardHead.ts                     the wide boards' head card (standings, podium): markup, parts, writer
src/wideBoardHeadStyles.ts               the wide head card's look (logo, title, event line, the line at the right)
src/teamLogoCell.ts                      a team's logo cell (team card, podium): the logo in its box, on the plate or not
src/teamLogoCellStyles.ts                the logo cell's look; each graphic sizes it with --team-logo-cell-width/height
src/carChipLargeStyles.ts                the large car chip (team card, podium)
src/checkMarkShape.ts                    the check mark's SVG path (sessions board's finished slot, bracket's winner)
src/carChipStyles.ts                     the car's blue chip (standings row, bracket)
src/teamWithSchoolStyles.ts              a team's name cut with an ellipsis, its school after it (standings row, bracket)
src/wideBoardFrameStyles.ts              the wide full-screen board's host, frame and stage (podium, bracket)
src/previewControls.ts                   preview.html's stage, buttons, answer line and data-preview-state
src/previewStage.ts                      ?stage=grey|black, the design's screenshot backgrounds
src/the30thCompetitionSponsorsSample.ts  the previews' 17 real sponsors, logos in preview-sponsor-logos/
src/previewAddress.testSupport.ts        tests only: preview.html?data=<JSON> for the Playwright tests
src/tokenOverrides.testSupport.ts        tests only: theme tokens on :root before the graphic loads
src/themeTokensOnThePage.testSupport.ts  tests only (jsdom): theme tokens on :root for one test
src/ografSchemaValidator.testSupport.ts  tests only: the ajv validator over the vendored ograf-schema/
src/the30thCompetitionSponsors.testSupport.ts  tests only: the same 17, each logo a /media address
src/runningMotions.testSupport.ts        tests only: ends every running GSAP timeline at once
ograf-schema/                            the official OGraf v1 schemas, vendored once (see its README)
```

Import each by its subpath (`@bajaovrlay/graphics-kit/pageTurner`), never a path into the folder. The
test-only modules end in `.testSupport`, subpath included, so no graphic's own module can import
them by mistake and Vite never bundles ajv into a graphic.
Move something here only when a second graphic needs it; a helper with one user stays home.
