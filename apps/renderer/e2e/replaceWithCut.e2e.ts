/**
 * Replacing a graphic with a cut (apps/renderer, Playwright)
 *
 * What this module is for:
 *   A layer whose replace policy is `cut` swaps one graphic for the next in an instant.
 *   The new graphic's code may take a moment to load, and during that moment the viewer
 *   must keep seeing the old graphic, never an empty layer. So the renderer loads the new
 *   graphic first, hidden, behind the old one; only when it is loaded does it stop and
 *   dispose the old one and play the new one, both without animation. A `crossfade` layer
 *   is treated the same way for now.
 *
 * What these tests prove, once on a cut layer and once on a crossfade layer, in Chromium
 * and with a graphic whose every call takes 100 ms:
 *   - The new graphic's load has finished before the old graphic's stop is called, and
 *     the old graphic's dispose has finished before the new graphic's play is called.
 *   - The old graphic is stopped, and the new one played, with `skipAnimation: true`.
 *   - Frame by frame, the layer showed: the old graphic alone, then the old graphic
 *     visible with the new one hidden behind it, then the new graphic alone and visible.
 *     At no frame was the layer empty or holding only a hidden graphic.
 *
 * What these tests deliberately do not cover:
 *   - The `out-then-in` policy, where an empty layer between the two graphics is the
 *     design; lifecycle.e2e.ts.
 *   - A cut whose new graphic fails to load (the old one still leaves the air);
 *     src/instancePlayer.replace.test.ts.
 *   - What the graphic itself draws between its load and its play: a graphic that shows
 *     nothing until it is played leaves the layer blank for the instant between the old
 *     graphic's stop and its own play, and the renderer cannot see that.
 *   - A real crossfade, with both graphics visible at once.
 */
import { expect, test } from '@playwright/test';

import {
  makeFakeGraphicCallsTake,
  readFakeGraphicCallsAsSentences,
  readParamsOfCalls,
} from './fakeGraphicCalls.js';
import { openRendererAndWaitForItsLayers, startFakeServerForPage } from './fakeServerForPage.js';
import {
  createTeamInstanceOnLayer,
  feiInstanceId,
  instanceNames,
  ufprInstanceId,
} from './instancesOnTheFakeServer.js';
import { readWhatLayerShowed, watchWhatEachLayerShows } from './whatEachLayerShowed.js';

const callsOfTheFirstTake = [
  'UFPR: load called',
  'UFPR: load finished',
  'UFPR: playAction called',
  'UFPR: playAction finished',
];

const callsOfTheCut = [
  'FEI: load called',
  'FEI: load finished',
  'UFPR: stopAction called',
  'UFPR: stopAction finished',
  'UFPR: dispose called',
  'UFPR: dispose finished',
  'FEI: playAction called',
  'FEI: playAction finished',
];

const layersThatCutScenarios = [
  // The lower-third layer cuts: the swap is instant by design.
  {
    name: 'cut: the new graphic is loaded before the old one is disposed, and the layer is never empty',
    layerId: 'lower-third',
  },
  // The fullscreen layer crossfades. A real crossfade needs both graphics visible at
  // once, which no graphic is built for yet, so it must behave exactly like cut.
  {
    name: 'crossfade: behaves exactly like cut',
    layerId: 'fullscreen',
  },
];

test.describe('replacing a graphic on a layer that cuts', () => {
  for (const { name, layerId } of layersThatCutScenarios) {
    test(name, async ({ page }) => {
      // Arrange: every call of the graphic takes 100 ms, so each step lasts several
      // frames; the layers are watched frame by frame; team 42's graphic is on air on
      // the layer of this row.
      await makeFakeGraphicCallsTake(page, 100);
      await watchWhatEachLayerShows(page);
      const fakeServer = await startFakeServerForPage(page, { instancesOnAir: [] });
      await openRendererAndWaitForItsLayers(page);
      fakeServer.sendInstances([
        createTeamInstanceOnLayer(layerId, ufprInstanceId, 42, 'Baja UFPR'),
      ]);
      await expect
        .poll(() => readFakeGraphicCallsAsSentences(page, instanceNames), {
          message: "team 42's graphic must be on air first",
        })
        .toEqual(callsOfTheFirstTake);

      // Act: the operator takes team 7's graphic on the same layer.
      fakeServer.sendInstances([createTeamInstanceOnLayer(layerId, feiInstanceId, 7, 'FEI Baja')]);

      // Assert: the new graphic finished loading before the old one was touched, the old
      // one was gone before the new one was played, both animations were skipped, and
      // frame by frame the layer always showed a visible graphic.
      await expect
        .poll(() => readFakeGraphicCallsAsSentences(page, instanceNames), {
          message:
            'the new graphic must be loaded first, then the old one stopped and disposed, then the new one played',
        })
        .toEqual([...callsOfTheFirstTake, ...callsOfTheCut]);
      expect(
        await readParamsOfCalls(page, ufprInstanceId, 'stopAction'),
        'on this layer the old graphic must stop without its out-animation',
      ).toEqual([{ skipAnimation: true }]);
      expect(
        await readParamsOfCalls(page, feiInstanceId, 'playAction'),
        'on this layer the new graphic must play without its in-animation',
      ).toEqual([{ goto: 0, skipAnimation: true }]);
      expect(
        await readWhatLayerShowed(page, layerId, instanceNames),
        'after the first take, every frame must show a visible graphic: the old one until the new one is loaded, then the new one',
      ).toEqual(['nothing', 'UFPR visible', 'UFPR visible + FEI hidden', 'FEI visible']);
    });
  }
});
