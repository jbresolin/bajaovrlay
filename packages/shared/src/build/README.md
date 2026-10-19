# packages/shared/src/build

How a page notices that the server was upgraded under it. Start at
`reloadForNewServerBuild.ts`: the server's `hello` names its build (`buildId`), and the
control page and the renderer each hand it to `reloadThePageWhenTheServerBuildDiffers`
with their own build id, their clock, `location.reload` and `sessionStorage`. A different
build reloads the page, at most once a minute (the last reload's moment is kept in
sessionStorage), so a lasting mismatch costs one reload a minute, not a loop.

One id per build: `pnpm build` first runs `scripts/writeBuildId.js`, which writes the
build moment to `build-id.json` at the repository root; both Vite configs embed it and the
server reads it for every hello (`apps/server/src/readBuildId.ts`), so a rebuild with the
server still up does not leave pages reloading against a boot-time id. A lasting mismatch
remains possible if `pnpm build` fails after writing the file: pages then reload once a
minute until a build succeeds. A page from the Vite dev server has no id, so nothing is
compared there.
