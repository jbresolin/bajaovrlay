/**
 * Where a graphic sits in a corner of the screen (packages/graphics/kit)
 *
 * What this module is for:
 *   The channel logo (BAJAOVRLAY-63) is drawn in the corner the operator picks, and the
 *   plain sponsor roll and the match bug will be too. Each corner is two edges of the
 *   title-safe area the other graphics already keep (the theme's --stage-safe-top,
 *   --stage-safe-bottom and --stage-safe-side), written once here as the CSS offsets of an
 *   absolutely placed box.
 *
 * What these tests prove:
 *   - Each of the four corners is held by its two safe-area edges, and the other two
 *     offsets are `auto`, so the box keeps its own size instead of being stretched.
 *   - The corners are exactly the four the item form offers, in the form's order, and the
 *     data check takes those four and refuses anything else (a fifth position, a typo).
 *
 * What these tests deliberately do not cover:
 *   - Where the box lands on a real page; the logo bug's screenshots measure that in
 *     Chromium with the theme's tokens.
 *   - The pt-BR names of the corners; each graphic's manifest carries them for its form.
 */
import { describe, expect, it } from 'vitest';

import {
  describeScreenCornerPosition,
  screenCorners,
  ScreenCornerSchema,
} from './screenCornerPosition.js';

const cornerScenarios = [
  // The sponsor bug's corner: top edge and left side of the safe area.
  {
    corner: 'top-left',
    expected: {
      top: 'var(--stage-safe-top)',
      right: 'auto',
      bottom: 'auto',
      left: 'var(--stage-safe-side)',
    },
  },
  // The clock's corner: top edge and right side.
  {
    corner: 'top-right',
    expected: {
      top: 'var(--stage-safe-top)',
      right: 'var(--stage-safe-side)',
      bottom: 'auto',
      left: 'auto',
    },
  },
  // Above the bars along the bottom: the bottom edge the bars keep, and the left side.
  {
    corner: 'bottom-left',
    expected: {
      top: 'auto',
      right: 'auto',
      bottom: 'var(--stage-safe-bottom)',
      left: 'var(--stage-safe-side)',
    },
  },
  // Where a broadcaster's watermark usually goes: bottom edge and right side.
  {
    corner: 'bottom-right',
    expected: {
      top: 'auto',
      right: 'var(--stage-safe-side)',
      bottom: 'var(--stage-safe-bottom)',
      left: 'auto',
    },
  },
] as const;

describe('describeScreenCornerPosition', () => {
  it.each(cornerScenarios)(
    'holds the $corner corner by its two safe-area edges',
    ({ corner, expected }) => {
      // Arrange: the corner comes from the scenario row above.

      // Act: ask for its offsets.
      const offsets = describeScreenCornerPosition(corner);

      // Assert: two safe-area tokens and two autos, as the row says.
      expect(offsets, `the ${corner} corner must sit on its two safe-area edges`).toEqual(expected);
    },
  );
});

describe('the four corners', () => {
  it('lists the four corners in the order the item form offers them', () => {
    // Arrange: nothing; the list is the module's own.

    // Act: read it.
    const cornersOffered = [...screenCorners];

    // Assert: top before bottom, left before right.
    expect(cornersOffered, 'the form must offer the four corners in reading order').toEqual([
      'top-left',
      'top-right',
      'bottom-left',
      'bottom-right',
    ]);
  });

  it('takes each of the four corners and refuses a fifth position or a typo', () => {
    // Arrange: the four corners, a centre the brief leaves out, and a typo.
    const positionsToCheck = [...screenCorners, 'bottom-center', 'top_left'];

    // Act: check each one.
    const isTakenByPosition = Object.fromEntries(
      positionsToCheck.map((position) => [
        position,
        ScreenCornerSchema.safeParse(position).success,
      ]),
    );

    // Assert: the four corners pass, the other two do not.
    expect(isTakenByPosition, 'only the four corners are positions').toEqual({
      'top-left': true,
      'top-right': true,
      'bottom-left': true,
      'bottom-right': true,
      'bottom-center': false,
      top_left: false,
    });
  });
});
