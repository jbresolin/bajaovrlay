/**
 * The boards' moves: pieces rising at their own starts, and a crossfade (packages/graphics/kit)
 *
 * What this module is for:
 *   The narrow boards (BAJAOVRLAY-46) bring their pieces in with the catalogue's rise, each
 *   at its own moment: the head first, the body `--motion-lead` later, rows
 *   `--motion-row-stagger` apart (motion.md, "The catalogue"). A state that changes on air
 *   (a slot going from "a seguir" to "em andamento", the corner card's next sponsor)
 *   crossfades: the new fades in over the old in `--motion-flag`, nothing moves. Every
 *   number is the theme's, read when the timeline is built.
 *
 * What these tests prove:
 *   - The rise: each piece starts at the moment given, rises `--motion-in-offset` and fades
 *     up over `--motion-in` on `--ease-out`.
 *   - The crossfade: the leaving pieces fade out and the arriving fade in, both at once over
 *     `--motion-flag`, with no movement.
 *   - Without the theme both last 0 ms, so every action still ends.
 *
 * What these tests deliberately do not cover:
 *   - Which piece starts when on each board; each board's animation test.
 *   - The out and the page turn, the bars' moves (barMotion.test.ts), which the boards reuse.
 */
import { gsap } from 'gsap';
import { describe, expect, it, onTestFinished } from 'vitest';

import { buildCrossfadeTimeline, buildPiecesRiseInTimeline } from './boardMotion.js';

/** The motion tokens these moves read, with Ardósia's values. */
const ardosiaMotionTokens: Record<string, string> = {
  '--motion-in': '400ms',
  '--motion-in-offset': '20',
  '--motion-flag': '300ms',
  '--ease-out': 'cubic-bezier(0.16, 1, 0.3, 1)',
};

/** Builds a board stand-in with `pieceCount` pieces, the tokens set on it (or none). */
function createBoardWithPieces(pieceCount: number, tokens: Record<string, string>) {
  const board = document.createElement('section');
  for (const [tokenName, value] of Object.entries(tokens)) {
    board.style.setProperty(tokenName, value);
  }
  const pieces = Array.from({ length: pieceCount }, () => {
    const piece = document.createElement('div');
    board.append(piece);
    return piece;
  });
  document.body.append(board);
  onTestFinished(() => board.remove());
  return { board, pieces };
}

/** The first two pieces of a board; a board built with fewer is a bug in the test. */
function takeFirstTwoPieces(pieces: HTMLElement[]): [HTMLElement, HTMLElement] {
  const [first, second] = pieces;
  if (first === undefined || second === undefined) {
    throw new Error('the board was built with fewer than two pieces');
  }
  return [first, second];
}

/** Each tween of a timeline: when it starts, how long it lasts, where it ends. */
function describeTweens(timeline: ReturnType<typeof gsap.timeline>) {
  return timeline.getChildren().map((tween) => ({
    startMs: Math.round(tween.startTime() * 1000),
    lengthMs: Math.round(tween.duration() * 1000),
    endOpacity: tween.vars.opacity,
    endY: tween.vars.y,
  }));
}

describe('buildPiecesRiseInTimeline', () => {
  it('raises each piece at its own start, over --motion-in, from --motion-in-offset below', () => {
    // Arrange: a head and a body, the body 100 ms later (the lead).
    const { board, pieces } = createBoardWithPieces(2, ardosiaMotionTokens);
    const [head, body] = takeFirstTwoPieces(pieces);

    // Act: build the rise and note where the body starts.
    const timeline = buildPiecesRiseInTimeline(board, [
      { piece: head, startMs: 0 },
      { piece: body, startMs: 100 },
    ]);
    timeline.progress(0);
    const bodyStartY = gsap.getProperty(body, 'y');
    const tweens = describeTweens(timeline);
    timeline.kill();

    // Assert: two rises, at 0 and 100 ms, each 400 ms to full opacity in place.
    expect(tweens, 'each piece at its own start').toEqual([
      { startMs: 0, lengthMs: 400, endOpacity: 1, endY: 0 },
      { startMs: 100, lengthMs: 400, endOpacity: 1, endY: 0 },
    ]);
    expect(bodyStartY, 'a piece starts --motion-in-offset below its place').toBe(20);
  });

  it('lasts 0 ms on a page without the theme', () => {
    // Arrange: two pieces and no token.
    const { board, pieces } = createBoardWithPieces(2, {});

    // Act: build the rise with a start the theme would have given.
    const timeline = buildPiecesRiseInTimeline(
      board,
      pieces.map((piece) => ({ piece, startMs: 0 })),
    );
    const lengthMs = timeline.duration() * 1000;
    timeline.kill();

    // Assert: it ends at once.
    expect(lengthMs, 'without the theme nothing takes time').toBe(0);
  });
});

describe('buildCrossfadeTimeline', () => {
  it('fades the old out and the new in, at once, over --motion-flag, with no movement', () => {
    // Arrange: the old state cell and the new one in the same place.
    const { board, pieces } = createBoardWithPieces(2, ardosiaMotionTokens);
    const [oldCell, newCell] = takeFirstTwoPieces(pieces);

    // Act: build the crossfade.
    const timeline = buildCrossfadeTimeline(board, [oldCell], [newCell]);
    const tweens = describeTweens(timeline);
    timeline.kill();

    // Assert: both at 0, 300 ms each, opacity only.
    expect(tweens, 'a state, not an animation').toEqual([
      { startMs: 0, lengthMs: 300, endOpacity: 0, endY: undefined },
      { startMs: 0, lengthMs: 300, endOpacity: 1, endY: undefined },
    ]);
  });

  it('lasts 0 ms on a page without the theme', () => {
    // Arrange: two cells and no token.
    const { board, pieces } = createBoardWithPieces(2, {});
    const [oldCell, newCell] = takeFirstTwoPieces(pieces);

    // Act: build the crossfade.
    const timeline = buildCrossfadeTimeline(board, [oldCell], [newCell]);
    const lengthMs = timeline.duration() * 1000;
    timeline.kill();

    // Assert: it ends at once.
    expect(lengthMs, 'without the theme nothing takes time').toBe(0);
  });
});
