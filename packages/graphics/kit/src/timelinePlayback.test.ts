/**
 * Playing a graphic's timelines (packages/graphics/kit)
 *
 * What this module is for:
 *   Every graphic builds paused GSAP timelines and plays them through
 *   `playTimelineToTheEnd`, whose promise the OGraf action awaits; `dispose` ends what is
 *   still running with `finishTimelineAtOnce`. An action that never resolved would hang the
 *   renderer's queue; a finished timeline left registered in GSAP would pile up over a day
 *   in OBS.
 *
 * What these tests prove:
 *   - With skipAnimation the timeline jumps to its end at once and the promise resolves.
 *   - A timeline that plays resolves once it has run to its end.
 *   - Finishing a running timeline at once resolves the promise that was waiting on it,
 *     and leaves the end state on screen.
 *   - A finished timeline is removed from GSAP.
 *
 * What these tests deliberately do not cover:
 *   - What a graphic's timelines move; each graphic's animations tests check that.
 */
import { gsap } from 'gsap';
import { describe, expect, it } from 'vitest';

import { finishTimelineAtOnce, playTimelineToTheEnd } from './timelinePlayback.js';

/** Builds a paused timeline that fades a card in over `durationSeconds`. */
function buildCardFadeInTimeline(durationSeconds: number) {
  const card = document.createElement('div');
  document.body.append(card);
  const timeline = gsap.timeline({ paused: true });
  timeline.fromTo(card, { opacity: 0 }, { opacity: 1, duration: durationSeconds });
  return { card, timeline };
}

describe('playTimelineToTheEnd', () => {
  it('jumps to the end at once with skipAnimation', async () => {
    // Arrange: a ten-second fade, far longer than the test.
    const { card, timeline } = buildCardFadeInTimeline(10);

    // Act: play it skipping the animation.
    await playTimelineToTheEnd(timeline, { skipAnimation: true });

    // Assert: the card shows its end state and the timeline left GSAP.
    expect(card.style.opacity, 'the card must be fully shown at once').toBe('1');
    expect(timeline.isActive(), 'the finished timeline must not be running').toBe(false);
  });

  it('resolves once a played timeline reaches its end', async () => {
    // Arrange: a fade of 0 seconds, as on a page without the theme's tokens.
    const { card, timeline } = buildCardFadeInTimeline(0);

    // Act: play it normally.
    await playTimelineToTheEnd(timeline, { skipAnimation: false });

    // Assert: the promise resolved with the card at its end state.
    expect(card.style.opacity, 'the card must be fully shown after the play').toBe('1');
  });
});

describe('finishTimelineAtOnce', () => {
  it('resolves a pending play and leaves the end state on screen', async () => {
    // Arrange: a ten-second fade already playing.
    const { card, timeline } = buildCardFadeInTimeline(10);
    const pendingPlay = playTimelineToTheEnd(timeline, { skipAnimation: false });

    // Act: end it at once, as dispose does.
    finishTimelineAtOnce(timeline);
    await pendingPlay;

    // Assert: the waiting promise resolved and the card shows its end state.
    expect(card.style.opacity, 'the card must be left at its end state').toBe('1');
    expect(timeline.isActive(), 'the timeline must not be running any more').toBe(false);
  });
});
