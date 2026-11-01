# The one image of BajaOvrLay: the server, the control page, the renderer, every graphic
# and the theme, all served by the server on port 8080. The same image runs on TrueNAS
# between events and on the stream PC at the event, with no internet (deploy/README.md).
#
#   docker build -t bajaovrlay .
#   docker run -p 8080:8080 -v bajaovrlay-data:/data bajaovrlay
#
# Everything the server keeps lives in the one volume, /data: back up that folder and the
# whole install is backed up. linux/amd64 is the target of both machines; linux/arm64
# builds from the same file (node images and better-sqlite3's binaries cover both).

# ---- Build: install, build every package, and set the server's production files apart.
FROM node:22-bookworm-slim AS build

# The version in package.json's "packageManager"; the lockfile is written by it.
RUN npm install --global pnpm@12.10.1

WORKDIR /repository

# The lockfile first: the packages are fetched in a layer of their own, which Docker keeps
# until the lockfile changes, so a change of source code does not download them again.
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch --store-dir /pnpm-store

COPY . .
RUN pnpm install --offline --frozen-lockfile --store-dir /pnpm-store
RUN pnpm build

# better-sqlite3 ships its compiled binary for each platform (prebuilds/), so nothing is
# compiled here. This line fails the build if the binary of this platform cannot load,
# rather than letting the image fail at its first boot.
RUN pnpm --filter @bajaovrlay/server exec node -e "new (require('better-sqlite3'))(':memory:').close()"

# The server with only its production dependencies, @bajaovrlay/shared's build included.
# Not --offline: pnpm checks the lockfile against its supply-chain rules, which reads
# registry metadata that `pnpm fetch` does not keep. The packages come from the store.
RUN pnpm --filter @bajaovrlay/server deploy --prod --store-dir /pnpm-store /deployed-server
RUN bash scripts/collectImageFiles.sh /repository /deployed-server /image

# ---- Runtime: Node and the collected files only; no pnpm, no sources, no tests.
FROM node:22-bookworm-slim AS runtime

# The defaults of the image (.env.example says what each is for). An env_file or -e
# overrides any of them; the paths should stay under /data.
ENV NODE_ENV=production \
    PORT=8080 \
    HOST=0.0.0.0 \
    LOG_LEVEL=info \
    DATABASE_PATH=/data/bajaovrlay.sqlite \
    DATA_DIR=/data

WORKDIR /app
COPY --from=build /image /app

# The node user (uid 1000) of the official image runs the server; root owns the code, so
# the server cannot change itself. A host folder mounted on /data must be writable by
# uid 1000 (deploy/truenas/README.md, step 1).
RUN mkdir /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 8080

# Node's own fetch, since the slim image has no curl. Healthy once /health answers 200:
# every 2 s while it starts (start-interval, Docker 25 or newer), every 30 s after.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --start-interval=2s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + process.env.PORT + '/health').then((answer) => process.exit(answer.ok ? 0 : 1), () => process.exit(1))"]

# Node as the first process: main.ts closes the database cleanly on the SIGTERM of
# `docker stop`, within Docker's 10 seconds.
CMD ["node", "apps/server/dist/main.js"]
