/**
 * QR card animations (packages/graphics/qr-card)
 *
 * What this module is for:
 *   The QR card rises in whole on play and lifts out on stop; nothing moves while it is up,
 *   since a moving code does not scan (the design's motion.md, "QR card"). The GSAP
 *   timelines live here and take every duration, offset and ease from the theme's motion
 *   tokens (`--motion-*`, `--ease-*`), read through `@bajaovrlay/theme/motion`.
 *
 * What these tests prove:
 *   - The play-in lasts `--motion-in`, rises from `--motion-in-offset` below its place and
 *     runs on `--ease-out`; the stop-out lasts `--motion-out`, lifts by the same offset and
 *     runs on `--ease-in`. The manifest promises the two lengths to a renderer
 *     (qrCardManifest.test.ts checks it against the token file).
 *   - Each timeline is one tween on the card alone, so the code inside comes and goes with
 *     it and is never moved on its own.
 *   - On a page without the theme every timeline lasts 0, so every action still ends.
 *
 * What these tests deliberately do not cover:
 *   - What the animations look like; e2e/qrCardLifecycle.e2e.ts watches the card come in.
 *   - That nothing moves while the card is up: no timeline exists for that state at all,
 *     which qr-card.test.ts shows (an update on air redraws with no tween).
 *   - Reading and parsing the tokens; packages/theme tests readMotionTokens.
 */
import { gsapEaseOfToken } from '@bajaovrlay/theme/motion';
import { gsap } from 'gsap';
import { describe, expect, it, onTestFinished } from 'vitest';

import {
  buildPlayInTimeline,
  buildStopOutTimeline,
  type QrCardAnimatedElements,
} from './qrCardAnimations.js';

/** The motion tokens of Ardósia, as packages/theme/ardosia/tokens.css declares them. */
const ardosiaMotionTokenDeclarations: Record<string, string> = {
  '--motion-in': '400ms',
  '--motion-out': '250ms',
  '--motion-in-offset': '20',
  '--ease-out': 'cubic-bezier(0.16, 1, 0.3, 1)',
  '--ease-in': 'cubic-bezier(0.7, 0, 0.84, 0)',
};

/**
 * Puts Ardósia's motion tokens on :root, as the renderer page does, and takes them off
 * again when the test ends so a test without a theme reads nothing.
 */
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

/** Builds a stand-in for the card with its code inside it, on the page. */
function createCardWithItsCodeInAnEmptyPage(): QrCardAnimatedElements {
  const panel = document.createElement('section');
  panel.append(document.createElementNS('http://www.w3.org/2000/svg', 'svg'));
  document.body.append(panel);
  onTestFinished(() => panel.remove());
  return { panel };
}

/** Reads what a timeline will do: its length, how many tweens, the first's targets, end y, ease. */
function describeTimeline(timeline: ReturnType<typeof gsap.timeline>) {
  const tweens = timeline.getChildren();
  const firstTween = tweens[0];
  return {
    lengthMs: Math.round(timeline.duration() * 1000),
    tweenCount: tweens.length,
    targets: firstTween !== undefined && 'targets' in firstTween ? firstTween.targets() : [],
    ease: firstTween?.vars.ease,
    endY: firstTween?.vars.y,
  };
}

describe('QR card timelines with the Ardósia tokens on the page', () => {
  it('rises in over --motion-in (400 ms) from 20 px below, on --ease-out, the card alone', () => {
    // Arrange: the theme's motion tokens on :root and the card with its code.
    placeArdosiaMotionTokensOnTheRoot();
    const animatedElements = createCardWithItsCodeInAnEmptyPage();

    // Act: build the play-in (paused; nothing moves yet), note where the card starts, and
    // read the timeline.
    const timeline = buildPlayInTimeline(animatedElements);
    timeline.progress(0);
    const startY = gsap.getProperty(animatedElements.panel, 'y');
    const playIn = describeTimeline(timeline);
    timeline.kill();

    // Assert: the length, the rise and the curve are the tokens', on one tween of the card.
    expect(playIn.lengthMs, 'the play-in must last --motion-in').toBe(400);
    expect(startY, 'the card must start --motion-in-offset below its place').toBe(20);
    expect(playIn.endY, 'the card must end in its place').toBe(0);
    expect(playIn.ease, 'the play-in must run on --ease-out').toBe(
      gsapEaseOfToken(ardosiaMotionTokenDeclarations['--ease-out'] ?? ''),
    );
    expect(
      { tweenCount: playIn.tweenCount, targets: playIn.targets },
      'the card must move whole, the code with it',
    ).toEqual({ tweenCount: 1, targets: [animatedElements.panel] });
  });

  it('lifts out over --motion-out (250 ms) by 20 px, on --ease-in, the card alone', () => {
    // Arrange: the theme's motion tokens on :root and the card with its code.
    placeArdosiaMotionTokensOnTheRoot();
    const animatedElements = createCardWithItsCodeInAnEmptyPage();

    // Act: build the stop-out and read it.
    const timeline = buildStopOutTimeline(animatedElements);
    const stopOut = describeTimeline(timeline);
    timeline.kill();

    // Assert: the length, the lift and the curve are the tokens'.
    expect(stopOut.lengthMs, 'the stop-out must last --motion-out').toBe(250);
    expect(stopOut.endY, 'the card must lift --motion-in-offset').toBe(-20);
    expect(stopOut.ease, 'the stop-out must run on --ease-in').toBe(
      gsapEaseOfToken(ardosiaMotionTokenDeclarations['--ease-in'] ?? ''),
    );
    expect(
      { tweenCount: stopOut.tweenCount, targets: stopOut.targets },
      'the card must leave whole, the code with it',
    ).toEqual({ tweenCount: 1, targets: [animatedElements.panel] });
  });
});

describe('QR card timelines on a page without the theme', () => {
  it('last 0 ms, so play and stop still end', () => {
    // Arrange: no token on the page, and the card with its code.
    const animatedElements = createCardWithItsCodeInAnEmptyPage();

    // Act: build both timelines and read their lengths.
    const playIn = buildPlayInTimeline(animatedElements);
    const stopOut = buildStopOutTimeline(animatedElements);
    const lengthsMs = [playIn.duration() * 1000, stopOut.duration() * 1000];
    playIn.kill();
    stopOut.kill();

    // Assert: both are instant.
    expect(lengthsMs, 'without the theme every timeline must last 0 ms').toEqual([0, 0]);
  });
});
