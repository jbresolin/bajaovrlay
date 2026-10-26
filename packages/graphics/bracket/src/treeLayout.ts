/**
 * Where the tree draws its matches and lines, in pixels of the stage under the head (the
 * design's slateSteps.mjs, catalogue entry 4). The rounds share the stage's width, with a
 * gap between them for the lines; a round's matches share the height under the name pills,
 * each centred in its share, so a match sits centred between the two it comes from. Each
 * line leaves a match at its middle, turns half way across the gap and enters the match it
 * feeds at that match's middle. The third place stands at the foot of the final's column.
 *
 * Pure: the sizes come in as numbers (the graphic reads them from the theme's tokens), so
 * the geometry is tested on its own. Every position is a whole pixel.
 */

/** The theme's sizes the layout needs, in pixels. */
export type TreeGeometry = {
  stageWidthPx: number;
  stageHeightPx: number;
  /** Between two columns: the room the lines turn in. */
  columnGapPx: number;
  /** Above the matches: the name pill's height and the gap under it. */
  roundNameRoomPx: number;
  /** One car of a match. */
  carRowHeightPx: number;
  /** Between the two cars of a match. */
  carRowGapPx: number;
};

/** One match of a column: its top and its middle (where its lines meet it). */
export type PlacedTreeMatch = {
  columnIndex: number;
  matchIndex: number;
  topPx: number;
  middlePx: number;
};

/** One column (a round): where it stands, and its matches. */
export type PlacedTreeColumn = {
  columnIndex: number;
  leftPx: number;
  widthPx: number;
  matches: PlacedTreeMatch[];
};

/** A point of a line. */
export type TreePoint = { xPx: number; yPx: number };

/** A line from a match to the one it feeds: four points, out, across, along, in. */
export type TreeLine = { intoColumnIndex: number; points: TreePoint[] };

/** The third place's match and its name pill. */
export type PlacedThirdPlace = {
  leftPx: number;
  widthPx: number;
  topPx: number;
  nameTopPx: number;
};

/** The whole tree. */
export type TreeLayout = {
  columns: PlacedTreeColumn[];
  lines: TreeLine[];
  thirdPlace: PlacedThirdPlace | undefined;
  matchHeightPx: number;
};

/**
 * How many columns the tree keeps: the rounds its first round implies (4 matches lead to 2,
 * then 1: three columns), or the rounds listed when there are more. Keeping room for the
 * rounds to come means a round being listed later never moves what is on screen.
 */
export function countColumnsOfTree(
  firstRoundMatchCount: number,
  listedColumnCount: number,
): number {
  if (listedColumnCount === 0) {
    return 0;
  }
  let impliedColumnCount = 1;
  let matchesInThisColumn = firstRoundMatchCount;
  while (matchesInThisColumn > 1) {
    matchesInThisColumn = Math.ceil(matchesInThisColumn / 2);
    impliedColumnCount += 1;
  }
  return Math.max(impliedColumnCount, listedColumnCount);
}

/**
 * Lays out the tree: `matchCounts` holds the matches of each column listed, first first;
 * `columnCount` (countColumnsOfTree) may keep more columns than listed, which stay empty.
 */
export function layOutBracketTree(
  matchCounts: number[],
  columnCount: number,
  hasThirdPlace: boolean,
  geometry: TreeGeometry,
): TreeLayout {
  const matchHeightPx = geometry.carRowHeightPx * 2 + geometry.carRowGapPx;
  const columnWidthPx =
    columnCount === 0
      ? 0
      : Math.round(
          (geometry.stageWidthPx - geometry.columnGapPx * (columnCount - 1)) / columnCount,
        );

  const columns: PlacedTreeColumn[] = [];
  for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
    const matchCount = matchCounts[columnIndex] ?? 0;
    columns.push({
      columnIndex,
      leftPx: columnIndex * (columnWidthPx + geometry.columnGapPx),
      widthPx: columnWidthPx,
      matches: placeMatchesOfColumn(columnIndex, matchCount, matchHeightPx, geometry),
    });
  }

  const finalColumn = columns.at(-1);
  const thirdPlaceTopPx = geometry.stageHeightPx - matchHeightPx;
  const thirdPlace =
    hasThirdPlace && finalColumn !== undefined
      ? {
          leftPx: finalColumn.leftPx,
          widthPx: finalColumn.widthPx,
          topPx: thirdPlaceTopPx,
          nameTopPx: thirdPlaceTopPx - geometry.roundNameRoomPx,
        }
      : undefined;

  return { columns, lines: drawLinesBetweenColumns(columns, geometry), thirdPlace, matchHeightPx };
}

/** A column's matches, each centred in its share of the height under the name pills. */
function placeMatchesOfColumn(
  columnIndex: number,
  matchCount: number,
  matchHeightPx: number,
  geometry: TreeGeometry,
): PlacedTreeMatch[] {
  const shareHeightPx =
    (geometry.stageHeightPx - geometry.roundNameRoomPx) / Math.max(1, matchCount);
  const matches: PlacedTreeMatch[] = [];
  for (let matchIndex = 0; matchIndex < matchCount; matchIndex += 1) {
    const shareTopPx = geometry.roundNameRoomPx + matchIndex * shareHeightPx;
    const topPx = Math.round(shareTopPx + (shareHeightPx - matchHeightPx) / 2);
    matches.push({
      columnIndex,
      matchIndex,
      topPx,
      middlePx: topPx + Math.round(matchHeightPx / 2),
    });
  }
  return matches;
}

/**
 * The lines from each match to the match it feeds in the next column (match 1 and 2 feed
 * the next column's 1, 3 and 4 its 2…); none into a column with no match listed yet.
 */
function drawLinesBetweenColumns(columns: PlacedTreeColumn[], geometry: TreeGeometry): TreeLine[] {
  const lines: TreeLine[] = [];
  for (let columnIndex = 0; columnIndex < columns.length - 1; columnIndex += 1) {
    const column = columns[columnIndex];
    const nextColumn = columns[columnIndex + 1];
    if (column === undefined || nextColumn === undefined) {
      continue;
    }
    const xOutPx = column.leftPx + column.widthPx;
    const xTurnPx = xOutPx + geometry.columnGapPx / 2;
    for (const match of column.matches) {
      const fedMatch = nextColumn.matches[Math.floor(match.matchIndex / 2)];
      if (fedMatch === undefined) {
        continue;
      }
      lines.push({
        intoColumnIndex: nextColumn.columnIndex,
        points: [
          { xPx: xOutPx, yPx: match.middlePx },
          { xPx: xTurnPx, yPx: match.middlePx },
          { xPx: xTurnPx, yPx: fedMatch.middlePx },
          { xPx: nextColumn.leftPx, yPx: fedMatch.middlePx },
        ],
      });
    }
  }
  return lines;
}
