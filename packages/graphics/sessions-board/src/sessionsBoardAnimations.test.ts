/**
 * The sessions board's animations (packages/graphics/sessions-board)
 *
 * What this module is for:
 *   The board brings its head, then `--motion-lead` later each slot `--motion-row-stagger`
 *   after the one above, and lifts everything out together (motion.md, "Sessions board").
 *   When a slot's state changes on air, its state and its slate crossfade in
 *   `--motion-flag`, nothing moving. Every number is the theme's.
 *
 * What these tests prove:
 *   - The play-in: the head at 0, the rows at 100, 130, 160 ms…; twelve rows end at
 *     100 + 11 × 30 + 400 = 830 ms, what the manifest promises.
 *   - The crossfade of the slot that ends and the one that starts: four pieces out (two
 *     state layers, the old live slate, the old base slate) and four in, all over 300 ms at 0.
 *   - A change between two states that share a slate (a seguir → concluída, after an edit)
 *     crossfades the states alone.
 *   - Without the theme every timeline lasts 0 ms.
 *
 * What these tests deliberately do not cover:
 *   - When the crossfade runs; sessions-board.test.ts under fake time.
 */
import { gsap } from 'gsap';
import { describe, expect, it, onTestFinished } from 'vitest';

import {
  buildSessionsBoardPlayInTimeline,
  buildStatusCrossfadeTimeline,
} from './sessionsBoardAnimations.js';
import type { SessionsBoardRowParts } from './sessionsBoardView.js';

/** The motion tokens of Ardósia the board reads. */
const ardosiaMotionTokens: Record<string, string> = {
  '--motion-in': '400ms',
  '--motion-lead': '100ms',
  '--motion-row-stagger': '30ms',
  '--motion-flag': '300ms',
  '--motion-in-offset': '20',
};

/** A board stand-in on the page with the tokens given. */
function createBoard(tokens: Record<string, string>): HTMLElement {
  const board = document.createElement('section');
  for (const [tokenName, value] of Object.entries(tokens)) {
    board.style.setProperty(tokenName, value);
  }
  document.body.append(board);
  onTestFinished(() => board.remove());
  return board;
}

/** A row stand-in with its two slates and three state layers. */
function createRowParts(board: HTMLElement): SessionsBoardRowParts {
  const createPart = () => {
    const part = document.createElement('span');
    board.append(part);
    return part;
  };
  return {
    row: createPart(),
    slotId: 'alinhamento',
    baseSlate: createPart(),
    liveSlate: createPart(),
    statusLayers: { finished: createPart(), inProgress: createPart(), upcoming: createPart() },
  };
}

describe('the play-in', () => {
  it('brings the head, then twelve rows from --motion-lead a stagger apart, in 830 ms', () => {
    // Arrange: a head and twelve rows.
    const board = createBoard(ardosiaMotionTokens);
    const head = document.createElement('header');
    const rows = Array.from({ length: 12 }, () => document.createElement('div'));
    board.append(head, ...rows);

    // Act: build the play-in.
    const timeline = buildSessionsBoardPlayInTimeline(board, head, rows);
    const startsMs = timeline.getChildren().map((tween) => Math.round(tween.startTime() * 1000));
    const lengthMs = Math.round(timeline.duration() * 1000);
    timeline.kill();

    // Assert: 0, then 100, 130 … 430; the whole in 830 ms.
    expect(startsMs.slice(0, 4), 'the head, then the rows a stagger apart').toEqual([
      0, 100, 130, 160,
    ]);
    expect(startsMs.at(-1), 'the twelfth row').toBe(430);
    expect(lengthMs, 'twelve rows in').toBe(830);
  });
});

describe('the crossfade of a state', () => {
  it('fades the old state and slate out and the new in, over --motion-flag, at once', () => {
    // Arrange: the alignment's row, ending; the enduro's, starting.
    const board = createBoard(ardosiaMotionTokens);
    const alignment = createRowParts(board);
    const enduro = createRowParts(board);

    // Act: build the crossfade of both.
    const timeline = buildStatusCrossfadeTimeline(board, [
      { rowParts: alignment, statusBefore: 'inProgress', statusAfter: 'finished' },
      { rowParts: enduro, statusBefore: 'upcoming', statusAfter: 'inProgress' },
    ]);
    const tweens = timeline.getChildren() as gsap.core.Tween[];
    const description = tweens.map((tween) => ({
      startMs: Math.round(tween.startTime() * 1000),
      lengthMs: Math.round(tween.duration() * 1000),
      pieces: tween.targets().length,
    }));
    timeline.kill();

    // Assert: one fade out of four pieces and one fade in of four, both 300 ms at 0; the
    // rows marked with their new states.
    expect(description, 'a state, not an animation').toEqual([
      { startMs: 0, lengthMs: 300, pieces: 4 },
      { startMs: 0, lengthMs: 300, pieces: 4 },
    ]);
    expect(
      [alignment.row.dataset.status, enduro.row.dataset.status],
      'the marks are the new states',
    ).toEqual(['finished', 'inProgress']);
  });

  it('crossfades the states alone when the slate stays', () => {
    // Arrange: a slot going from a seguir to concluída (an edit moved it into the past).
    const board = createBoard(ardosiaMotionTokens);
    const briefing = createRowParts(board);

    // Act: build its crossfade.
    const timeline = buildStatusCrossfadeTimeline(board, [
      { rowParts: briefing, statusBefore: 'upcoming', statusAfter: 'finished' },
    ]);
    const piecesPerTween = (timeline.getChildren() as gsap.core.Tween[]).map(
      (tween) => tween.targets().length,
    );
    timeline.kill();

    // Assert: one layer out, one in; the base slate untouched.
    expect(piecesPerTween, 'only the state layers').toEqual([1, 1]);
  });

  it('lasts 0 ms on a page without the theme', () => {
    // Arrange: a row and no token.
    const board = createBoard({});
    const alignment = createRowParts(board);

    // Act: build a crossfade.
    const timeline = buildStatusCrossfadeTimeline(board, [
      { rowParts: alignment, statusBefore: 'inProgress', statusAfter: 'finished' },
    ]);
    const lengthMs = timeline.duration() * 1000;
    timeline.kill();

    // Assert: instant.
    expect(lengthMs, 'without the theme nothing takes time').toBe(0);
  });
});
