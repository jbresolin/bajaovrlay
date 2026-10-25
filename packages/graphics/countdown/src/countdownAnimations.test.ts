/**
 * The countdown's animations (packages/graphics/countdown)
 *
 * What this module is for:
 *   The card rises in whole, as the race clock does; the waiting board brings its head,
 *   then its body card `--motion-lead` behind (motion.md, "Countdown"). Out, everything
 *   lifts together. Every number is the theme's, read when the timeline is built.
 *
 * What these tests prove:
 *   - The card: one rise of `--motion-in` (400 ms).
 *   - The board: the head at 0, the body at `--motion-lead` (100 ms), so the play-in lasts
 *     500 ms, what the manifest promises.
 *   - The stop-out: every piece together over `--motion-out` (250 ms).
 *   - Without the theme every timeline lasts 0 ms.
 *
 * What these tests deliberately do not cover:
 *   - The moves themselves; the kit's boardMotion and barMotion tests.
 */
import { gsap } from 'gsap';
import { describe, expect, it, onTestFinished } from 'vitest';

import {
  buildCountdownPlayInTimeline,
  buildCountdownStopOutTimeline,
} from './countdownAnimations.js';
import type { CountdownPieces } from './countdownView.js';

/** The motion tokens of Ardósia the countdown reads. */
const ardosiaMotionTokens: Record<string, string> = {
  '--motion-in': '400ms',
  '--motion-out': '250ms',
  '--motion-lead': '100ms',
  '--motion-in-offset': '20',
  '--ease-out': 'cubic-bezier(0.16, 1, 0.3, 1)',
  '--ease-in': 'cubic-bezier(0.7, 0, 0.84, 0)',
};

/** Builds stand-ins for a layout's pieces on the page: one (the card) or two (head, body). */
function createPieces(pieceCount: number, tokens: Record<string, string>): CountdownPieces {
  const tokensSource = document.createElement('section');
  for (const [tokenName, value] of Object.entries(tokens)) {
    tokensSource.style.setProperty(tokenName, value);
  }
  const piecesInOrder = Array.from({ length: pieceCount }, () => {
    const piece = document.createElement('div');
    tokensSource.append(piece);
    return piece;
  });
  document.body.append(tokensSource);
  onTestFinished(() => tokensSource.remove());
  return { tokensSource, piecesInOrder };
}

/** When each tween of a timeline starts, and the whole length, in ms. */
function describeTimeline(timeline: ReturnType<typeof gsap.timeline>) {
  return {
    startsMs: timeline.getChildren().map((tween) => Math.round(tween.startTime() * 1000)),
    lengthMs: Math.round(timeline.duration() * 1000),
  };
}

describe('the countdown’s timelines with the Ardósia tokens', () => {
  it('raises the card in one 400 ms rise', () => {
    // Arrange: the card.
    const pieces = createPieces(1, ardosiaMotionTokens);

    // Act: build the play-in.
    const timeline = buildCountdownPlayInTimeline(pieces);
    const playIn = describeTimeline(timeline);
    timeline.kill();

    // Assert: one rise at 0, 400 ms.
    expect(playIn, 'the card as the race clock').toEqual({ startsMs: [0], lengthMs: 400 });
  });

  it('brings the board’s head, then its body card --motion-lead behind', () => {
    // Arrange: the head and the body.
    const pieces = createPieces(2, ardosiaMotionTokens);

    // Act: build the play-in.
    const timeline = buildCountdownPlayInTimeline(pieces);
    const playIn = describeTimeline(timeline);
    timeline.kill();

    // Assert: 0 and 100 ms, the whole in 500 ms.
    expect(playIn, 'the head first, the body behind').toEqual({
      startsMs: [0, 100],
      lengthMs: 500,
    });
  });

  it('lifts every piece out together over --motion-out', () => {
    // Arrange: the head and the body.
    const pieces = createPieces(2, ardosiaMotionTokens);

    // Act: build the stop-out.
    const timeline = buildCountdownStopOutTimeline(pieces);
    const stopOut = describeTimeline(timeline);
    timeline.kill();

    // Assert: one tween for both, 250 ms.
    expect(stopOut, 'out together').toEqual({ startsMs: [0], lengthMs: 250 });
  });
});

describe('the countdown’s timelines without the theme', () => {
  it('last 0 ms, so every action still ends', () => {
    // Arrange: the board's pieces and no token.
    const pieces = createPieces(2, {});

    // Act: build both timelines.
    const playIn = buildCountdownPlayInTimeline(pieces);
    const stopOut = buildCountdownStopOutTimeline(pieces);
    const lengthsMs = [playIn.duration(), stopOut.duration()];
    playIn.kill();
    stopOut.kill();

    // Assert: nothing takes time.
    expect(lengthsMs, 'without the theme every timeline is instant').toEqual([0, 0]);
  });
});
