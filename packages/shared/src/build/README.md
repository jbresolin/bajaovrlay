# packages/shared/src/build

How a page notices that the server was upgraded under it. Start at `serverBuildWatch.ts`:
the server's `hello` names its build (`buildId`), and the control page and the renderer
each hand it to their watch, built with their own build id, clock, `location.reload`,
`sessionStorage` and setTimeout. `reloadForNewServerBuild.ts` holds the rule: a different
build reloads the page, at most once per announced build (the id it last reloaded for
is kept in sessionStorage), so a lasting mismatch costs one reload, not a loop. Only when
that id cannot be read or written does the older rule apply, at most once a minute by
the moment of the last reload; a reload it skipped as too recent is tried again when the
minute is over. A storage that fails as a whole means no reload. `readBuildIdOfAHello.ts` reads the build from the raw
JSON, so a page whose own schema refuses a newer server's hello still reloads.

One id per build: `pnpm build` first writes the build moment to `build-id.building.json`
(`scripts/writeBuildId.js`), which both Vite configs embed, and only once every package
has built copies it to `build-id.json` (`scripts/publishBuildId.js`), which the server
reads once at boot (`apps/server/src/readBuildId.ts`). A failed or running build never
changes the id a server announces; a finished one takes effect at the restart. A page
loaded between the build and the restart carries the new id against the old, reloads once
for the old id and not again until the restart announces another build. A page from the Vite dev server has no id, so nothing is
compared there.

Tests: `reloadForNewServerBuild.test.ts` (the once-per-build rule), `.fallback.test.ts`
(the once-a-minute fallback), both on the stand-ins of `pageReloadStandIns.testSupport.ts`.
