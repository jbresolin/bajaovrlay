/**
 * The stage of a preview page (packages/graphics/kit)
 *
 * What this module is for:
 *   Every graphic's preview page paints a stage behind the graphic: the footage stand-in,
 *   or, with `?stage=grey|black`, the design's two screenshot backgrounds, which the
 *   screenshot tests shoot on. The three new graphics of BAJAOVRLAY-24 had a copy each and
 *   the copies had drifted (one answered "gradient"), so the rule lives here once.
 *
 * What these tests prove:
 *   - `?stage=grey` and `?stage=black` give those stages, also beside `?data=`.
 *   - No `?stage=`, or one the page does not know, gives the footage stand-in.
 *
 * What these tests deliberately do not cover:
 *   - The colours painted; each preview.html holds them.
 */
import { describe, expect, it } from 'vitest';

import { choosePreviewStage } from './previewStage.js';

describe('choosePreviewStage', () => {
  const stageScenarios = [
    // The design's grey screenshot background.
    { name: 'chooses grey for ?stage=grey', addressQuery: '?stage=grey', expected: 'grey' },
    // The design's black screenshot background, read together with data.
    {
      name: 'chooses black for ?stage=black next to ?data=',
      addressQuery: '?data=%7B%7D&stage=black',
      expected: 'black',
    },
    // No stage asked: the footage stand-in every preview uses.
    { name: 'keeps the footage stand-in with no ?stage=', addressQuery: '', expected: 'footage' },
    // A stage the preview does not know is not an error, just the default.
    {
      name: 'keeps the footage stand-in for a stage it does not know',
      addressQuery: '?stage=verde',
      expected: 'footage',
    },
  ];

  it.each(stageScenarios)('$name', ({ addressQuery, expected }) => {
    // Arrange: the address query comes from the scenario row above.

    // Act: choose the stage.
    const stage = choosePreviewStage(addressQuery);

    // Assert: the stage the row expects.
    expect(stage, 'the stage must follow ?stage=, defaulting to the footage').toBe(expected);
  });
});
