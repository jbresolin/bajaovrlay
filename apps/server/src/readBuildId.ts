import { readFileSync } from 'node:fs';

import { z } from 'zod';

// This file sits one level below apps/server both as source (src/) and when built
// (dist/), so the same relative path reaches the repository root in both cases.
// scripts/publishBuildId.js writes the file there at the end of `pnpm build`, once every
// package has built, with the id both Vite configs embedded into their pages.
/** Where `pnpm build` leaves build-id.json: the repository root. */
export const buildIdFileUrl = new URL('../../../build-id.json', import.meta.url);

const BuildIdFileSchema = z.object({ buildId: z.string().min(1) });

/**
 * Reads the id of the last `pnpm build`, or undefined when there is no usable file.
 * Deliberate: a missing or broken file never stops the boot (unlike readServerVersion);
 * the only loss is that open pages do not reload themselves after an upgrade.
 */
export function readBuildId(fileUrl: URL): string | undefined {
  let fileText: string;
  try {
    fileText = readFileSync(fileUrl, 'utf8');
  } catch {
    return undefined;
  }
  let fileJson: unknown;
  try {
    fileJson = JSON.parse(fileText);
  } catch {
    return undefined;
  }
  const parsedFile = BuildIdFileSchema.safeParse(fileJson);
  if (!parsedFile.success) {
    return undefined;
  }
  return parsedFile.data.buildId;
}
