/**
 * Lower third animations (packages/graphics/lower-third)
 *
 * What this module is for:
 *   The lower third comes in as the design's motion.md says: "the name pill first, the
 *   role pill 100 ms behind it ... Out together". The GSAP timelines live here and take
 *   every duration, delay, offset and ease from the theme's motion tokens (`--motion-*`,
 *   `--ease-*`), read from the page through `@bajaovrlay/theme/motion`.
 *
 * What these tests prove:
 *   - The play-in: the name pill starts at once and the role pill `--motion-lead`
 *     (100 ms) later; each lasts `--motion-in` (400 ms), rises from `--motion-in-offset`
 *     (20 px) below its place and runs on `--ease-out`; the whole play-in lasts
 *     `--motion-in` + `--motion-lead` (500 ms), the length the manifest promises
 *     (lowerThirdManifest.test.ts checks it against the token file).
 *   - The stop-out: both pills start together, last `--motion-out` (250 ms), lift by the
 *     same offset and run on `--ease-in`.
 *   - On a page without the theme every timeline lasts 0 (no motion, as the theme
 *     package promises for a missing token), so every action still ends.
 *   - With skipAnimation a timeline jumps straight to its end, and a finished timeline
 *     is killed, so GSAP holds nothing during a day in OBS.
 *
 * What these tests deliberately do not cover:
 *   - What the animations look like; e2e/lowerThirdLifecycle.e2e.ts watches the pills
 *     come in and go out in Chromium.
 *   - Reading and parsing the tokens; packages/theme tests readMotionTokens.
 */
import { playTimelineToTheEnd } from '@bajaovrlay/graphics-kit/timelinePlayback';
import { gsapEaseOfToken } from '@bajaovrlay/theme/motion';
import { gsap } from 'gsap';
import { describe, expect, it, onTestFinished } from 'vitest';

import {
  buildPlayInTimeline,
  buildStopOutTimeline,
  type LowerThirdAnimatedElements,
  type LowerThirdTimeline,
} from './lowerThirdAnimations.js';

/** The motion tokens of Ardósia, as packages/theme/ardosia/tokens.css declares them. */
const ardosiaMotionTokenDeclarations: Record<string, string> = {
  '--motion-in': '400ms',
  '--motion-out': '250ms',
  '--motion-lead': '100ms',
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

/** Builds bare stand-ins for the two pills the animations move, on the page. */
function createAnimatedElementsInAnEmptyPage(): LowerThirdAnimatedElements {
  const namePill = document.createElement('div');
  const rolePill = document.createElement('div');
  document.body.append(namePill, rolePill);
  onTestFinished(() => {
    namePill.remove();
    rolePill.remove();
  });
  return { namePill, rolePill };
}

/** Reads what one tween of a timeline does: when it starts, how long, where it ends, its ease. */
function describeTweenOf(timeline: LowerThirdTimeline, target: HTMLElement) {
  const tween = timeline
    .getChildren()
    .find((child) => (child as gsap.core.Tween).targets().includes(target));
  return {
    startMs: Math.round((tween?.startTime() ?? -1) * 1000),
    lengthMs: Math.round((tween?.duration() ?? -1) * 1000),
    endY: tween?.vars.y,
    ease: tween?.vars.ease,
  };
}

describe('lower third timelines with the Ardósia tokens on the page', () => {
  it('brings the name pill in at once and the role pill --motion-lead (100 ms) behind it', () => {
    // Arrange: the theme's motion tokens on :root and the two pills.
    placeArdosiaMotionTokensOnTheRoot();
    const animatedElements = createAnimatedElementsInAnEmptyPage();

    // Act: build the play-in (paused; nothing moves yet), note where the pills start and
    // read both tweens.
    const timeline = buildPlayInTimeline(animatedElements);
    timeline.progress(0);
    const startY = [
      gsap.getProperty(animatedElements.namePill, 'y'),
      gsap.getProperty(animatedElements.rolePill, 'y'),
    ];
    const nameTween = describeTweenOf(timeline, animatedElements.namePill);
    const roleTween = describeTweenOf(timeline, animatedElements.rolePill);
    const wholeLengthMs = Math.round(timeline.duration() * 1000);
    timeline.kill();

    // Assert: the starts, lengths, rise and curve are the tokens'.
    const entryEase = gsapEaseOfToken(ardosiaMotionTokenDeclarations['--ease-out'] ?? '');
    expect(nameTween, 'the name pill must start at once, last --motion-in, on --ease-out').toEqual({
      startMs: 0,
      lengthMs: 400,
      endY: 0,
      ease: entryEase,
    });
    expect(
      roleTween,
      'the role pill must start --motion-lead later, last --motion-in, on --ease-out',
    ).toEqual({ startMs: 100, lengthMs: 400, endY: 0, ease: entryEase });
    expect(startY, 'both pills must start --motion-in-offset below their place').toEqual([20, 20]);
    expect(wholeLengthMs, 'the play-in must last --motion-in + --motion-lead').toBe(500);
  });

  it('takes both pills out together over --motion-out (250 ms), lifting 20 px, on --ease-in', () => {
    // Arrange: the theme's motion tokens on :root and the two pills.
    placeArdosiaMotionTokensOnTheRoot();
    const animatedElements = createAnimatedElementsInAnEmptyPage();

    // Act: build the stop-out and read the tween of each pill.
    const timeline = buildStopOutTimeline(animatedElements);
    const nameTween = describeTweenOf(timeline, animatedElements.namePill);
    const roleTween = describeTweenOf(timeline, animatedElements.rolePill);
    const wholeLengthMs = Math.round(timeline.duration() * 1000);
    timeline.kill();

    // Assert: one start, one length, one lift and one curve for both pills.
    const exitEase = gsapEaseOfToken(ardosiaMotionTokenDeclarations['--ease-in'] ?? '');
    const expectedTween = { startMs: 0, lengthMs: 250, endY: -20, ease: exitEase };
    expect(nameTween, 'the name pill must leave at once, over --motion-out').toEqual(expectedTween);
    expect(roleTween, 'the role pill must leave together with the name pill').toEqual(
      expectedTween,
    );
    expect(wholeLengthMs, 'the stop-out must last --motion-out').toBe(250);
  });
});

describe('lower third timelines on a page without the theme', () => {
  it('build with no length at all, so every action still ends at once', () => {
    // Arrange: no token on :root (nothing was placed), and the two pills.
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

describe('playTimelineToTheEnd with the lower third', () => {
  it('jumps to the end and leaves nothing in GSAP when skipAnimation is set', async () => {
    // Arrange: a play-in timeline that would normally take 500 ms.
    placeArdosiaMotionTokensOnTheRoot();
    const animatedElements = createAnimatedElementsInAnEmptyPage();
    const timeline = buildPlayInTimeline(animatedElements);

    // Act: play it with skipAnimation, as a renderer may ask.
    await playTimelineToTheEnd(timeline, { skipAnimation: true });

    // Assert: both pills are fully in, and no tween on them is left behind.
    expect(
      [animatedElements.namePill.style.opacity, animatedElements.rolePill.style.opacity],
      'skipAnimation must jump both pills to the end',
    ).toEqual(['1', '1']);
    expect(
      gsap.getTweensOf([animatedElements.namePill, animatedElements.rolePill]),
      'a finished timeline must be killed, or a day on air in OBS piles them up',
    ).toEqual([]);
  });

  it('kills a timeline it played to the end in real time, so GSAP keeps nothing', async () => {
    // Arrange: a stop-out timeline on the two pills (250 ms of real animation).
    placeArdosiaMotionTokensOnTheRoot();
    const animatedElements = createAnimatedElementsInAnEmptyPage();
    const timeline = buildStopOutTimeline(animatedElements);

    // Act: play it through and wait until it has finished.
    await playTimelineToTheEnd(timeline, { skipAnimation: false });

    // Assert: both pills ended invisible and no tween on them is left behind.
    expect(
      [animatedElements.namePill.style.opacity, animatedElements.rolePill.style.opacity],
      'the out animation must have ended for both pills',
    ).toEqual(['0', '0']);
    expect(
      gsap.getTweensOf([animatedElements.namePill, animatedElements.rolePill]),
      'a finished timeline must be killed, or a day on air in OBS piles them up',
    ).toEqual([]);
  });
});
