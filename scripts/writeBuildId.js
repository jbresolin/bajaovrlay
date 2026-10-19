// The first step of `pnpm build`: writes build-id.building.json at the repository root,
// the id of the build under way. Both Vite configs embed the id it holds into their
// pages. The server does not read this file: it reads build-id.json, which
// publishBuildId.js copies from this one only once every package has built, so a build
// that fails or is still running never changes the build the server announces.
// What could go wrong: a later `pnpm --filter <app> build` alone reuses the id already in
// the file, so that page keeps the last full build's id; only the root `pnpm build`
// writes a new one. The file is gitignored: it describes this checkout's build.
import { writeFileSync } from 'node:fs';

import { buildingBuildIdFileUrl, writeBuildIdFileText } from './buildIdFile.js';

writeFileSync(buildingBuildIdFileUrl, writeBuildIdFileText(new Date()));
