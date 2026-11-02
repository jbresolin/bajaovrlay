/**
 * The server's build in hello (packages/shared)
 *
 * What this module is for:
 *   The `hello` names the build the server runs (`buildId`), the same value its built
 *   pages embed, so an open page loaded from an older build can reload itself
 *   (packages/shared/src/build). The field is optional: a server from before this field,
 *   or one started with no build file, leaves it out, and its hello must still parse.
 *
 * What these tests prove:
 *   - A hello carrying a build id is accepted, and the id survives validation.
 *   - A hello without one is accepted.
 *   - An empty id, or one that is not text, is refused.
 *
 * What these tests deliberately do not cover:
 *   - What a page does with the id; reloadForNewServerBuild.test.ts and each app's
 *     serverConnection tests.
 *   - The rest of hello; serverMessages.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { obsSliceWithoutObs } from '../obs/obsSlice.js';
import { ServerMessageSchema } from './serverMessages.js';

/** Every slice empty, as the hello of a fresh database carries them. */
function buildEverySliceEmpty() {
  return {
    outputs: [{ outputId: 'program', name: 'Programa', order: 0 }],
    layers: [],
    graphics: [],
    instances: [],
    previewClearedLayerIds: [],
    instanceBindings: [],
    overrides: [],
    rundowns: [],
    items: [],
    quickFirePanels: [],
    macros: [],
    macroRuns: [],
    macroStops: [],
    obs: obsSliceWithoutObs,
    dataSources: [],
    dataSnapshots: [],
    recordings: [],
    events: [],
    eventRules: [],
    teams: [],
    people: [],
    sponsors: [],
    scheduleSlots: [],
    media: [],
    eventLog: [],
  };
}

describe('the build id in hello', () => {
  it('accepts a hello naming the build of the server and keeps the id', () => {
    // Arrange: the hello of a server built on 19 October 2026 at 07:40:02 UTC.
    const helloWithABuild = {
      type: 'hello',
      slices: buildEverySliceEmpty(),
      serverNowMs: 1_792_400_000_000,
      buildId: '2026-10-19T07:40:02.518Z',
    };

    // Act: check the message.
    const result = ServerMessageSchema.safeParse(helloWithABuild);

    // Assert: accepted unchanged, so the page can read the id.
    expect(result.success, 'a hello with a build id must be accepted').toBe(true);
    expect(result.data, 'validation must not drop the build id').toEqual(helloWithABuild);
  });

  const scenariosOfTheBuildId = [
    // An older server, or one started with no build-id.json, names no build.
    { name: 'accepts a hello that names no build', buildId: undefined, isAccepted: true },
    // An empty id would compare as "another build" against every page.
    { name: 'refuses a hello naming an empty build', buildId: '', isAccepted: false },
    // A number is no build id the pages could ever embed.
    { name: 'refuses a build id that is not text', buildId: 20261019, isAccepted: false },
  ];

  it.each(scenariosOfTheBuildId)('$name', ({ buildId, isAccepted }) => {
    // Arrange: a hello with the row's build id (or none).
    const hello =
      buildId === undefined
        ? { type: 'hello', slices: buildEverySliceEmpty() }
        : { type: 'hello', slices: buildEverySliceEmpty(), buildId };

    // Act: check the message.
    const result = ServerMessageSchema.safeParse(hello);

    // Assert: accepted or refused as the row says.
    expect(result.success, 'the build id must be judged as the row says').toBe(isAccepted);
  });
});
