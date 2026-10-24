/**
 * Team card animations (packages/graphics/team-card)
 *
 * What this module is for:
 *   The team card rises in whole on play, its photo and logo with it, and lifts out on
 *   stop (the design's motion.md, "Team card"). The GSAP timelines live here and take
 *   every duration, offset and ease from the theme's motion tokens (`--motion-*`,
 *   `--ease-*`), read from the page through `@bajaovrlay/theme/motion`.
 *
 * What these tests prove:
 *   - The play-in lasts `--motion-in`, rises from `--motion-in-offset` below its place and
 *     runs on `--ease-out`; the stop-out lasts `--motion-out`, lifts by the same offset and
 *     runs on `--ease-in`. The manifest promises the two lengths to a renderer
 *     (teamCardManifest.test.ts checks it against the token file).
 *   - The timelines move the card alone, one tween: the photo and the logo, inside it,
 *     come and go with it, never after.
 *   - On a page without the theme every timeline lasts 0, so every action still ends.
 *   - With skipAnimation, a timeline jumps straight to its end, and a finished timeline
 *     leaves nothing behind in GSAP.
 *
 * What these tests deliberately do not cover:
 *   - What the animations look like; e2e/teamCardLifecycle.e2e.ts watches the card come
 *     in and go out in Chromium.
 *   - Reading and parsing the tokens; packages/theme tests readMotionTokens.
 */
import { playTimelineToTheEnd } from '@bajaovrlay/graphics-kit/timelinePlayback';
import { gsapEaseOfToken } from '@bajaovrlay/theme/motion';
import { gsap } from 'gsap';
import { describe, expect, it, onTestFinished } from 'vitest';

import {
  buildPlayInTimeline,
  buildStopOutTimeline,
  type TeamCardAnimatedElements,
} from './teamCardAnimations.js';

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

/** Builds a stand-in for the card with a photo and a logo inside it, on the page. */
function createCardWithMediaInAnEmptyPage(): TeamCardAnimatedElements {
  const panel = document.createElement('section');
  panel.append(document.createElement('img'), document.createElement('img'));
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

describe('team card timelines with the Ardósia tokens on the page', () => {
  it('rises in over --motion-in (400 ms) from 20 px below, on --ease-out', () => {
    // Arrange: the theme's motion tokens on :root and the card.
    placeArdosiaMotionTokensOnTheRoot();
    const animatedElements = createCardWithMediaInAnEmptyPage();

    // Act: build the play-in (paused; nothing moves yet), note where the card starts, and
    // read the timeline.
    const timeline = buildPlayInTimeline(animatedElements);
    timeline.progress(0);
    const startY = gsap.getProperty(animatedElements.panel, 'y');
    const playIn = describeTimeline(timeline);
    timeline.kill();

    // Assert: the length, the rise and the curve are the tokens'.
    expect(playIn.lengthMs, 'the play-in must last --motion-in').toBe(400);
    expect(startY, 'the card must start --motion-in-offset below its place').toBe(20);
    expect(playIn.endY, 'the card must end in its place').toBe(0);
    expect(playIn.ease, 'the play-in must run on --ease-out').toBe(
      gsapEaseOfToken(ardosiaMotionTokenDeclarations['--ease-out'] ?? ''),
    );
  });

  it('moves the whole card in one tween, so the photo and the logo come with it, never after', () => {
    // Arrange: the theme's motion tokens on :root and a card holding a photo and a logo.
    placeArdosiaMotionTokensOnTheRoot();
    const animatedElements = createCardWithMediaInAnEmptyPage();

    // Act: build the play-in and read what it moves.
    const timeline = buildPlayInTimeline(animatedElements);
    const playIn = describeTimeline(timeline);
    timeline.kill();

    // Assert: one tween, on the card itself; nothing inside it moves on its own.
    expect(playIn.tweenCount, 'the play-in must be a single motion').toBe(1);
    expect(playIn.targets, 'the play-in must move the card, media and all').toEqual([
      animatedElements.panel,
    ]);
  });

  it('lifts out over --motion-out (250 ms) by 20 px, on --ease-in', () => {
    // Arrange: the theme's motion tokens on :root and the card.
    placeArdosiaMotionTokensOnTheRoot();
    const animatedElements = createCardWithMediaInAnEmptyPage();

    // Act: build the stop-out and read it.
    const timeline = buildStopOutTimeline(animatedElements);
    const stopOut = describeTimeline(timeline);
    timeline.kill();

    // Assert: the length, the lift and the curve are the tokens'.
    expect(stopOut.lengthMs, 'the stop-out must last --motion-out').toBe(250);
    expect(stopOut.endY, 'the card must lift --motion-in-offset as it fades').toBe(-20);
    expect(stopOut.ease, 'the stop-out must run on --ease-in').toBe(
      gsapEaseOfToken(ardosiaMotionTokenDeclarations['--ease-in'] ?? ''),
    );
  });
});

describe('team card timelines on a page without the theme', () => {
  it('build with no length at all, so every action still ends at once', () => {
    // Arrange: no token on :root (nothing was placed), and the card.
    const animatedElements = createCardWithMediaInAnEmptyPage();

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

describe('playTimelineToTheEnd on the team card', () => {
  it('jumps to the end and leaves nothing in GSAP when skipAnimation is set', async () => {
    // Arrange: a play-in timeline that would normally take 400 ms.
    placeArdosiaMotionTokensOnTheRoot();
    const animatedElements = createCardWithMediaInAnEmptyPage();
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
});
