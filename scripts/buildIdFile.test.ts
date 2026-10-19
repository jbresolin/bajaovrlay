/**
 * The build-id files of `pnpm build` (scripts)
 *
 * What this module is for:
 *   `pnpm build` starts by writing build-id.building.json at the repository root
 *   (writeBuildId.js), whose id both Vite builds embed, and ends, once every package has
 *   built, by copying it to build-id.json (publishBuildId.js), which the server reads at
 *   boot and names in every hello. So an open page from an older build reloads itself
 *   after the restart, and a failed or unfinished build never changes the id a server
 *   announces.
 *
 * What these tests prove:
 *   - The text is JSON holding one field, `buildId`, the moment the build started in
 *     UTC, written the way Date writes ISO moments, ending with a newline.
 *   - Publishing copies the id of the build that finished to the file the server reads,
 *     replacing the id of the build before it.
 *   - Publishing with no build under way fails, so `pnpm build` stops instead of leaving
 *     the server the previous id silently.
 *
 * What these tests deliberately do not cover:
 *   - The two one-line scripts running these, and the && chain in the root package.json
 *     that skips the publishing when a package fails to build.
 *   - Reading the ids: apps/server/src/readBuildId.test.ts reads text of this very shape,
 *     and the Vite configs read the same field.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, onTestFinished } from 'vitest';

import { publishBuildIdOfTheFinishedBuild, writeBuildIdFileText } from './buildIdFile.js';

/** A fresh folder standing in for the repository root, removed when the test ends. */
function createFolderStandingInForTheRepositoryRoot(): string {
  const folder = mkdtempSync(join(tmpdir(), 'bajaovrlay-build-id-'));
  onTestFinished(() => {
    rmSync(folder, { recursive: true, force: true });
  });
  return folder;
}

describe('writeBuildIdFileText', () => {
  it('writes the moment the build started as the build id, in UTC', () => {
    // Arrange: a build started at 04:40:02.518 in Brasília on 19 October 2026.
    const buildMoment = new Date('2026-10-19T04:40:02.518-03:00');

    // Act: write the file's text.
    const fileText = writeBuildIdFileText(buildMoment);

    // Assert: one buildId field holding that moment in UTC, and a final newline.
    expect(JSON.parse(fileText), 'the file must hold the build moment as its id').toEqual({
      buildId: '2026-10-19T07:40:02.518Z',
    });
    expect(fileText.endsWith('\n'), 'the file must end with a newline').toBe(true);
  });
});

describe('publishBuildIdOfTheFinishedBuild', () => {
  it('replaces the id the server reads with the id of the build that finished', () => {
    // Arrange: yesterday's build is the one the server reads, and this morning's build
    // has just finished building every package.
    const repositoryRoot = createFolderStandingInForTheRepositoryRoot();
    const buildingFile = join(repositoryRoot, 'build-id.building.json');
    const publishedFile = join(repositoryRoot, 'build-id.json');
    writeFileSync(publishedFile, writeBuildIdFileText(new Date('2026-10-18T09:12:44.103Z')));
    writeFileSync(buildingFile, writeBuildIdFileText(new Date('2026-10-19T07:40:02.518Z')));

    // Act: publish the finished build's id.
    publishBuildIdOfTheFinishedBuild(buildingFile, publishedFile);

    // Assert: the server's file now names this morning's build.
    expect(
      JSON.parse(readFileSync(publishedFile, 'utf8')),
      'the server must read the id of the build that finished',
    ).toEqual({ buildId: '2026-10-19T07:40:02.518Z' });
  });

  it('fails when no build is under way, and leaves the id the server reads alone', () => {
    // Arrange: yesterday's build is the one the server reads, and writeBuildId.js never
    // ran, so there is no id of a build under way.
    const repositoryRoot = createFolderStandingInForTheRepositoryRoot();
    const publishedFile = join(repositoryRoot, 'build-id.json');
    writeFileSync(publishedFile, writeBuildIdFileText(new Date('2026-10-18T09:12:44.103Z')));

    // Act: try to publish.
    const publishing = () =>
      publishBuildIdOfTheFinishedBuild(
        join(repositoryRoot, 'build-id.building.json'),
        publishedFile,
      );

    // Assert: publishing throws, and the server's file still names yesterday's build.
    expect(publishing, 'publishing with no build under way must fail the build').toThrow();
    expect(
      JSON.parse(readFileSync(publishedFile, 'utf8')),
      'the id the server reads must be left as it was',
    ).toEqual({ buildId: '2026-10-18T09:12:44.103Z' });
  });
});
