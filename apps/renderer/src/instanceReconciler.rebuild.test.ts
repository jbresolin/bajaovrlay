/**
 * Deciding how to rebuild the whole stage (apps/renderer)
 *
 * What this module is for:
 *   Every time the renderer connects (OBS reloading the browser source, or the server
 *   coming back after a restart) the server's `hello` is the whole truth. The renderer
 *   cannot know what it missed, so it throws away what it drew and builds the stage again
 *   from the hello. decideRebuildOperations answers how, layer by layer, without touching
 *   the page.
 *
 * What these tests prove:
 *   - Everything drawn before is disposed at once (no out-animation), and everything on
 *     air now is loaded with its in-animation skipped, so the viewers see no replay.
 *   - Even an instance that did not change is disposed and loaded again.
 *   - Instances on the `preview` output are left out by the page that draws `program`.
 *
 * What these tests deliberately do not cover:
 *   - The rebuild of a page that draws the `preview` output;
 *     instanceReconciler.preview.test.ts.
 *   - Ordinary changes between two slices (take, update, replace, clear);
 *     instanceReconciler.test.ts covers those.
 *   - The calls made on the graphics during a rebuild; e2e/lifecycle.e2e.ts checks them
 *     in a real browser.
 */
import { describe, expect, it } from 'vitest';

import { decideRebuildOperations } from './instanceReconciler.js';
import {
  createEnduroClockInstance,
  createFinalClockInstance,
  createTeamLowerThirdInstance,
  enduroClockInstanceId,
  ufprLowerThirdInstanceId,
} from './instancesOnAir.testSupport.js';

describe('decideRebuildOperations', () => {
  it('disposes what was drawn and loads what is on air with the animation skipped', () => {
    // Arrange: the enduro clock was drawn before the connection dropped; when it came
    // back, the server says the final clock and a lower third are on air.
    const instancesDrawnBeforeTheDrop = [createEnduroClockInstance()];
    const instancesOnAirNow = [
      createFinalClockInstance(),
      createTeamLowerThirdInstance(ufprLowerThirdInstanceId, 42, 'Baja UFPR'),
    ];

    // Act: ask how to rebuild the stage.
    const layerOperations = decideRebuildOperations({
      previousInstances: instancesDrawnBeforeTheDrop,
      nextInstances: instancesOnAirNow,
      drawnOutput: 'program',
    });

    // Assert: the old clock goes at once, and both graphics appear without animating in.
    expect(
      layerOperations,
      'a rebuild must dispose everything local, then load each on-air instance with skipAnimation',
    ).toEqual([
      {
        layerId: 'clock',
        operations: [
          { kind: 'disposeAtOnce', instanceId: enduroClockInstanceId },
          { kind: 'loadAndPlay', instance: createFinalClockInstance(), skipAnimation: true },
        ],
      },
      {
        layerId: 'lower-third',
        operations: [
          {
            kind: 'loadAndPlay',
            instance: createTeamLowerThirdInstance(ufprLowerThirdInstanceId, 42, 'Baja UFPR'),
            skipAnimation: true,
          },
        ],
      },
    ]);
  });

  it('rebuilds the same instance too, because the page may have lost it', () => {
    // Arrange: the same clock before and after; nothing changed on the server.
    const instancesBeforeAndAfter = [createEnduroClockInstance()];

    // Act: ask how to rebuild the stage.
    const layerOperations = decideRebuildOperations({
      previousInstances: instancesBeforeAndAfter,
      nextInstances: instancesBeforeAndAfter,
      drawnOutput: 'program',
    });

    // Assert: it is disposed and loaded again; a rebuild never assumes what is drawn.
    expect(
      layerOperations,
      'a rebuild must reload an unchanged instance instead of trusting the page',
    ).toEqual([
      {
        layerId: 'clock',
        operations: [
          { kind: 'disposeAtOnce', instanceId: enduroClockInstanceId },
          { kind: 'loadAndPlay', instance: createEnduroClockInstance(), skipAnimation: true },
        ],
      },
    ]);
  });

  it('leaves preview instances out of a rebuild', () => {
    // Arrange: only a rehearsal clock exists, on the preview output.
    const rehearsalOnly = [createEnduroClockInstance({ target: 'preview' })];

    // Act: ask how to rebuild the stage.
    const layerOperations = decideRebuildOperations({
      previousInstances: [],
      nextInstances: rehearsalOnly,
      drawnOutput: 'program',
    });

    // Assert: nothing to do; /render/ draws the program output only.
    expect(layerOperations, 'a preview instance must never be drawn on /render/').toEqual([]);
  });
});
