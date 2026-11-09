/**
 * Race clock animations (packages/graphics/race-clock)
 *
 * What this module is for:
 *   The race clock rises in on play, lifts out on stop, crossfades a new flag band over
 *   the old one on a flag change, and grows or shrinks by the band's height when the
 *   band is switched on or off on air (it never snaps). The GSAP timelines live here
 *   and take every duration, offset and ease from the theme's motion tokens
 *   (`--motion-*`, `--ease-*`), read from the page through `@bajaovrlay/theme/motion`.
 *
 * What these tests prove:
 *   - Each timeline lasts exactly what its token says: the play-in `--motion-in`, the
 *     stop-out `--motion-out`, the flag crossfade and the band toggle `--motion-flag`.
 *     The manifest promises the first two to a renderer (raceClockManifest.test.ts
 *     checks it against the token file), so these numbers are the ones on air.
 *   - On a page without the theme every timeline lasts 0 (no motion, as the theme
 *     package promises for a missing token), so every action still ends.
 *   - The band toggle animates the card's height between the two heights it is given
 *     and leaves no inline height behind once it ends, so the styles own the height
 *     again.
 *   - The band toggle writes its starting look (the card's height, the band's opacity)
 *     the moment it is built, even when GSAP would rather wait for its next render: built
 *     between a GSAP frame and that frame's render, the card already reads 192 px. Under
 *     load a test landed in that gap by chance and read '' (BAJAOVRLAY-68).
 *   - The band toggle runs on `--ease-out` whether the band comes on or goes, like the
 *     flag crossfade (the design's motion.md: a flag change settles, it is not a piece
 *     leaving on `--ease-in`).
 *   - With skipAnimation, a timeline jumps straight to its end and the promise
 *     resolves at once, as the OGraf spec asks.
 *   - A timeline that reached its end, by skipAnimation or by playing, is killed, so
 *     GSAP holds no finished timelines during a whole day on air inside OBS.
 *
 * What these tests deliberately do not cover:
 *   - What the animations look like; the Playwright screenshots show the end states,
 *     and e2e/raceClockOnAir.e2e.ts checks the crossfade and the toggle are gradual in
 *     a real browser.
 *   - Reading and parsing the tokens; packages/theme tests readMotionTokens.
 */
import { playTimelineToTheEnd } from '@bajaovrlay/graphics-kit/timelinePlayback';
import { gsapEaseOfToken } from '@bajaovrlay/theme/motion';
import { gsap } from 'gsap';
import { describe, expect, it, onTestFinished } from 'vitest';

import {
  buildFlagBandToggleTimeline,
  buildFlagChangeTimeline,
  buildPlayInTimeline,
  buildStopOutTimeline,
  type RaceClockAnimatedElements,
} from './raceClockAnimations.js';

/** The motion tokens of Ardósia, as packages/theme/ardosia/tokens.css declares them. */
const ardosiaMotionTokenDeclarations: Record<string, string> = {
  '--motion-in': '400ms',
  '--motion-out': '250ms',
  '--motion-flag': '300ms',
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

/** Builds bare stand-ins for the three elements the animations move, on the page. */
function createAnimatedElementsInAnEmptyPage(): RaceClockAnimatedElements {
  const panel = document.createElement('section');
  const flagBand = document.createElement('div');
  const incomingFlagLayer = document.createElement('div');
  panel.append(flagBand);
  flagBand.append(incomingFlagLayer);
  document.body.append(panel);
  onTestFinished(() => panel.remove());
  return { panel, flagBand, incomingFlagLayer };
}

/**
 * Runs `callback` between a GSAP frame and that frame's render: the ticker has counted a
 * new frame, but GSAP has not yet rendered its root timeline for it. In that gap GSAP
 * holds back the first render of a new tween ("lazy" rendering) until the root renders.
 * A listener added with `prioritize` runs before GSAP's own root render, and ticking by
 * hand makes the frame happen now, so the gap is reached every time, not just under load.
 */
function runBetweenAGsapFrameAndItsRender(callback: () => void): void {
  const runOnEveryFrame = false;
  const runBeforeGsapRendersTheFrame = true;
  gsap.ticker.add(callback, runOnEveryFrame, runBeforeGsapRendersTheFrame);
  try {
    gsap.ticker.tick();
  } finally {
    // Removed here rather than with GSAP's run-once flag, which would leave the listener
    // running on every frame after a callback that threw.
    gsap.ticker.remove(callback);
  }
}

/** The card's heights with and without the band, as Ardósia draws them: 192 and 152 px. */
const cardHeightWithBandPx = 192;
const cardHeightWithoutBandPx = 152;

const timelineLengthScenarios = [
  // playAction: the manifest promises --motion-in for the way in.
  {
    name: 'the play-in timeline lasts --motion-in (400 ms)',
    build: (elements: RaceClockAnimatedElements) => buildPlayInTimeline(elements),
    expectedMs: 400,
  },
  // stopAction: the manifest promises --motion-out for the way out.
  {
    name: 'the stop-out timeline lasts --motion-out (250 ms)',
    build: (elements: RaceClockAnimatedElements) => buildStopOutTimeline(elements),
    expectedMs: 250,
  },
  // A flag change during updateAction: the new band crossfades in over --motion-flag.
  {
    name: 'the flag-change timeline lasts --motion-flag (300 ms)',
    build: (elements: RaceClockAnimatedElements) => buildFlagChangeTimeline(elements),
    expectedMs: 300,
  },
  // The band switched on or off during updateAction: the card grows or shrinks over --motion-flag.
  {
    name: 'the flag-band toggle timeline lasts --motion-flag (300 ms)',
    build: (elements: RaceClockAnimatedElements) =>
      buildFlagBandToggleTimeline(elements, {
        heightBeforePx: cardHeightWithBandPx,
        heightAfterPx: cardHeightWithoutBandPx,
        isShowing: false,
      }),
    expectedMs: 300,
  },
];

describe('race clock timelines with the Ardósia tokens on the page', () => {
  it.each(timelineLengthScenarios)('$name', ({ build, expectedMs }) => {
    // Arrange: the theme's motion tokens on :root and the elements the timeline moves.
    placeArdosiaMotionTokensOnTheRoot();
    const animatedElements = createAnimatedElementsInAnEmptyPage();

    // Act: build the timeline (paused; nothing moves yet) and measure it.
    const timeline = build(animatedElements);
    const timelineLengthMs = Math.round(timeline.duration() * 1000);
    timeline.kill();

    // Assert: it lasts exactly what the token says.
    expect(timelineLengthMs, 'the timeline must last exactly what its motion token says').toBe(
      expectedMs,
    );
  });
});

describe('race clock timelines on a page without the theme', () => {
  it('build with no length at all, so every action still ends at once', () => {
    // Arrange: no token on :root (nothing was placed), and the elements.
    const animatedElements = createAnimatedElementsInAnEmptyPage();

    // Act: build the play-in and measure it.
    const timeline = buildPlayInTimeline(animatedElements);
    const timelineLengthMs = timeline.duration() * 1000;
    timeline.kill();

    // Assert: a missing token reads as 0 ms, never as a timeline that never ends.
    expect(timelineLengthMs, 'without the theme the play-in must last 0 ms').toBe(0);
  });
});

describe('the flag-band toggle', () => {
  it('animates the card from its height with the band to its height without, then clears the inline height', async () => {
    // Arrange: the tokens on :root and the card at 192 px, the band about to go.
    placeArdosiaMotionTokensOnTheRoot();
    const animatedElements = createAnimatedElementsInAnEmptyPage();
    const timeline = buildFlagBandToggleTimeline(animatedElements, {
      heightBeforePx: cardHeightWithBandPx,
      heightAfterPx: cardHeightWithoutBandPx,
      isShowing: false,
    });

    // Act: note the inline height at the start, half way, and after the end.
    const inlineHeightAtStart = animatedElements.panel.style.height;
    timeline.progress(0.5);
    const inlineHeightHalfWay = Number.parseFloat(animatedElements.panel.style.height);
    await playTimelineToTheEnd(timeline, { skipAnimation: true });
    const inlineHeightAfterTheEnd = animatedElements.panel.style.height;

    // Assert: the card starts at 192, is between the two heights half way, and once the
    // toggle ends no inline height is left: the styles (data-flag-band) own it again.
    expect(inlineHeightAtStart, 'the toggle must start from the height with the band').toBe(
      `${cardHeightWithBandPx}px`,
    );
    expect(inlineHeightHalfWay, 'half way the card must be between the two heights').toBeLessThan(
      cardHeightWithBandPx,
    );
    expect(
      inlineHeightHalfWay,
      'half way the card must be between the two heights',
    ).toBeGreaterThan(cardHeightWithoutBandPx);
    expect(inlineHeightAfterTheEnd, 'the toggle must leave no inline height behind').toBe('');
  });

  it('starts the card at its height with the band the moment the toggle is built, even between a GSAP frame and its render', () => {
    // Arrange: the tokens on :root and the card at 192 px with the band, the band about
    // to go.
    placeArdosiaMotionTokensOnTheRoot();
    const animatedElements = createAnimatedElementsInAnEmptyPage();
    let inlineHeightAtStart = 'not read yet';
    let bandOpacityAtStart = 'not read yet';

    // Act: in the gap where GSAP would rather wait, build the toggle and at once note the
    // card's inline height and the band's opacity, before GSAP gets to render anything.
    runBetweenAGsapFrameAndItsRender(() => {
      const timeline = buildFlagBandToggleTimeline(animatedElements, {
        heightBeforePx: cardHeightWithBandPx,
        heightAfterPx: cardHeightWithoutBandPx,
        isShowing: false,
      });
      inlineHeightAtStart = animatedElements.panel.style.height;
      bandOpacityAtStart = animatedElements.flagBand.style.opacity;
      timeline.kill();
    });

    // Assert: both start values are already written: the card is 192 px tall and the band
    // fully shown, so nothing can catch the card at the height the styles now give it.
    expect(
      inlineHeightAtStart,
      'the toggle must write the height with the band as soon as it is built',
    ).toBe(`${cardHeightWithBandPx}px`);
    expect(
      bandOpacityAtStart,
      'the toggle must write the band fully shown as soon as it is built',
    ).toBe('1');
  });

  const bandToggleDirections = [
    // The band coming on: the card grows. An entry, so --ease-out is the obvious curve.
    {
      name: 'uses --ease-out when the band comes on',
      toggle: {
        heightBeforePx: cardHeightWithoutBandPx,
        heightAfterPx: cardHeightWithBandPx,
        isShowing: true,
      },
    },
    // The band going: the card shrinks. Still --ease-out, not the exit curve --ease-in:
    // motion.md gives every flag change --ease-out, and a card that accelerated away
    // would read as the clock leaving.
    {
      name: 'uses --ease-out when the band goes too, as the design gives every flag change',
      toggle: {
        heightBeforePx: cardHeightWithBandPx,
        heightAfterPx: cardHeightWithoutBandPx,
        isShowing: false,
      },
    },
  ];

  it.each(bandToggleDirections)('$name', ({ toggle }) => {
    // Arrange: the tokens on :root, the elements, and the GSAP name of the --ease-out curve.
    placeArdosiaMotionTokensOnTheRoot();
    const animatedElements = createAnimatedElementsInAnEmptyPage();
    const easeOutName = gsapEaseOfToken(ardosiaMotionTokenDeclarations['--ease-out'] ?? '');

    // Act: build the toggle and read the ease of each tween in it (the height and the band).
    const timeline = buildFlagBandToggleTimeline(animatedElements, toggle);
    const easesOfTheTweens = timeline.getChildren().map((tween) => tween.vars.ease);
    timeline.kill();

    // Assert: both tweens run on the --ease-out curve.
    expect(easesOfTheTweens, 'the height and the band must both run on --ease-out').toEqual([
      easeOutName,
      easeOutName,
    ]);
  });
});

describe('playTimelineToTheEnd', () => {
  it('jumps to the end and resolves at once when skipAnimation is set', async () => {
    // Arrange: a play-in timeline that would normally take 400 ms.
    placeArdosiaMotionTokensOnTheRoot();
    const animatedElements = createAnimatedElementsInAnEmptyPage();
    const timeline = buildPlayInTimeline(animatedElements);

    // Act: play it with skipAnimation, as a renderer may ask.
    await playTimelineToTheEnd(timeline, { skipAnimation: true });

    // Assert: the timeline is already at its end.
    expect(timeline.progress(), 'skipAnimation must jump straight to the end').toBe(1);
  });

  it('kills a timeline it jumped to the end with skipAnimation, so GSAP keeps nothing', async () => {
    // Arrange: a play-in timeline on the panel.
    placeArdosiaMotionTokensOnTheRoot();
    const animatedElements = createAnimatedElementsInAnEmptyPage();
    const timeline = buildPlayInTimeline(animatedElements);

    // Act: play it with skipAnimation.
    await playTimelineToTheEnd(timeline, { skipAnimation: true });

    // Assert: no tween on the panel is left behind in GSAP.
    expect(
      gsap.getTweensOf(animatedElements.panel),
      'a finished timeline must be killed, or a day on air in OBS piles them up',
    ).toEqual([]);
  });

  it('kills a timeline it played to the end in real time, so GSAP keeps nothing', async () => {
    // Arrange: a stop-out timeline on the panel (250 ms of real animation).
    placeArdosiaMotionTokensOnTheRoot();
    const animatedElements = createAnimatedElementsInAnEmptyPage();
    const timeline = buildStopOutTimeline(animatedElements);

    // Act: play it through and wait until it has finished.
    await playTimelineToTheEnd(timeline, { skipAnimation: false });

    // Assert: the panel ended invisible and no tween on it is left behind in GSAP.
    expect(animatedElements.panel.style.opacity, 'the out animation must have ended').toBe('0');
    expect(
      gsap.getTweensOf(animatedElements.panel),
      'a finished timeline must be killed, or a day on air in OBS piles them up',
    ).toEqual([]);
  });
});
