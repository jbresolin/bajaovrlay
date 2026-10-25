// @vitest-environment node
/**
 * Two stacked layers for pages that turn in place (packages/graphics/kit)
 *
 * What this module is for:
 *   stackedPageLayers.ts plans which page each of a graphic's two layers holds when a page
 *   turns, when the list is edited on air, and after a stop. The sponsor roll and the
 *   intermission's sponsor line draw these plans; neither keeps a copy of the rules.
 *
 * What these tests prove:
 *   - A page index stays when it still exists and goes back to page 1 past a shrunk list.
 *   - A turn draws the next page on the other layer, names it on air during the turn, and
 *     makes the other layer the one on air after; the last page turns to page 1.
 *   - A redraw in place keeps the page on the layer on air (page 1 when the list shrank)
 *     and empties the other layer.
 *
 * What these tests deliberately do not cover:
 *   - The motion and the drawing; each graphic's component tests.
 */
import { describe, expect, it } from 'vitest';

import {
  keepPageIndexWithin,
  planLayersOnPageOne,
  planTheRedrawInPlace,
  planTheTurnToTheNextPage,
  type StackedPageLayers,
} from './stackedPageLayers.js';

describe('keepPageIndexWithin', () => {
  const pageIndexScenarios = [
    // Page 4 of a round that shrank to three pages: back to page 1.
    { name: 'goes back to page 1 past a shrunk list', pageIndex: 3, pageCount: 3, expected: 0 },
    // Page 2 is still there: it stays.
    { name: 'keeps a page that is still there', pageIndex: 1, pageCount: 3, expected: 1 },
  ];

  it.each(pageIndexScenarios)('$name', ({ pageIndex, pageCount, expected }) => {
    // Arrange: the page and the count of this row.

    // Act: keep the index within the round.
    const kept = keepPageIndexWithin(pageIndex, pageCount);

    // Assert: the page shown.
    expect(kept, 'never a page that is not there').toBe(expected);
  });
});

describe('planTheTurnToTheNextPage', () => {
  it('draws page 2 on the second layer and puts that layer on air after the turn', () => {
    // Arrange: page 1 of the 17's five pages, on the first layer.
    const onPageOne = planLayersOnPageOne();

    // Act: plan the turn.
    const turn = planTheTurnToTheNextPage(onPageOne, 5);

    // Assert: both pages drawn during the turn, page 2 named on air, the second layer on
    // air after.
    expect(turn, 'the turn from page 1 to page 2').toEqual({
      layerLeaving: 0,
      layerArriving: 1,
      layersDuringTheTurn: { pageIndexOfLayer: [0, 1], layerOnAir: 0, pageIndexOnAir: 1 },
      layersAfterTheTurn: { pageIndexOfLayer: [0, 1], layerOnAir: 1, pageIndexOnAir: 1 },
    });
  });

  it('turns from the last page back to page 1, on the first layer', () => {
    // Arrange: page 5 of five (Realização), on the second layer.
    const onTheLastPage: StackedPageLayers = {
      pageIndexOfLayer: [3, 4],
      layerOnAir: 1,
      pageIndexOnAir: 4,
    };

    // Act: plan the turn.
    const turn = planTheTurnToTheNextPage(onTheLastPage, 5);

    // Assert: page 1 arrives on the first layer.
    expect(turn.layersAfterTheTurn, 'back to page 1').toEqual({
      pageIndexOfLayer: [0, 4],
      layerOnAir: 0,
      pageIndexOnAir: 0,
    });
  });
});

describe('planTheRedrawInPlace', () => {
  const redrawScenarios = [
    // An edit that leaves the page there: it stays, on its layer.
    {
      name: 'keeps page 2 on the second layer when the list still has it',
      pageCount: 5,
      expected: { pageIndexOfLayer: [undefined, 1], layerOnAir: 1, pageIndexOnAir: 1 },
    },
    // The list shrank to one page under page 2: page 1, on the layer on air.
    {
      name: 'goes back to page 1 on the layer on air when the list shrank under it',
      pageCount: 1,
      expected: { pageIndexOfLayer: [undefined, 0], layerOnAir: 1, pageIndexOnAir: 0 },
    },
  ];

  it.each(redrawScenarios)('$name', ({ pageCount, expected }) => {
    // Arrange: page 2 on air on the second layer, page 1 still drawn on the first.
    const onPageTwo: StackedPageLayers = {
      pageIndexOfLayer: [0, 1],
      layerOnAir: 1,
      pageIndexOnAir: 1,
    };

    // Act: plan the redraw with the pages there are now.
    const redraw = planTheRedrawInPlace(onPageTwo, pageCount);

    // Assert: the page on air on its layer, the other layer empty.
    expect(redraw, 'the page drawn in place').toEqual(expected);
  });
});
