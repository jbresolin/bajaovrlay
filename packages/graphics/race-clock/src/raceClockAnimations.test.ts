/**
 * Race clock animations (packages/graphics/race-clock)
 *
 * What this module is for:
 *   The race clock animates in on play, out on stop, and wipes a new flag colour over
 *   the old one on a flag change (it never snaps). The GSAP timelines live here, next
 *   to the lengths the manifest promises a renderer in "actionDurations".
 *
 * What these tests prove:
 *   - Each timeline lasts exactly the length exported next to it, so the manifest
 *     (checked against these numbers in raceClockManifest.test.ts) tells the truth.
 *   - With skipAnimation, a timeline jumps straight to its end and the promise
 *     resolves at once, as the OGraf spec asks.
 *
 * What these tests deliberately do not cover:
 *   - What the animations look like; the Playwright screenshots show the end states,
 *     and e2e/raceClockOnAir.e2e.ts checks the flag wipe is gradual in a real browser.
 */
import { describe, expect, it } from 'vitest';

import {
  buildFlagChangeTimeline,
  buildPlayInTimeline,
  buildStopOutTimeline,
  flagChangeDurationMs,
  playInDurationMs,
  playTimelineToTheEnd,
  type RaceClockAnimatedElements,
  stopOutDurationMs,
} from './raceClockAnimations.js';

/** Builds bare stand-ins for the three elements the animations move. */
function createAnimatedElementsInAnEmptyPage(): RaceClockAnimatedElements {
  const panel = document.createElement('section');
  const flagBand = document.createElement('div');
  const incomingFlagLayer = document.createElement('div');
  panel.append(flagBand);
  flagBand.append(incomingFlagLayer);
  document.body.append(panel);
  return { panel, flagBand, incomingFlagLayer };
}

const timelineLengthScenarios = [
  // playAction: the manifest promises this length for the way in.
  {
    name: 'the play-in timeline lasts playInDurationMs',
    build: buildPlayInTimeline,
    expectedMs: playInDurationMs,
  },
  // stopAction: the manifest promises this length for the way out.
  {
    name: 'the stop-out timeline lasts stopOutDurationMs',
    build: buildStopOutTimeline,
    expectedMs: stopOutDurationMs,
  },
  // A flag change during updateAction; not in the manifest because a plain update has no animation.
  {
    name: 'the flag-change timeline lasts flagChangeDurationMs',
    build: buildFlagChangeTimeline,
    expectedMs: flagChangeDurationMs,
  },
];

describe('race clock timelines', () => {
  it.each(timelineLengthScenarios)('$name', ({ build, expectedMs }) => {
    // Arrange: the elements the timeline moves.
    const animatedElements = createAnimatedElementsInAnEmptyPage();

    // Act: build the timeline (paused; nothing moves yet) and measure it.
    const timeline = build(animatedElements);
    const timelineLengthMs = Math.round(timeline.duration() * 1000);
    timeline.kill();

    // Assert: it lasts exactly what the exported constant (and so the manifest) says.
    expect(timelineLengthMs, 'the timeline must last exactly the length it exports').toBe(
      expectedMs,
    );
  });
});

describe('playTimelineToTheEnd', () => {
  it('jumps to the end and resolves at once when skipAnimation is set', async () => {
    // Arrange: a play-in timeline that would normally take a while.
    const animatedElements = createAnimatedElementsInAnEmptyPage();
    const timeline = buildPlayInTimeline(animatedElements);

    // Act: play it with skipAnimation, as a renderer may ask.
    await playTimelineToTheEnd(timeline, { skipAnimation: true });

    // Assert: the timeline is already at its end.
    expect(timeline.progress(), 'skipAnimation must jump straight to the end').toBe(1);
  });
});
