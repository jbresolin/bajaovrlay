// The first step of `pnpm build`: writes build-id.json at the repository root, so the
// control page, the renderer and the server all name the same build. Both Vite configs
// embed the id it holds into their pages, and the server reads it at boot and sends it in
// every hello; a page whose id differs reloads itself (packages/shared/src/build).
// What could go wrong: a later `pnpm --filter <app> build` alone reuses the id already in
// the file, so that page keeps the old id; only the root `pnpm build` writes a new one.
// The file is gitignored: it describes this checkout's build, not the source.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { writeBuildIdFileText } from './buildIdFile.js';

const buildIdFilePath = fileURLToPath(new URL('../build-id.json', import.meta.url));

writeFileSync(buildIdFilePath, writeBuildIdFileText(new Date()));
