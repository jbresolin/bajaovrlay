/**
 * Where the tree draws its matches and lines (packages/graphics/bracket)
 *
 * What this module is for:
 *   The last rounds of a bracket (the quarter-finals down) are drawn as a tree: one column
 *   per round under its name pill, the rounds sharing the stage's width with a gap for the
 *   lines, each round's matches sharing the height so that every match sits centred between
 *   the two it comes from, and a line from each match to the one it feeds. The third place
 *   sits at the foot of the final's column. layOutBracketTree works all of it out in pixels
 *   of the stage, from the counts of matches and the theme's sizes; it is pure, so these
 *   tests check the geometry itself, which jsdom cannot lay out.
 *
 * What these tests prove:
 *   - With Ardósia's sizes (a 1728 × 900 stage, 96 px between rounds, 48 px car rows), the
 *     three columns of the quarter-finals, semifinals and final stand where bracket-passo-7
 *     draws them: 512 px wide at x 0, 608 and 1216; the first quarter-final at y 98.
 *   - Every match after the first column is centred between the two it comes from.
 *   - Each line leaves a match's right edge at its middle, turns half way across the gap,
 *     and enters the match it feeds at that match's middle.
 *   - The third place stands at the foot of the final's column, its name pill above it.
 *   - The tree keeps room for the rounds still to come (a quarter-final alone is drawn at
 *     its final width), so nothing on screen moves when the next round is listed; it never
 *     draws lines into a round that is not there.
 *   - countColumnsOfTree reserves the rounds a first round implies: 4 matches, 3 columns.
 *
 * What these tests deliberately do not cover:
 *   - Which rounds are the tree's (bracketSteps.test.ts in shared) and drawing the layout
 *     (bracketView.test.ts).
 */
import { describe, expect, it } from 'vitest';

import { countColumnsOfTree, layOutBracketTree, type TreeGeometry } from './treeLayout.js';

/** Ardósia's sizes for the tree, as packages/theme/ardosia/tokens.css declares them. */
const ardosiaTreeGeometry: TreeGeometry = {
  stageWidthPx: 1728,
  stageHeightPx: 900,
  columnGapPx: 96,
  roundNameRoomPx: 32 + 8,
  carRowHeightPx: 48,
  carRowGapPx: 3,
};

describe('layOutBracketTree', () => {
  it('stands the quarter-finals, semifinals and final where bracket-passo-7 draws them', () => {
    // Arrange: the real Super Prime's tree: 4, 2 and 1 matches.

    // Act: lay it out.
    const layout = layOutBracketTree([4, 2, 1], 3, false, ardosiaTreeGeometry);

    // Assert: the columns' places and widths, and the first column's tops.
    expect(
      layout.columns.map((column) => ({ leftPx: column.leftPx, widthPx: column.widthPx })),
      'three columns of 512 px, 96 px apart',
    ).toEqual([
      { leftPx: 0, widthPx: 512 },
      { leftPx: 608, widthPx: 512 },
      { leftPx: 1216, widthPx: 512 },
    ]);
    expect(
      layout.columns[0]?.matches.map((match) => match.topPx),
      'the quarter-finals spread over the height under the name pills',
    ).toEqual([98, 313, 528, 743]);
    expect(layout.matchHeightPx, 'a match is two 48 px rows and the 3 px gap').toBe(99);
  });

  it('centres every match between the two it comes from', () => {
    // Arrange: a tree from the quarter-finals.
    const layout = layOutBracketTree([4, 2, 1], 3, false, ardosiaTreeGeometry);

    // Act: for every match after the first column, the middles of its two sources.
    const offCentreByPx = layout.columns.slice(1).flatMap((column) =>
      column.matches.map((match) => {
        const sources = layout.columns[column.columnIndex - 1]?.matches ?? [];
        const fromFirst = sources[match.matchIndex * 2]?.middlePx ?? Number.NaN;
        const fromSecond = sources[match.matchIndex * 2 + 1]?.middlePx ?? Number.NaN;
        return Math.abs(match.middlePx - (fromFirst + fromSecond) / 2);
      }),
    );

    // Assert: within the half pixel a whole-pixel layout rounds away.
    expect(
      offCentreByPx.every((distance) => distance <= 0.5),
      'each match must sit centred between its two sources',
    ).toBe(true);
  });

  it('draws each line from the middle of a match to the middle of the one it feeds, turning half way', () => {
    // Arrange: a tree from the quarter-finals.
    const layout = layOutBracketTree([4, 2, 1], 3, false, ardosiaTreeGeometry);

    // Act: take the line from the first quarter-final.
    const firstLine = layout.lines[0];

    // Assert: six lines in all; the first out of the quarter-final's right edge at its middle,
    // across to x 560 (half the gap), down to the semifinal's middle, into its left edge.
    expect(layout.lines, 'one line per match before the final').toHaveLength(6);
    expect(firstLine, 'the first line runs into the semifinals').toEqual({
      intoColumnIndex: 1,
      points: [
        { xPx: 512, yPx: 148 },
        { xPx: 560, yPx: 148 },
        { xPx: 560, yPx: 256 },
        { xPx: 608, yPx: 256 },
      ],
    });
  });

  it('stands the third place at the foot of the final’s column, under its own name pill', () => {
    // Arrange: the same tree, with a third place.

    // Act: lay it out.
    const layout = layOutBracketTree([4, 2, 1], 3, true, ardosiaTreeGeometry);

    // Assert: in the final's column, on the stage's bottom edge, the name 40 px above.
    expect(layout.thirdPlace, 'the third place under the final').toEqual({
      leftPx: 1216,
      widthPx: 512,
      topPx: 801,
      nameTopPx: 761,
    });
  });

  it('keeps room for the rounds to come, and draws no line into a round not listed', () => {
    // Arrange: only the quarter-finals are listed, in a tree of three columns.

    // Act: lay it out.
    const layout = layOutBracketTree([4], 3, false, ardosiaTreeGeometry);

    // Assert: the quarter-finals already at their final width and tops; nothing else.
    expect(layout.columns[0], 'the quarter-finals where they will stay').toMatchObject({
      leftPx: 0,
      widthPx: 512,
    });
    expect(
      layout.columns[0]?.matches.map((match) => match.topPx),
      'the same tops as in the whole tree',
    ).toEqual([98, 313, 528, 743]);
    expect(layout.lines, 'no line runs into a round that is not there').toEqual([]);
  });
});

describe('countColumnsOfTree', () => {
  const columnScenarios = [
    // The quarter-finals imply semifinals and a final.
    {
      name: 'reserves 3 columns for a tree that starts at the quarter-finals',
      first: 4,
      listed: 1,
      expected: 3,
    },
    // Semifinals imply a final.
    {
      name: 'reserves 2 columns for a tree that starts at the semifinals',
      first: 2,
      listed: 1,
      expected: 2,
    },
    // A final alone is one column.
    { name: 'gives a final alone one column', first: 1, listed: 1, expected: 1 },
    // Three matches (an odd draw) still lead to a final in two more rounds.
    {
      name: 'reserves 3 columns for a first tree round of three matches',
      first: 3,
      listed: 1,
      expected: 3,
    },
    // A source listing more rounds than implied keeps them all.
    { name: 'never gives fewer columns than the rounds listed', first: 1, listed: 2, expected: 2 },
    // No tree round at all: no tree.
    { name: 'gives no column when no round is the tree’s', first: 0, listed: 0, expected: 0 },
  ];

  it.each(columnScenarios)('$name', ({ first, listed, expected }) => {
    // Arrange: the row's first tree round and the rounds listed.

    // Act: count the columns.
    const columnCount = countColumnsOfTree(first, listed);

    // Assert: the row's count.
    expect(columnCount, 'the tree must keep this many columns').toBe(expected);
  });
});
