/**
 * Reading the build id at boot (apps/server)
 *
 * What this module is for:
 *   `pnpm build` first writes build-id.json at the repository root (scripts/writeBuildId.js),
 *   and both Vite builds embed the id it holds. The server reads the same file at boot and
 *   puts the id in every hello, so an open page from another build reloads itself.
 *
 * What these tests prove:
 *   - A file written as the build script writes it gives its id.
 *   - No file (development, a checkout never built) gives no id.
 *   - A file that is not JSON, or JSON without a usable id, gives no id either: a page
 *     reload helper must never stop the server from booting on race day.
 *
 * What these tests deliberately do not cover:
 *   - The real file at the repository root; main.ts reads it with buildIdFileUrl.
 *   - Sending the id in hello; core/ws/webSocketHubBuildId.test.ts.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

import { createTemporaryDataFolder } from './core/boot/temporaryDataFolder.testSupport.js';
import { readBuildId } from './readBuildId.js';

/** Writes the given text as build-id.json in a fresh folder and returns the file's URL. */
function writeBuildIdFileHolding(fileText: string): URL {
  const buildIdFilePath = join(createTemporaryDataFolder(), 'build-id.json');
  writeFileSync(buildIdFilePath, fileText);
  return pathToFileURL(buildIdFilePath);
}

describe('readBuildId', () => {
  it('reads the id from a file written as the build script writes it', () => {
    // Arrange: the file of this morning's build.
    const buildIdFileUrl = writeBuildIdFileHolding(
      '{\n  "buildId": "2026-10-19T07:40:02.518Z"\n}\n',
    );

    // Act: read it, as main.ts does at boot.
    const buildId = readBuildId(buildIdFileUrl);

    // Assert: the id is the one the pages embedded.
    expect(buildId, 'the id must be the one in the file').toBe('2026-10-19T07:40:02.518Z');
  });

  it('gives no id when the file does not exist', () => {
    // Arrange: a folder with no build-id.json in it, as in a checkout never built.
    const missingFileUrl = pathToFileURL(join(createTemporaryDataFolder(), 'build-id.json'));

    // Act: read it.
    const buildId = readBuildId(missingFileUrl);

    // Assert: no id, and no exception.
    expect(buildId, 'a missing file must give no id').toBeUndefined();
  });

  const unusableFiles = [
    // Cut short by a full disk while the build wrote it.
    { name: 'gives no id for a file that is not JSON', fileText: '{ "buildId": "2026-10' },
    // An empty id would compare as "another build" against every page.
    { name: 'gives no id for an empty id', fileText: '{ "buildId": "" }' },
    // Some other JSON put there by hand.
    { name: 'gives no id for JSON without a buildId', fileText: '{ "versao": "0.3.1" }' },
  ];

  it.each(unusableFiles)('$name', ({ fileText }) => {
    // Arrange: a build-id.json holding the row's text.
    const buildIdFileUrl = writeBuildIdFileHolding(fileText);

    // Act: read it.
    const buildId = readBuildId(buildIdFileUrl);

    // Assert: no id, and no exception that would stop the boot.
    expect(buildId, 'an unusable file must give no id').toBeUndefined();
  });
});
