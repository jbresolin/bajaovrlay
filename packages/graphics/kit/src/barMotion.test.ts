/**
 * The motion of the bars along the bottom (packages/graphics/kit)
 *
 * What this module is for:
 *   The lower strip and the message ticker move alike (motion.md): their pieces rise in
 *   a row stagger apart, leave together, and a page turns in place, the old pieces lifting
 *   away while the new rise into the same places. barMotion.ts builds those GSAP
 *   timelines from the theme's motion tokens.
 *
 * What these tests prove:
 *   - The play-in starts each piece `--motion-row-stagger` (30 ms) after the one before,
 *     each rising over `--motion-in` (400 ms): the strip's clock block, six cars and the
 *     page cell are in at 7 × 30 + 400 = 610 ms.
 *   - The stop-out takes every piece out together over `--motion-out` (250 ms).
 *   - A page turn moves the old and the new pieces at once, each over
 *     `--motion-strip-page` (300 ms), `--motion-page-stagger` (15 ms) apart: six old and
 *     six new cars take 5 × 15 + 300 = 375 ms, and the bar is never empty.
 *   - Without the theme every timeline lasts 0, so every action still ends.
 *
 * What these tests deliberately do not cover:
 *   - What the motion looks like; each bar's lifecycle e2e watches it in Chromium.
 *   - Reading the tokens; packages/theme tests readMotionTokens.
 */
import { gsap } from 'gsap';
import { describe, expect, it, onTestFinished } from 'vitest';

import {
  buildBarPageTurnTimeline,
  buildBarPlayInTimeline,
  buildBarStopOutTimeline,
} from './barMotion.js';

/** Ardósia's motion tokens the bars read, as packages/theme/ardosia/tokens.css declares them. */
const ardosiaBarMotionTokens: Record<string, string> = {
  '--motion-in': '400ms',
  '--motion-out': '250ms',
  '--motion-row-stagger': '30ms',
  '--motion-strip-page': '300ms',
  '--motion-page-stagger': '15ms',
  '--motion-in-offset': '20',
  '--ease-out': 'cubic-bezier(0.16, 1, 0.3, 1)',
  '--ease-in': 'cubic-bezier(0.7, 0, 0.84, 0)',
};

/** Puts Ardósia's motion tokens on :root, as the renderer page does, until the test ends. */
function placeArdosiaMotionTokensOnTheRoot(): void {
  const root = document.documentElement;
  for (const [tokenName, value] of Object.entries(ardosiaBarMotionTokens)) {
    root.style.setProperty(tokenName, value);
  }
  onTestFinished(() => {
    for (const tokenName of Object.keys(ardosiaBarMotionTokens)) {
      root.style.removeProperty(tokenName);
    }
  });
}

/** Builds pieces of a bar on the page: stand-ins for the clock block, cars and page cell. */
function createBarPieces(count: number): HTMLElement[] {
  const pieces = Array.from({ length: count }, () => document.createElement('div'));
  document.body.append(...pieces);
  onTestFinished(() => {
    for (const piece of pieces) {
      piece.remove();
    }
  });
  return pieces;
}

/** Reads when each tween of a timeline starts, in ms, and how long the whole lasts. */
function describeTimeline(timeline: ReturnType<typeof gsap.timeline>) {
  return {
    lengthMs: Math.round(timeline.duration() * 1000),
    startsMs: timeline.getChildren().map((tween) => Math.round(tween.startTime() * 1000)),
  };
}

describe('the bars’ timelines with the Ardósia tokens on the page', () => {
  it('cascades the play-in a row stagger apart: the strip is in at 610 ms', () => {
    // Arrange: the tokens and eight pieces (the clock block, six cars, the page cell).
    placeArdosiaMotionTokensOnTheRoot();
    const pieces = createBarPieces(8);

    // Act: build the play-in and read it.
    const timeline = buildBarPlayInTimeline(pieces[0] as Element, pieces);
    const playIn = describeTimeline(timeline);
    timeline.kill();

    // Assert: 30 ms apart, left to right, the last one in 400 ms after it starts.
    expect(playIn.startsMs, 'each piece 30 ms after the one before').toEqual([
      0, 30, 60, 90, 120, 150, 180, 210,
    ]);
    expect(playIn.lengthMs, 'in at 7 × 30 + 400 ms').toBe(610);
  });

  it('takes every piece out together over --motion-out', () => {
    // Arrange: the tokens and eight pieces.
    placeArdosiaMotionTokensOnTheRoot();
    const pieces = createBarPieces(8);

    // Act: build the stop-out and read it.
    const timeline = buildBarStopOutTimeline(pieces[0] as Element, pieces);
    const stopOut = describeTimeline(timeline);
    timeline.kill();

    // Assert: one tween for all, 250 ms.
    expect(stopOut.startsMs, 'all pieces leave at once').toEqual([0]);
    expect(stopOut.lengthMs, 'out over 250 ms').toBe(250);
  });

  it('turns a page in place: old and new cars move at once, 15 ms apart, over 300 ms', () => {
    // Arrange: the tokens, six cars leaving and six arriving.
    placeArdosiaMotionTokensOnTheRoot();
    const leavingCars = createBarPieces(6);
    const arrivingCars = createBarPieces(6);

    // Act: build the turn and read it.
    const timeline = buildBarPageTurnTimeline(leavingCars[0] as Element, leavingCars, arrivingCars);
    const turn = describeTimeline(timeline);
    timeline.kill();

    // Assert: the leaving and the arriving cascades start together, 15 ms apart each (GSAP
    // lists the tweens by start, so a leaving car and its arriving one come in pairs), and
    // the last arrives 5 × 15 + 300 ms in: the bar is never empty.
    expect(turn.startsMs, 'both cascades start at once, 15 ms apart').toEqual([
      0, 0, 15, 15, 30, 30, 45, 45, 60, 60, 75, 75,
    ]);
    expect(turn.lengthMs, 'the turn lasts 375 ms').toBe(375);
  });
});

describe('the bars’ timelines on a page without the theme', () => {
  it('build with no length at all, so every action still ends at once', () => {
    // Arrange: no token on :root, and eight pieces.
    const pieces = createBarPieces(8);

    // Act: build each timeline and measure it.
    const timelines = [
      buildBarPlayInTimeline(pieces[0] as Element, pieces),
      buildBarStopOutTimeline(pieces[0] as Element, pieces),
      buildBarPageTurnTimeline(pieces[0] as Element, pieces.slice(0, 4), pieces.slice(4)),
    ];
    const lengthsMs = timelines.map((timeline) => timeline.duration() * 1000);
    for (const timeline of timelines) {
      timeline.kill();
    }

    // Assert: a missing token reads as 0 ms, never as a timeline that never ends.
    expect(lengthsMs, 'without the theme every timeline lasts 0 ms').toEqual([0, 0, 0]);
  });
});
