/**
 * Where the image's box sits for each of the nine positions (packages/graphics/image)
 *
 * What this module is for:
 *   imageBoxPosition.ts turns the item's "Posição" (one of nine anchors on the canvas's
 *   edges and centre lines) and its two offsets into the CSS that places the box: which
 *   edges hold it, how far, whether it is pulled back by half its size to be centred, and
 *   which side of a fitted picture touches the anchor.
 *
 * What these tests prove:
 *   - Each of the nine anchors with no offset: a corner sits on the canvas's own corner
 *     (0 px from both edges, not the safe area), an edge's middle is centred along that
 *     edge, and the centre is centred both ways.
 *   - A positive offset always moves the box right and down, whichever edge holds it; a
 *     negative one left and up; a centred box keeps its half-size pull-back.
 *   - An offset of 0 is written "0px", never "-0px", for a box held by the right or bottom.
 *
 * What these tests deliberately do not cover:
 *   - Where the box lands in a real browser; e2e/imagePlacement.e2e.ts measures it for
 *     several anchors and offsets.
 */
import { describe, expect, it } from 'vitest';

import { describeImageBoxPosition, imageAnchors } from './imageBoxPosition.js';

const anchorScenarios = [
  // The canvas's own corner, so offsets read as plain canvas pixels.
  {
    anchor: 'top-left',
    expected: {
      top: '0px',
      right: 'auto',
      bottom: 'auto',
      left: '0px',
      translate: '0px 0px',
      objectPosition: 'left top',
    },
  },
  // Centred across the top edge: half the box pulled back to the left.
  {
    anchor: 'top-center',
    expected: {
      top: '0px',
      right: 'auto',
      bottom: 'auto',
      left: 'calc(50% + 0px)',
      translate: '-50% 0px',
      objectPosition: 'center top',
    },
  },
  // Held by the right edge, so its own width never needs knowing.
  {
    anchor: 'top-right',
    expected: {
      top: '0px',
      right: '0px',
      bottom: 'auto',
      left: 'auto',
      translate: '0px 0px',
      objectPosition: 'right top',
    },
  },
  // Centred down the left edge.
  {
    anchor: 'middle-left',
    expected: {
      top: 'calc(50% + 0px)',
      right: 'auto',
      bottom: 'auto',
      left: '0px',
      translate: '0px -50%',
      objectPosition: 'left center',
    },
  },
  // The default: the middle of the canvas, both ways.
  {
    anchor: 'middle-center',
    expected: {
      top: 'calc(50% + 0px)',
      right: 'auto',
      bottom: 'auto',
      left: 'calc(50% + 0px)',
      translate: '-50% -50%',
      objectPosition: 'center center',
    },
  },
  // Centred down the right edge.
  {
    anchor: 'middle-right',
    expected: {
      top: 'calc(50% + 0px)',
      right: '0px',
      bottom: 'auto',
      left: 'auto',
      translate: '0px -50%',
      objectPosition: 'right center',
    },
  },
  // Held by the bottom edge.
  {
    anchor: 'bottom-left',
    expected: {
      top: 'auto',
      right: 'auto',
      bottom: '0px',
      left: '0px',
      translate: '0px 0px',
      objectPosition: 'left bottom',
    },
  },
  // Centred along the bottom edge.
  {
    anchor: 'bottom-center',
    expected: {
      top: 'auto',
      right: 'auto',
      bottom: '0px',
      left: 'calc(50% + 0px)',
      translate: '-50% 0px',
      objectPosition: 'center bottom',
    },
  },
  // The canvas's bottom-right corner.
  {
    anchor: 'bottom-right',
    expected: {
      top: 'auto',
      right: '0px',
      bottom: '0px',
      left: 'auto',
      translate: '0px 0px',
      objectPosition: 'right bottom',
    },
  },
] as const;

describe('describeImageBoxPosition with no offset', () => {
  it('has one scenario per anchor the form offers, so none is left untested', () => {
    // Arrange: the anchors the scenarios cover.
    const anchorsTested = anchorScenarios.map((scenario) => scenario.anchor);

    // Act: compare with the anchors the module offers.
    const anchorsOffered = [...imageAnchors];

    // Assert: the same nine, in the same order.
    expect(anchorsTested, 'every anchor must have its own row below').toEqual(anchorsOffered);
  });

  it.each(anchorScenarios)('places the box on the $anchor point of the canvas', (scenario) => {
    // Arrange: the anchor of this row, and no offset.
    const anchor = scenario.anchor;

    // Act: describe the box's CSS.
    const placement = describeImageBoxPosition(anchor, 0, 0);

    // Assert: the edges, the centring and the picture's side the row expects.
    expect(placement, `the ${anchor} box must sit on that point of the canvas`).toEqual(
      scenario.expected,
    );
  });
});

describe('describeImageBoxPosition with offsets', () => {
  it('moves a top-left box right and down by positive offsets', () => {
    // Arrange: an event poster 120 px in from the left and 40 px down.
    const offsets = { x: 120, y: 40 };

    // Act: describe the box's CSS.
    const placement = describeImageBoxPosition('top-left', offsets.x, offsets.y);

    // Assert: the left and top edges hold it that far in.
    expect(
      { left: placement.left, top: placement.top },
      'positive offsets move a top-left box right and down',
    ).toEqual({ left: '120px', top: '40px' });
  });

  it('moves a bottom-right box left and up by negative offsets, held by the same edges', () => {
    // Arrange: a sponsor's banner pulled 96 px in from the right and 54 px up.
    const offsets = { x: -96, y: -54 };

    // Act: describe the box's CSS.
    const placement = describeImageBoxPosition('bottom-right', offsets.x, offsets.y);

    // Assert: further from the right and bottom edges, which still hold it.
    expect(
      { right: placement.right, bottom: placement.bottom, left: placement.left },
      'negative offsets move a bottom-right box left and up',
    ).toEqual({ right: '96px', bottom: '54px', left: 'auto' });
  });

  it('moves a bottom-right box past the canvas edge by positive offsets', () => {
    // Arrange: the operator pushes the picture 30 px off the right edge and 10 px below.
    const offsets = { x: 30, y: 10 };

    // Act: describe the box's CSS.
    const placement = describeImageBoxPosition('bottom-right', offsets.x, offsets.y);

    // Assert: negative distances from the edges, which is what "past the edge" is in CSS.
    expect(
      { right: placement.right, bottom: placement.bottom },
      'a positive offset still moves right and down, past the edge when the operator asks',
    ).toEqual({ right: '-30px', bottom: '-10px' });
  });

  it('moves a centred box by its offsets and keeps it centred on that point', () => {
    // Arrange: the centre of the canvas, 200 px to the left and 100 px down.
    const offsets = { x: -200, y: 100 };

    // Act: describe the box's CSS.
    const placement = describeImageBoxPosition('middle-center', offsets.x, offsets.y);

    // Assert: the centre point moved, and the half-size pull-back kept.
    expect(
      { left: placement.left, top: placement.top, translate: placement.translate },
      'a centred box moves its centre point and stays centred on it',
    ).toEqual({ left: 'calc(50% + -200px)', top: 'calc(50% + 100px)', translate: '-50% -50%' });
  });
});
