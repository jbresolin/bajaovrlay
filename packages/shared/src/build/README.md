# packages/shared/src/build

How a page notices that the server was upgraded under it. Start at
`reloadForNewServerBuild.ts`: the server's `hello` names its build (`buildId`), and the
control page and the renderer each hand it to `reloadThePageWhenTheServerBuildDiffers`
with their own build id, their clock, `location.reload` and `sessionStorage`. A different
build reloads the page, at most once a minute (the last reload's moment is kept in
sessionStorage), so a server whose pages were not rebuilt cannot make a page loop.

One id per build: `pnpm build` first runs `scripts/writeBuildId.js`, which writes the
build moment to `build-id.json` at the repository root; both Vite configs embed it and the
server reads it at boot (`apps/server/src/readBuildId.ts`). A page from the Vite dev server
has no id, so nothing is compared there.
