/**
 * Notice animations (packages/graphics/notice)
 *
 * What this module is for:
 *   The notice rises in on play and lifts out on stop, the race clock's two motions (the
 *   design's motion.md, "Fastest lap and the penalty notice"). The GSAP timelines live
 *   here and take every duration, offset and ease from the theme's motion tokens
 *   (`--motion-*`, `--ease-*`), read from the page through `@bajaovrlay/theme/motion`.
 *
 * What these tests prove:
 *   - The play-in lasts `--motion-in`, rises from `--motion-in-offset` below its place and
 *     runs on `--ease-out`; the stop-out lasts `--motion-out`, lifts by the same offset and
 *     runs on `--ease-in`. The manifest promises the two lengths to a renderer
 *     (noticeManifest.test.ts checks it against the token file).
 *   - On a page without the theme every timeline lasts 0 (no motion, as the theme
 *     package promises for a missing token), so every action still ends.
 *   - With skipAnimation, a timeline jumps straight to its end and the promise resolves
 *     at once, and a finished timeline is killed, so GSAP holds nothing during a day in OBS.
 *
 * What these tests deliberately do not cover:
 *   - What the animations look like; e2e/noticeLifecycle.e2e.ts watches the card come in
 *     and go out in Chromium.
 *   - Reading and parsing the tokens; packages/theme tests readMotionTokens.
 */
import { gsapEaseOfToken } from '@bajaovrlay/theme/motion';
import { gsap } from 'gsap';
import { describe, expect, it, onTestFinished } from 'vitest';

import {
  buildPlayInTimeline,
  buildStopOutTimeline,
  type NoticeAnimatedElements,
  playTimelineToTheEnd,
} from './noticeAnimations.js';

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

/** Builds a bare stand-in for the card the animations move, on the page. */
function createAnimatedElementsInAnEmptyPage(): NoticeAnimatedElements {
  const panel = document.createElement('section');
  document.body.append(panel);
  onTestFinished(() => panel.remove());
  return { panel };
}

/** Reads what a one-tween timeline will do: its length, its start and end y, its ease. */
function describeTheOnlyTween(timeline: ReturnType<typeof gsap.timeline>) {
  const tween = timeline.getChildren()[0];
  return {
    lengthMs: Math.round(timeline.duration() * 1000),
    ease: tween?.vars.ease,
    endY: tween?.vars.y,
  };
}

describe('notice timelines with the Ardósia tokens on the page', () => {
  it('rises in over --motion-in (400 ms) from 20 px below, on --ease-out', () => {
    // Arrange: the theme's motion tokens on :root and the card.
    placeArdosiaMotionTokensOnTheRoot();
    const animatedElements = createAnimatedElementsInAnEmptyPage();

    // Act: build the play-in (paused; nothing moves yet), note where the card starts, and
    // read the tween.
    const timeline = buildPlayInTimeline(animatedElements);
    timeline.progress(0);
    const startY = gsap.getProperty(animatedElements.panel, 'y');
    const tween = describeTheOnlyTween(timeline);
    timeline.kill();

    // Assert: the length, the rise and the curve are the tokens'.
    expect(tween.lengthMs, 'the play-in must last --motion-in').toBe(400);
    expect(startY, 'the card must start --motion-in-offset below its place').toBe(20);
    expect(tween.endY, 'the card must end in its place').toBe(0);
    expect(tween.ease, 'the play-in must run on --ease-out').toBe(
      gsapEaseOfToken(ardosiaMotionTokenDeclarations['--ease-out'] ?? ''),
    );
  });

  it('lifts out over --motion-out (250 ms) by 20 px, on --ease-in', () => {
    // Arrange: the theme's motion tokens on :root and the card.
    placeArdosiaMotionTokensOnTheRoot();
    const animatedElements = createAnimatedElementsInAnEmptyPage();

    // Act: build the stop-out and read the tween.
    const timeline = buildStopOutTimeline(animatedElements);
    const tween = describeTheOnlyTween(timeline);
    timeline.kill();

    // Assert: the length, the lift and the curve are the tokens'.
    expect(tween.lengthMs, 'the stop-out must last --motion-out').toBe(250);
    expect(tween.endY, 'the card must lift --motion-in-offset as it fades').toBe(-20);
    expect(tween.ease, 'the stop-out must run on --ease-in').toBe(
      gsapEaseOfToken(ardosiaMotionTokenDeclarations['--ease-in'] ?? ''),
    );
  });
});

describe('notice timelines on a page without the theme', () => {
  it('build with no length at all, so every action still ends at once', () => {
    // Arrange: no token on :root (nothing was placed), and the card.
    const animatedElements = createAnimatedElementsInAnEmptyPage();

    // Act: build the play-in and the stop-out and measure them.
    const playIn = buildPlayInTimeline(animatedElements);
    const stopOut = buildStopOutTimeline(animatedElements);
    const lengthsMs = [playIn.duration() * 1000, stopOut.duration() * 1000];
    playIn.kill();
    stopOut.kill();

    // Assert: a missing token reads as 0 ms, never as a timeline that never ends.
    expect(lengthsMs, 'without the theme both timelines must last 0 ms').toEqual([0, 0]);
  });
});

describe('playTimelineToTheEnd', () => {
  it('jumps to the end, resolves at once and leaves nothing in GSAP when skipAnimation is set', async () => {
    // Arrange: a play-in timeline that would normally take 400 ms.
    placeArdosiaMotionTokensOnTheRoot();
    const animatedElements = createAnimatedElementsInAnEmptyPage();
    const timeline = buildPlayInTimeline(animatedElements);

    // Act: play it with skipAnimation, as a renderer may ask.
    await playTimelineToTheEnd(timeline, { skipAnimation: true });

    // Assert: the card is at its end state and no tween on it is left behind.
    expect(animatedElements.panel.style.opacity, 'skipAnimation must jump to the end').toBe('1');
    expect(
      gsap.getTweensOf(animatedElements.panel),
      'a finished timeline must be killed, or a day on air in OBS piles them up',
    ).toEqual([]);
  });

  it('kills a timeline it played to the end in real time, so GSAP keeps nothing', async () => {
    // Arrange: a stop-out timeline on the card (250 ms of real animation).
    placeArdosiaMotionTokensOnTheRoot();
    const animatedElements = createAnimatedElementsInAnEmptyPage();
    const timeline = buildStopOutTimeline(animatedElements);

    // Act: play it through and wait until it has finished.
    await playTimelineToTheEnd(timeline, { skipAnimation: false });

    // Assert: the card ended invisible and no tween on it is left behind in GSAP.
    expect(animatedElements.panel.style.opacity, 'the out animation must have ended').toBe('0');
    expect(
      gsap.getTweensOf(animatedElements.panel),
      'a finished timeline must be killed, or a day on air in OBS piles them up',
    ).toEqual([]);
  });
});
