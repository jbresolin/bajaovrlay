import { readFileSync } from 'node:fs';

import { z } from 'zod';

// This file sits one level below apps/server both as source (src/) and when built
// (dist/), so the same relative path reaches the server's package.json in both cases.
const serverPackageJsonUrl = new URL('../package.json', import.meta.url);

const PackageJsonWithVersionSchema = z.object({ version: z.string().min(1) });

/** Reads the server's version from apps/server/package.json, for /health and the logs. */
export function readServerVersion(): string {
  const packageJsonText = readFileSync(serverPackageJsonUrl, 'utf8');
  const packageJson = PackageJsonWithVersionSchema.parse(JSON.parse(packageJsonText));
  return packageJson.version;
}
