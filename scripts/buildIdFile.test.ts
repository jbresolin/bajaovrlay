/**
 * The text of build-id.json (scripts)
 *
 * What this module is for:
 *   `pnpm build` starts by writing build-id.json at the repository root
 *   (writeBuildId.js). Both Vite builds embed the id in it, and the server sends it in
 *   every hello, so an open page from an older build reloads itself.
 *
 * What these tests prove:
 *   - The text is JSON holding one field, `buildId`, the moment the build started in
 *     UTC, written the way Date writes ISO moments, ending with a newline.
 *
 * What these tests deliberately do not cover:
 *   - Writing the file (one writeFileSync call in writeBuildId.js, run by `pnpm build`).
 *   - Reading it: apps/server/src/readBuildId.test.ts reads text of this very shape, and
 *     the Vite configs read the same field.
 */
import { describe, expect, it } from 'vitest';

import { writeBuildIdFileText } from './buildIdFile.js';

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
