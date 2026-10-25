/**
 * Running a graphic's motions one at a time (packages/graphics/kit)
 *
 * What this module is for:
 *   The lower strip and the message ticker run their in, out and page motions through one
 *   runner: a new motion ends the running one at once, dispose ends them all, and the
 *   graphic can ask whether one is running (a page is drawn only once a stop-out faded).
 *
 * What these tests prove:
 *   - A motion is running until it ends, then not.
 *   - A second motion finishes the first at once (its run resolves, its piece at its end).
 *   - finishEveryTimelineAtOnce resolves every pending run and leaves nothing running.
 *
 * What these tests deliberately do not cover:
 *   - Playing and skipping a timeline; timelinePlayback.test.ts.
 */
import { gsap } from 'gsap';
import { describe, expect, it, onTestFinished } from 'vitest';

import { createMotionTimelineRunner } from './motionTimelineRunner.js';

/** A piece on the page and a paused 400 ms fade-in of it, as a graphic builds one. */
function createPieceWithAFadeIn() {
  const piece = document.createElement('div');
  document.body.append(piece);
  onTestFinished(() => piece.remove());
  const timeline = gsap.timeline({ paused: true });
  timeline.fromTo(piece, { opacity: 0 }, { opacity: 1, duration: 0.4 });
  return { piece, timeline };
}

describe('createMotionTimelineRunner', () => {
  it('says a motion is running until it ends', async () => {
    // Arrange: a runner and a 400 ms fade-in.
    const runner = createMotionTimelineRunner();
    const { timeline } = createPieceWithAFadeIn();

    // Act: start it, note the answer, then let it end at once.
    const pendingRun = runner.run(timeline, false);
    const isRunningDuringIt = runner.isRunning();
    runner.finishEveryTimelineAtOnce();
    await pendingRun;

    // Assert: running during it, not after.
    expect(isRunningDuringIt, 'a motion runs until it ends').toBe(true);
    expect(runner.isRunning(), 'nothing runs once it ended').toBe(false);
  });

  it('finishes the running motion at once when a second one starts', async () => {
    // Arrange: a runner, the play-in of one piece running.
    const runner = createMotionTimelineRunner();
    const first = createPieceWithAFadeIn();
    const second = createPieceWithAFadeIn();
    const pendingFirstRun = runner.run(first.timeline, false);

    // Act: a second motion starts (a stop during the play-in), skipped to its end.
    await runner.run(second.timeline, true);
    await pendingFirstRun;

    // Assert: the first ended at its end state, and nothing is left running.
    expect(first.piece.style.opacity, 'the first motion was finished at once').toBe('1');
    expect(runner.isRunning(), 'nothing runs').toBe(false);
  });

  it('resolves every pending run when everything is finished at once', async () => {
    // Arrange: a runner with a motion running.
    const runner = createMotionTimelineRunner();
    const { piece, timeline } = createPieceWithAFadeIn();
    const pendingRun = runner.run(timeline, false);

    // Act: dispose ends everything.
    runner.finishEveryTimelineAtOnce();
    await pendingRun;

    // Assert: the run resolved, no tween left on the piece.
    expect(gsap.getTweensOf(piece), 'no tween is left').toEqual([]);
  });
});
