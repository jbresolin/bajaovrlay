/**
 * Standings animations, timed from the theme's tokens (packages/graphics/standings)
 *
 * What this module is for:
 *   standingsAnimations.ts builds the board's GSAP timelines as motion.md describes them:
 *   the head card, then `--motion-lead` later each column cascading from its top
 *   (`--motion-row-stagger` per piece, the columns side by side); everything out together;
 *   a page turn's lift-out together and its cascade back in. Every number is a token.
 *
 * What these tests prove:
 *   - The play-in of 20 rows lasts `--motion-in` + `--motion-lead` + 20 staggers (1100 ms
 *     with Ardósia's tokens, what the manifest promises), for the table and for three full
 *     columns alike; the stop-out and a turn's lift-out last `--motion-out`; a turn's
 *     cascade of 20 rows lasts `--motion-in` + 19 staggers.
 *   - When each piece starts: the head card at 0, the column head at `--motion-lead`, row n
 *     one stagger after the piece above; in columns, row n of every column at the same
 *     moment.
 *   - On a page without the theme every timeline lasts 0, so every action still ends.
 *
 * What these tests deliberately do not cover:
 *   - What the motion looks like; the Playwright tests run it in Chromium.
 *   - Reading the tokens; packages/theme tests readMotionTokens.
 */
import { describe, expect, it, onTestFinished } from 'vitest';

import {
  buildLiftOutTogetherTimeline,
  buildPageInTimeline,
  buildPlayInTimeline,
  type StandingsTimeline,
} from './standingsAnimations.js';
import {
  ardosiaMotionTokenDeclarations,
  placeTokensOnTheRoot,
} from './standingsOnThePage.testSupport.js';

/** A stand-in board on the page: a head card and `columnCount` columns of a head and `rowCount` rows. */
function createBoardPiecesInAnEmptyPage(columnCount: number, rowCount: number) {
  const board = document.createElement('section');
  const head = document.createElement('header');
  board.append(head);
  const cascades: HTMLElement[][] = [];
  for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
    const columnHead = document.createElement('header');
    const rows: HTMLElement[] = [];
    for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
      rows.push(document.createElement('li'));
    }
    board.append(columnHead, ...rows);
    cascades.push([columnHead, ...rows]);
  }
  document.body.append(board);
  onTestFinished(() => board.remove());
  return { board, head, cascades };
}

type BoardPieces = ReturnType<typeof createBoardPiecesInAnEmptyPage>;

/** When the tween moving `piece` starts in the timeline, in whole milliseconds. */
function readStartMsOfPiece(timeline: StandingsTimeline, piece: HTMLElement): number | undefined {
  const tweens = timeline.getChildren(false, true, false);
  const tweenOfPiece = tweens.find((tween) => tween.targets().includes(piece));
  if (tweenOfPiece === undefined) {
    return undefined;
  }
  return Math.round(tweenOfPiece.startTime() * 1000);
}

const timelineLengthScenarios = [
  // playAction on the table: the head, the column head at the lead, 20 rows a stagger apart.
  {
    name: 'the table’s play-in with 20 rows lasts in + lead + 20 staggers (1100 ms)',
    build: (pieces: BoardPieces) => buildPlayInTimeline(pieces.board, pieces.head, pieces.cascades),
    columnCount: 1,
    expectedMs: 1100,
  },
  // playAction on the columns board: three columns side by side last as long as one.
  {
    name: 'the columns’ play-in with 3 × 20 rows lasts the same 1100 ms',
    build: (pieces: BoardPieces) => buildPlayInTimeline(pieces.board, pieces.head, pieces.cascades),
    columnCount: 3,
    expectedMs: 1100,
  },
  // stopAction: everything together over --motion-out.
  {
    name: 'the lift-out of every piece together lasts --motion-out (250 ms)',
    build: (pieces: BoardPieces) =>
      buildLiftOutTogetherTimeline(pieces.board, [pieces.head, ...pieces.cascades.flat()]),
    columnCount: 1,
    expectedMs: 250,
  },
  // A table page turn's second half: the 20 rows alone, the first at once.
  {
    name: 'a turn’s cascade of 20 rows lasts in + 19 staggers (970 ms)',
    build: (pieces: BoardPieces) =>
      buildPageInTimeline(
        pieces.board,
        pieces.cascades.map((pieceList) => pieceList.slice(1)),
      ),
    columnCount: 1,
    expectedMs: 970,
  },
];

describe('standings timelines with the Ardósia tokens on the page', () => {
  it.each(timelineLengthScenarios)('$name', ({ build, columnCount, expectedMs }) => {
    // Arrange: the theme's motion tokens on :root and a board of 20-row columns.
    placeTokensOnTheRoot(ardosiaMotionTokenDeclarations);
    const pieces = createBoardPiecesInAnEmptyPage(columnCount, 20);

    // Act: build the timeline (paused; nothing moves) and measure it.
    const timeline = build(pieces);
    const timelineLengthMs = Math.round(timeline.duration() * 1000);
    timeline.kill();

    // Assert: it lasts exactly what the tokens add up to.
    expect(timelineLengthMs, 'the timeline must last exactly what its tokens say').toBe(expectedMs);
  });

  it('starts the head card at 0, the column head at the lead, and each row a stagger after the one above', () => {
    // Arrange: the theme's tokens and the table: one column of 20 rows.
    placeTokensOnTheRoot(ardosiaMotionTokenDeclarations);
    const pieces = createBoardPiecesInAnEmptyPage(1, 20);
    const [columnHead, firstRow, secondRow] = pieces.cascades[0] ?? [];

    // Act: build the play-in and read when the pieces start.
    const timeline = buildPlayInTimeline(pieces.board, pieces.head, pieces.cascades);
    const startsMs = {
      head: readStartMsOfPiece(timeline, pieces.head),
      columnHead: columnHead ? readStartMsOfPiece(timeline, columnHead) : undefined,
      firstRow: firstRow ? readStartMsOfPiece(timeline, firstRow) : undefined,
      secondRow: secondRow ? readStartMsOfPiece(timeline, secondRow) : undefined,
    };
    timeline.kill();

    // Assert: 0, 100 (--motion-lead), 130 and 160 (one --motion-row-stagger each).
    expect(startsMs, 'the pieces must start as motion.md times them').toEqual({
      head: 0,
      columnHead: 100,
      firstRow: 130,
      secondRow: 160,
    });
  });

  it('starts row n of every column at the same moment, so the field fills in one sweep', () => {
    // Arrange: the theme's tokens and the columns board: three columns of 20.
    placeTokensOnTheRoot(ardosiaMotionTokenDeclarations);
    const pieces = createBoardPiecesInAnEmptyPage(3, 20);

    // Act: build the play-in and read when the 10th row of each column starts.
    const timeline = buildPlayInTimeline(pieces.board, pieces.head, pieces.cascades);
    const tenthRowStartsMs = pieces.cascades.map((pieceList) => {
      const tenthRow = pieceList[10];
      return tenthRow ? readStartMsOfPiece(timeline, tenthRow) : undefined;
    });
    timeline.kill();

    // Assert: all three at 100 + 10 × 30 = 400 ms.
    expect(tenthRowStartsMs, 'row 10 of every column must enter together').toEqual([400, 400, 400]);
  });
});

describe('standings timelines on a page without the theme', () => {
  it('build with no length at all, so every action still ends at once', () => {
    // Arrange: no token on :root, and the table with 20 rows.
    const pieces = createBoardPiecesInAnEmptyPage(1, 20);

    // Act: build the play-in and measure it.
    const timeline = buildPlayInTimeline(pieces.board, pieces.head, pieces.cascades);
    const timelineLengthMs = timeline.duration() * 1000;
    timeline.kill();

    // Assert: a missing token reads as 0 ms, never as a timeline that never ends.
    expect(timelineLengthMs, 'without the theme the play-in must last 0 ms').toBe(0);
  });
});
