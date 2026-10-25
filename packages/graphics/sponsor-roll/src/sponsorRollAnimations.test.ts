/**
 * The sponsor roll's animations (packages/graphics/sponsor-roll)
 *
 * What this module is for:
 *   The full screen brings its head, then `--motion-lead` later its tiles a row stagger
 *   apart, and turns a page in place (`--motion-strip-page`, `--motion-page-stagger`); the
 *   corner's card rises whole and its sponsor cell crossfades in `--motion-flag`.
 *
 * What these tests prove:
 *   - The full screen's play-in: the head at 0, six tiles from 100 ms 30 ms apart, the whole
 *     in 650 ms, what the manifest promises.
 *   - A page turn: the old tiles lift and the new rise at once, 15 ms apart, over 300 ms.
 *   - The corner's turn: the old cell fades out as the new fades in, 300 ms, nothing moving.
 *   - Without the theme every timeline lasts 0 ms.
 *
 * What these tests deliberately do not cover:
 *   - When the turns come; sponsor-roll.test.ts under fake time.
 */
import { gsap } from 'gsap';
import { describe, expect, it, onTestFinished } from 'vitest';

import {
  buildCellCrossfadeTimeline,
  buildFullscreenPlayInTimeline,
  buildTilePageTurnTimeline,
} from './sponsorRollAnimations.js';

/** The motion tokens of Ardósia the roll reads. */
const ardosiaMotionTokens: Record<string, string> = {
  '--motion-in': '400ms',
  '--motion-lead': '100ms',
  '--motion-row-stagger': '30ms',
  '--motion-strip-page': '300ms',
  '--motion-page-stagger': '15ms',
  '--motion-flag': '300ms',
  '--motion-in-offset': '20',
};

/** A board stand-in with the tokens given and `pieceCount` pieces in it. */
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

/** When each tween starts, and the whole length, in ms. */
function describeTimeline(timeline: ReturnType<typeof gsap.timeline>) {
  return {
    startsMs: timeline.getChildren().map((tween) => Math.round(tween.startTime() * 1000)),
    lengthMs: Math.round(timeline.duration() * 1000),
  };
}

describe('the sponsor roll’s timelines with the Ardósia tokens', () => {
  it('brings the head, then six tiles from --motion-lead a stagger apart, in 650 ms', () => {
    // Arrange: a head and six tiles.
    const { board, pieces } = createBoardWithPieces(7, ardosiaMotionTokens);
    const [head, ...tiles] = pieces;

    // Act: build the play-in.
    const timeline = buildFullscreenPlayInTimeline(board, head as HTMLElement, tiles);
    const playIn = describeTimeline(timeline);
    timeline.kill();

    // Assert: 0, then 100 … 250 ms; 650 ms in all.
    expect(playIn, 'the head, then the tiles').toEqual({
      startsMs: [0, 100, 130, 160, 190, 220, 250],
      lengthMs: 650,
    });
  });

  it('turns a page in place: the old tiles lift, the new rise, 15 ms apart, at once', () => {
    // Arrange: two tiles leaving, two arriving.
    const { board, pieces } = createBoardWithPieces(4, ardosiaMotionTokens);

    // Act: build the turn.
    const timeline = buildTilePageTurnTimeline(board, pieces.slice(0, 2), pieces.slice(2));
    const turn = describeTimeline(timeline);
    timeline.kill();

    // Assert: a leaving and an arriving tile at 0, the next of each 15 ms later (GSAP lists
    // tweens by start); the turn ends at 315 ms.
    expect(turn, 'the page never goes empty').toEqual({
      startsMs: [0, 0, 15, 15],
      lengthMs: 315,
    });
  });

  it('crossfades the corner’s cell over --motion-flag', () => {
    // Arrange: the cell on air and the next one.
    const { board, pieces } = createBoardWithPieces(2, ardosiaMotionTokens);

    // Act: build the crossfade.
    const timeline = buildCellCrossfadeTimeline(
      board,
      pieces[0] as HTMLElement,
      pieces[1] as HTMLElement,
    );
    const crossfade = describeTimeline(timeline);
    timeline.kill();

    // Assert: out and in together, 300 ms.
    expect(crossfade, 'a state, not an animation').toEqual({ startsMs: [0, 0], lengthMs: 300 });
  });
});

describe('the sponsor roll’s timelines without the theme', () => {
  it('last 0 ms', () => {
    // Arrange: a head and a tile, and no token.
    const { board, pieces } = createBoardWithPieces(2, {});

    // Act: build the play-in.
    const timeline = buildFullscreenPlayInTimeline(board, pieces[0] as HTMLElement, [
      pieces[1] as HTMLElement,
    ]);
    const lengthMs = timeline.duration() * 1000;
    timeline.kill();

    // Assert: instant.
    expect(lengthMs, 'without the theme nothing takes time').toBe(0);
  });
});
