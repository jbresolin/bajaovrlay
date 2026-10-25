/**
 * Battle card animations (packages/graphics/battle-card)
 *
 * What this module is for:
 *   The battle card comes in piece by piece (the car ahead, the gap card `--motion-lead`
 *   later, the car behind `--motion-lead` after that), goes out all together, and
 *   crossfades its trend cell when the trend's word changes (the design's motion.md,
 *   "Battle card"). The GSAP timelines live here and take every duration, offset and ease
 *   from the theme's motion tokens, read through `@bajaovrlay/theme/motion`.
 *
 * What these tests prove:
 *   - The play-in starts the three pieces 0, 100 and 200 ms apart (`--motion-lead`), each
 *     rising from `--motion-in-offset` below in `--motion-in` on `--ease-out`, 600 ms in
 *     all: the length the manifest promises (battleCardManifest.test.ts).
 *   - The stop-out moves the three together, one tween of `--motion-out` on `--ease-in`,
 *     lifting by the offset.
 *   - The crossfade fades the incoming layer in and the current one out, both over
 *     `--motion-flag` and from the same moment, moving nothing; at rest the current layer
 *     is visible and the incoming one invisible.
 *   - On a page without the theme every timeline lasts 0, so every action still ends.
 *
 * What these tests deliberately do not cover:
 *   - When the crossfade runs (only for a new word); battle-card.trendOnAir.test.ts.
 *   - What the motion looks like; e2e/battleCardLifecycle.e2e.ts watches it in Chromium.
 */
import { gsapEaseOfToken } from '@bajaovrlay/theme/motion';
import { gsap } from 'gsap';
import { describe, expect, it, onTestFinished } from 'vitest';

import {
  type BattleCardPieces,
  buildPlayInTimeline,
  buildStopOutTimeline,
  buildTrendCrossfadeTimeline,
  placeTrendLayersAtRest,
  type TrendLayers,
} from './battleCardAnimations.js';

/** The motion tokens of Ardósia, as packages/theme/ardosia/tokens.css declares them. */
const ardosiaMotionTokenDeclarations: Record<string, string> = {
  '--motion-in': '400ms',
  '--motion-out': '250ms',
  '--motion-lead': '100ms',
  '--motion-flag': '300ms',
  '--motion-in-offset': '20',
  '--ease-out': 'cubic-bezier(0.16, 1, 0.3, 1)',
  '--ease-in': 'cubic-bezier(0.7, 0, 0.84, 0)',
};

/** Puts Ardósia's motion tokens on :root, and takes them off when the test ends. */
function placeArdosiaMotionTokensOnTheRoot(): void {
  const root = document.documentElement;
  for (const [tokenName, value] of Object.entries(ardosiaMotionTokenDeclarations)) {
    root.style.setProperty(tokenName, value);
  }
  onTestFinished(() => {
    for (const tokenName of Object.keys(ardosiaMotionTokenDeclarations)) {
      root.style.removeProperty(tokenName);
    }
  });
}

/** Builds stand-ins for the three pieces on the page, removed when the test ends. */
function createPiecesOnThePage(): BattleCardPieces {
  const pieces = {
    carAheadPill: document.createElement('div'),
    gapCard: document.createElement('div'),
    carBehindPill: document.createElement('div'),
  };
  document.body.append(pieces.carAheadPill, pieces.gapCard, pieces.carBehindPill);
  onTestFinished(() => {
    pieces.carAheadPill.remove();
    pieces.gapCard.remove();
    pieces.carBehindPill.remove();
  });
  return pieces;
}

/** Builds stand-ins for the two trend layers on the page, removed when the test ends. */
function createTrendLayersOnThePage(): TrendLayers {
  const layers = {
    trendLayer: document.createElement('span'),
    incomingTrendLayer: document.createElement('span'),
  };
  document.body.append(layers.trendLayer, layers.incomingTrendLayer);
  onTestFinished(() => {
    layers.trendLayer.remove();
    layers.incomingTrendLayer.remove();
  });
  return layers;
}

/** Reads each tween of a timeline: what it moves, when it starts, how long, its ease and end. */
function describeTweens(timeline: ReturnType<typeof gsap.timeline>) {
  return timeline.getChildren().map((tween) => ({
    targets: 'targets' in tween ? tween.targets() : [],
    startMs: Math.round(tween.startTime() * 1000),
    lengthMs: Math.round(tween.duration() * 1000),
    ease: tween.vars.ease,
    endY: tween.vars.y,
    endOpacity: tween.vars.opacity,
  }));
}

describe('battle card timelines with the Ardósia tokens on the page', () => {
  it('brings the car ahead, the gap card and the car behind in one lead apart, 600 ms in all', () => {
    // Arrange: the theme's motion tokens and the three pieces.
    placeArdosiaMotionTokensOnTheRoot();
    const pieces = createPiecesOnThePage();

    // Act: build the play-in (paused) and read its tweens and length.
    const timeline = buildPlayInTimeline(pieces);
    timeline.progress(0);
    const startY = gsap.getProperty(pieces.gapCard, 'y');
    const tweens = describeTweens(timeline);
    const lengthMs = Math.round(timeline.duration() * 1000);
    timeline.kill();

    // Assert: the order, the lead between pieces, each rise and the whole length.
    const easeOut = gsapEaseOfToken(ardosiaMotionTokenDeclarations['--ease-out'] ?? '');
    expect(
      tweens.map(({ targets, startMs, lengthMs: tweenLengthMs, ease, endY }) => ({
        targets,
        startMs,
        tweenLengthMs,
        ease,
        endY,
      })),
      'each piece must rise in --motion-in, one --motion-lead after the one before',
    ).toEqual([
      { targets: [pieces.carAheadPill], startMs: 0, tweenLengthMs: 400, ease: easeOut, endY: 0 },
      { targets: [pieces.gapCard], startMs: 100, tweenLengthMs: 400, ease: easeOut, endY: 0 },
      { targets: [pieces.carBehindPill], startMs: 200, tweenLengthMs: 400, ease: easeOut, endY: 0 },
    ]);
    expect(startY, 'each piece must start --motion-in-offset below its place').toBe(20);
    expect(lengthMs, 'the play-in must last --motion-in + 2 × --motion-lead').toBe(600);
  });

  it('lifts the three pieces out together over --motion-out (250 ms), on --ease-in', () => {
    // Arrange: the theme's motion tokens and the three pieces.
    placeArdosiaMotionTokensOnTheRoot();
    const pieces = createPiecesOnThePage();

    // Act: build the stop-out and read it.
    const timeline = buildStopOutTimeline(pieces);
    const tweens = describeTweens(timeline);
    timeline.kill();

    // Assert: one tween on all three, the out's length, lift and curve.
    expect(tweens, 'the three pieces must leave together, never staggered').toEqual([
      {
        targets: [pieces.carAheadPill, pieces.gapCard, pieces.carBehindPill],
        startMs: 0,
        lengthMs: 250,
        ease: gsapEaseOfToken(ardosiaMotionTokenDeclarations['--ease-in'] ?? ''),
        endY: -20,
        endOpacity: 0,
      },
    ]);
  });

  it('crossfades the trend layers over --motion-flag (300 ms), both from the same moment', () => {
    // Arrange: the theme's motion tokens and the two layers.
    placeArdosiaMotionTokensOnTheRoot();
    const layers = createTrendLayersOnThePage();

    // Act: build the crossfade and read it.
    const timeline = buildTrendCrossfadeTimeline(layers);
    const tweens = describeTweens(timeline);
    timeline.kill();

    // Assert: incoming in, current out, together, nothing moved.
    const easeOut = gsapEaseOfToken(ardosiaMotionTokenDeclarations['--ease-out'] ?? '');
    expect(tweens, 'the new trend must fade in over the old, nothing moving').toEqual([
      {
        targets: [layers.incomingTrendLayer],
        startMs: 0,
        lengthMs: 300,
        ease: easeOut,
        endY: undefined,
        endOpacity: 1,
      },
      {
        targets: [layers.trendLayer],
        startMs: 0,
        lengthMs: 300,
        ease: easeOut,
        endY: undefined,
        endOpacity: 0,
      },
    ]);
  });

  it('puts the layers at rest: the current one visible, the incoming one invisible', () => {
    // Arrange: two layers as a finished crossfade leaves them.
    const layers = createTrendLayersOnThePage();
    gsap.set(layers.trendLayer, { opacity: 0 });
    gsap.set(layers.incomingTrendLayer, { opacity: 1 });

    // Act: put them at rest.
    placeTrendLayersAtRest(layers);

    // Assert: ready for the next crossfade.
    expect(
      [layers.trendLayer.style.opacity, layers.incomingTrendLayer.style.opacity],
      'at rest the current layer shows and the incoming one waits invisible',
    ).toEqual(['1', '0']);
  });
});

describe('battle card timelines on a page without the theme', () => {
  it('build with no length at all, so every action still ends at once', () => {
    // Arrange: no token on :root, and the pieces and layers.
    const pieces = createPiecesOnThePage();
    const layers = createTrendLayersOnThePage();

    // Act: build every timeline and measure them.
    const timelines = [
      buildPlayInTimeline(pieces),
      buildStopOutTimeline(pieces),
      buildTrendCrossfadeTimeline(layers),
    ];
    const lengthsMs = timelines.map((timeline) => timeline.duration() * 1000);
    for (const timeline of timelines) {
      timeline.kill();
    }

    // Assert: a missing token reads as 0 ms, never as a timeline that never ends.
    expect(lengthsMs, 'without the theme every timeline must last 0 ms').toEqual([0, 0, 0]);
  });
});
