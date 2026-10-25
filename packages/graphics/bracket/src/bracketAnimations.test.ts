/**
 * The bracket's timelines, timed by the theme's tokens (packages/graphics/bracket)
 *
 * What this module is for:
 *   motion.md times the bracket by tokens: a board's cards cascade `--motion-row-stagger`
 *   apart, `--motion-lead` after the head, each rising over `--motion-in`; the tree's lines
 *   fade in over `--motion-flag` once the round's last pill is in; everything lifts out
 *   together over `--motion-out`; a result arriving crossfades over `--motion-flag`.
 *   bracketAnimations builds those timelines from the tokens on the page.
 *
 * What these tests prove, with Ardósia's tokens on the page:
 *   - Entrar on a board of 32: the head at 0; the cards from 100 ms, 30 ms apart, the last
 *     ending at 1430 ms (motion.md's 1.5 s, and the manifest's play duration).
 *   - A tree round added: its pills from 0, 30 ms apart, and its lines from the moment the
 *     last pill is in, over 300 ms; the lines never move, they only fade.
 *   - The lift-out: every piece together, 250 ms, rising its offset.
 *   - The crossfade: 300 ms, from invisible for a cell, from full for a loser.
 *   - Without the theme every timeline lasts 0 ms, so every action still ends.
 *
 * What these tests deliberately do not cover:
 *   - Which pieces each step moves: bracket.test.ts.
 *   - The curves' shapes: packages/theme's gsapEaseOfToken tests.
 */
import { describe, expect, it } from 'vitest';

import {
  buildCascadeInTimeline,
  buildLiftOutTogetherTimeline,
  buildResultCrossfadeTimeline,
} from './bracketAnimations.js';
import {
  ardosiaMotionTokenDeclarations,
  placeTokensOnTheRoot,
} from './bracketOnThePage.testSupport.js';

/** Pieces to animate, never put on the page: `count` divs, or SVG paths for lines. */
function createPieces(count: number, kind: 'div' | 'path' = 'div'): Element[] {
  return Array.from({ length: count }, () =>
    kind === 'div'
      ? document.createElement('div')
      : document.createElementNS('http://www.w3.org/2000/svg', 'path'),
  );
}

/** A tween of a timeline in words: when it starts and how long it lasts, in ms. */
function describeTweens(timeline: ReturnType<typeof buildCascadeInTimeline>) {
  return timeline.getChildren(false, true, false).map((tween) => ({
    startMs: Math.round(tween.startTime() * 1000),
    durationMs: Math.round(tween.duration() * 1000),
  }));
}

describe('the cascade in', () => {
  it('brings a board of 32 in: the head at 0, the cards from the lead, 30 ms apart, in by 1430 ms', () => {
    // Arrange: Ardósia's motion on the page; a head and 32 cards.
    placeTokensOnTheRoot(ardosiaMotionTokenDeclarations);
    const [head] = createPieces(1) as HTMLElement[];
    const cards = createPieces(32);

    // Act: build Entrar's timeline.
    const timeline = buildCascadeInTimeline(document.body, {
      head,
      atOnce: [],
      cascade: cards,
      linesAfter: [],
      isCascadeLed: true,
    });
    const tweens = describeTweens(timeline);

    // Assert: the head first, the first and last card where motion.md puts them, the whole
    // in by 100 + 31 × 30 + 400 ms.
    expect(tweens[0], 'the head rises at 0 over --motion-in').toEqual({
      startMs: 0,
      durationMs: 400,
    });
    expect(tweens[1], 'the first card after --motion-lead').toEqual({
      startMs: 100,
      durationMs: 400,
    });
    expect(tweens[32], 'the last card 31 staggers later').toEqual({
      startMs: 1030,
      durationMs: 400,
    });
    expect(Math.round(timeline.duration() * 1000), 'in by 1430 ms').toBe(1430);
  });

  it('adds a tree round: its pills from 0, then its lines once the last pill is in, fading only', () => {
    // Arrange: Ardósia's motion on the page; the semifinals' four pills and their four lines.
    placeTokensOnTheRoot(ardosiaMotionTokenDeclarations);
    const pills = createPieces(4);
    const lines = createPieces(4, 'path');

    // Act: build the step's timeline (no head, no lead: the tree is already on screen).
    const timeline = buildCascadeInTimeline(document.body, {
      head: undefined,
      atOnce: [],
      cascade: pills,
      linesAfter: lines,
      isCascadeLed: false,
    });
    const tweens = describeTweens(timeline);
    const lineTween = timeline.getChildren(false, true, false).at(-1);

    // Assert: pills at 0, 30, 60, 90; the lines from 90 + 400 over --motion-flag, by opacity.
    expect(tweens, 'the pills, then the lines').toEqual([
      { startMs: 0, durationMs: 400 },
      { startMs: 30, durationMs: 400 },
      { startMs: 60, durationMs: 400 },
      { startMs: 90, durationMs: 400 },
      { startMs: 490, durationMs: 300 },
    ]);
    expect('y' in (lineTween?.vars ?? {}), 'a line never moves').toBe(false);
  });
});

describe('the lift-out and the crossfade', () => {
  it('lifts every piece out together over --motion-out', () => {
    // Arrange: Ardósia's motion on the page; a head and three cards on screen.
    placeTokensOnTheRoot(ardosiaMotionTokenDeclarations);
    const pieces = createPieces(4);

    // Act: build the lift-out.
    const timeline = buildLiftOutTogetherTimeline(document.body, pieces);

    // Assert: one tween for them all, at 0, 250 ms, lifting 20 px.
    const tween = timeline.getChildren(false, true, false)[0];
    expect(describeTweens(timeline), 'all together, 250 ms').toEqual([
      { startMs: 0, durationMs: 250 },
    ]);
    expect(tween?.vars.y, 'they lift their offset').toBe(-20);
  });

  it('crossfades a result over --motion-flag: cells and fills from invisible, losers from full', () => {
    // Arrange: Ardósia's motion on the page; a cell, a winner's fill and a loser.
    placeTokensOnTheRoot(ardosiaMotionTokenDeclarations);
    const [cell, fill, loser] = createPieces(3);

    // Act: build the crossfade.
    const timeline = buildResultCrossfadeTimeline(document.body, {
      resultCells: cell === undefined ? [] : [cell],
      winnerChipFills: fill === undefined ? [] : [fill],
      losers: loser === undefined ? [] : [loser],
    });
    const fromOpacities = timeline
      .getChildren(false, true, false)
      .map((tween) => tween.vars.opacity);

    // Assert: three tweens at 0 over 300 ms; the loser comes from full to its dimming.
    expect(describeTweens(timeline), 'each over --motion-flag').toEqual([
      { startMs: 0, durationMs: 300 },
      { startMs: 0, durationMs: 300 },
      { startMs: 0, durationMs: 300 },
    ]);
    expect(fromOpacities, 'from invisible, invisible, full').toEqual([0, 0, 1]);
  });

  it('lasts 0 ms on a page without the theme, so every action still ends', () => {
    // Arrange: no token on the page; a head, cards and lines.
    const [head] = createPieces(1) as HTMLElement[];

    // Act: build Entrar's timeline.
    const timeline = buildCascadeInTimeline(document.body, {
      head,
      atOnce: createPieces(2),
      cascade: createPieces(8),
      linesAfter: createPieces(2, 'path'),
      isCascadeLed: true,
    });

    // Assert: nothing to wait for.
    expect(timeline.duration(), 'no theme, no motion').toBe(0);
  });
});
