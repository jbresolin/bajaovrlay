# packages/shared/src/build

How a page notices that the server was upgraded under it. Start at `serverBuildWatch.ts`:
the server's `hello` names its build (`buildId`), and the control page and the renderer
each hand it to their watch, built with their own build id, clock, `location.reload`,
`sessionStorage` and setTimeout. `reloadForNewServerBuild.ts` holds the rule: a different
build reloads the page, at most once a minute (the last reload's moment is kept in
sessionStorage), so a lasting mismatch costs one reload a minute, not a loop. A reload
skipped as too recent is tried again when the minute is over, so a second upgrade within
the minute still reaches the page. `readBuildIdOfAHello.ts` reads the build from the raw
JSON, so a page whose own schema refuses a newer server's hello still reloads.

One id per build: `pnpm build` first writes the build moment to `build-id.building.json`
(`scripts/writeBuildId.js`), which both Vite configs embed, and only once every package
has built copies it to `build-id.json` (`scripts/publishBuildId.js`), which the server
reads once at boot (`apps/server/src/readBuildId.ts`). A failed or running build never
changes the id a server announces; a finished one takes effect at the restart. A page
loaded between the build and the restart carries the new id against the old, and reloads
once a minute until the restart. A page from the Vite dev server has no id, so nothing is
compared there.
