/**
 * The intermission board's animations (packages/graphics/intermission-board)
 *
 * What this module is for:
 *   The board brings its head, then `--motion-lead` later the next card and the top five's
 *   head, the rows a stagger apart after that head, and the sponsor line `--motion-lead`
 *   after the last row starts (motion.md, "Intermission board"). Without the top five or
 *   the line the remaining pieces keep their timing.
 *
 * What these tests prove:
 *   - The full board: head 0, next card and top head 100, rows 130 … 250, sponsor line 350;
 *     the whole in 750 ms, what the manifest promises.
 *   - Without the top five the sponsor line still rises at 350 ms; without the line the
 *     rows keep theirs.
 *   - Without the theme every timeline lasts 0 ms.
 *
 * What these tests deliberately do not cover:
 *   - The sponsor line's turn, the kit's page turn (barMotion.test.ts).
 */
import { describe, expect, it, onTestFinished } from 'vitest';

import { buildIntermissionBoardPlayInTimeline } from './intermissionBoardAnimations.js';
import type { IntermissionBoardPieces } from './intermissionBoardView.js';

/** The motion tokens of Ardósia the board reads. */
const ardosiaMotionTokens: Record<string, string> = {
  '--motion-in': '400ms',
  '--motion-lead': '100ms',
  '--motion-row-stagger': '30ms',
  '--motion-in-offset': '20',
};

/** Stand-ins for the board's pieces on the page, with or without its optional parts. */
function createPieces(
  parts: { hasTopFive: boolean; hasSponsorLine: boolean },
  tokens: Record<string, string>,
): IntermissionBoardPieces {
  const board = document.createElement('section');
  for (const [tokenName, value] of Object.entries(tokens)) {
    board.style.setProperty(tokenName, value);
  }
  const createPiece = () => {
    const piece = document.createElement('div');
    board.append(piece);
    return piece;
  };
  document.body.append(board);
  onTestFinished(() => board.remove());
  return {
    board,
    head: createPiece(),
    nextCard: createPiece(),
    topHead: parts.hasTopFive ? createPiece() : undefined,
    rows: parts.hasTopFive ? Array.from({ length: 5 }, createPiece) : [],
    sponsorLine: parts.hasSponsorLine ? createPiece() : undefined,
  };
}

/** When each piece starts, in ms, and the whole length. */
function describePlayIn(pieces: IntermissionBoardPieces) {
  const timeline = buildIntermissionBoardPlayInTimeline(pieces);
  const description = {
    startsMs: timeline.getChildren().map((tween) => Math.round(tween.startTime() * 1000)),
    lengthMs: Math.round(timeline.duration() * 1000),
  };
  timeline.kill();
  return description;
}

describe('the intermission board’s play-in with the Ardósia tokens', () => {
  it('brings every piece at its moment, in 750 ms', () => {
    // Arrange: the full board.
    const pieces = createPieces({ hasTopFive: true, hasSponsorLine: true }, ardosiaMotionTokens);

    // Act: build the play-in.
    const playIn = describePlayIn(pieces);

    // Assert: head, card and top head, five rows, the line.
    expect(playIn, 'motion.md’s order').toEqual({
      startsMs: [0, 100, 100, 130, 160, 190, 220, 250, 350],
      lengthMs: 750,
    });
  });

  it('keeps the sponsor line at 350 ms without the top five', () => {
    // Arrange: the board without the top five.
    const pieces = createPieces({ hasTopFive: false, hasSponsorLine: true }, ardosiaMotionTokens);

    // Act: build the play-in.
    const playIn = describePlayIn(pieces);

    // Assert: head, card, then the line where it always rises.
    expect(playIn.startsMs, 'the remaining pieces keep their timing').toEqual([0, 100, 350]);
  });

  it('keeps the rows’ moments without the sponsor line', () => {
    // Arrange: the board without the line.
    const pieces = createPieces({ hasTopFive: true, hasSponsorLine: false }, ardosiaMotionTokens);

    // Act: build the play-in.
    const playIn = describePlayIn(pieces);

    // Assert: the same moments, the line's left out.
    expect(playIn.startsMs, 'the rows keep theirs').toEqual([0, 100, 100, 130, 160, 190, 220, 250]);
  });
});

describe('the intermission board’s play-in without the theme', () => {
  it('lasts 0 ms', () => {
    // Arrange: the full board, no token.
    const pieces = createPieces({ hasTopFive: true, hasSponsorLine: true }, {});

    // Act: build the play-in.
    const playIn = describePlayIn(pieces);

    // Assert: instant.
    expect(playIn.lengthMs, 'without the theme nothing takes time').toBe(0);
  });
});
